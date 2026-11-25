<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Models\AppointmentOutcome;
use App\Models\AppointmentOutcomeFile;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Services\ConsultationScheduler;
use App\Services\OcularVisitScheduler;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Backlog #20: Record site assessment details.
 * After the ocular visit, the Project Manager uploads the site assessment report
 * (PDF or DOCX) and venue photos, so the designer has complete information.
 *   1. The report and photos are saved and attached to the project.
 *   2. Nothing is saved without a report.
 *
 * Saved in appointment_outcomes (+ appointment_outcome_files) on the ocular visit,
 * like the group's SiteAssessmentSeeder. Saving marks the visit as held (completed).
 * The assessment date is the visit's date (decided with the user: there is no separate column).
 * The project stays in Site Assessment until a Design Specialist is assigned (backlog #21).
 */
class SiteAssessmentController extends Controller
{
    public const REPORT_MIMES = ['pdf', 'docx'];

    public const REPORT_MAX_MB = 10;

    public const PHOTO_MIMES = ['jpg', 'jpeg', 'png', 'webp'];

    public const PHOTO_MAX_MB = 5;

    /** My addition: a limit, so one save cannot upload hundreds of files. */
    public const MAX_PHOTOS = 20;

    public function store(Request $request, Project $project, OcularVisitScheduler $visits): RedirectResponse
    {
        $visit = self::visitToRecord($project, $visits);
        $outcome = $visit->outcome;

        $data = $request->validate([
            'findings' => ['nullable', 'string', 'max:2000'],
            // Acceptance criterion 2: a report is required (the first time; later it can be kept).
            'report' => [$outcome ? 'nullable' : 'required', 'file', 'mimes:'.implode(',', self::REPORT_MIMES), 'max:'.(self::REPORT_MAX_MB * 1024)],
            'keepPhotoIds' => ['nullable', 'array'],
            'keepPhotoIds.*' => ['integer'],
            'photos' => ['nullable', 'array'],
            'photos.*' => ['file', 'mimes:'.implode(',', self::PHOTO_MIMES), 'max:'.(self::PHOTO_MAX_MB * 1024)],
        ], [
            'report.required' => 'Upload the site assessment report (PDF or DOCX). It cannot be saved without one.',
            'report.mimes' => 'The report must be a PDF or DOCX file.',
            'report.max' => 'The report must be '.self::REPORT_MAX_MB.' MB or smaller.',
            'photos.*.mimes' => 'Photos must be JPG, PNG or WEBP.',
            'photos.*.max' => 'Each photo must be '.self::PHOTO_MAX_MB.' MB or smaller.',
        ]);

        $saved = $outcome ? $outcome->files : collect();
        $keepIds = collect($data['keepPhotoIds'] ?? [])->map(fn ($id) => (int) $id);
        $keptPhotos = $saved->where('file_type', AppointmentOutcomeFile::TYPE_PHOTO)->whereIn('outcome_file_id', $keepIds);
        $newPhotos = $request->file('photos', []);

        if ($keptPhotos->count() + count($newPhotos) > self::MAX_PHOTOS) {
            throw ValidationException::withMessages(['photos' => 'Up to '.self::MAX_PHOTOS.' venue photos can be saved.']);
        }

        // Files that this save replaces or removes; deleted from storage after the save succeeds.
        $removed = $saved->filter(fn (AppointmentOutcomeFile $f) => $f->file_type === AppointmentOutcomeFile::TYPE_REPORT
            ? $request->hasFile('report')
            : ! $keepIds->contains($f->outcome_file_id));

        $folder = sprintf('customers/%d/projects/%d/site-assessment', $project->serviceRequest->customer_id, $project->project_id);
        $stored = [];

        try {
            DB::transaction(function () use ($request, $visit, $outcome, $data, $removed, $newPhotos, $folder, &$stored) {
                $now = Carbon::now(ConsultationScheduler::TIMEZONE);

                if ($visit->schedule_status !== ProjectSchedule::STATUS_COMPLETED) {
                    $visit->update(['schedule_status' => ProjectSchedule::STATUS_COMPLETED, 'completed_at' => $now, 'changed_by' => $request->user()->id]);
                }

                $outcome ??= new AppointmentOutcome(['schedule_id' => $visit->schedule_id]);
                $outcome->fill([
                    'notes' => self::clean($data['findings'] ?? null),
                    'recorded_by' => $request->user()->id,
                    'recorded_at' => $now,
                ])->save();

                AppointmentOutcomeFile::query()->whereIn('outcome_file_id', $removed->pluck('outcome_file_id'))->delete();

                if ($request->hasFile('report')) {
                    $stored[] = self::attach($outcome, $request->file('report'), $folder, AppointmentOutcomeFile::TYPE_REPORT);
                }

                foreach ($newPhotos as $photo) {
                    $stored[] = self::attach($outcome, $photo, $folder, AppointmentOutcomeFile::TYPE_PHOTO);
                }
            });
        } catch (\Throwable $e) {
            Storage::delete($stored); // nothing was saved, so remove the uploaded files again

            throw $e;
        }

        Storage::delete($removed->pluck('file_path')->all());

        return back();
    }
        /** Opens a site assessment file (add ?download=1 to download it). */
    public function file(Request $request, Project $project, AppointmentOutcomeFile $file): StreamedResponse
    {
        $file->loadMissing('outcome.schedule');
        abort_unless((int) $file->outcome->schedule->project_id === (int) $project->project_id, 404);
        abort_unless(Storage::exists($file->file_path), 404);

        return $request->boolean('download') || ! $file->isViewable()
            ? Storage::download($file->file_path, $file->file_name)
            : Storage::response($file->file_path, $file->file_name);
    }

    /** The ocular visit whose assessment can be recorded now, or a message why not. */
    private static function visitToRecord(Project $project, OcularVisitScheduler $visits): ProjectSchedule
    {
        $project->loadMissing('status', 'serviceRequest');
        $fail = fn (string $message) => throw ValidationException::withMessages(['visit' => $message]);

        if ($project->ocular_visit_required !== true) {
            $fail('No ocular visit is needed for this project.');
        }

        if ($project->status->status_name !== ProjectStatus::SITE_ASSESSMENT) {
            $fail($project->status->status_name === ProjectStatus::BOOKED
                ? 'The customer has not booked the ocular visit yet.'
                : 'The site assessment can no longer be changed (the project is '.strtolower($project->status->status_name).').');
        }

        $visit = $visits->held($project) ?? $visits->current($project);

        if ($visit === null) {
            $fail('The customer has not booked the ocular visit yet.');
        }

        if ($visit->schedule_status === ProjectSchedule::STATUS_PENDING) {
            $fail('The ocular visit is waiting for the site access documents to be approved.');
        }

        $start = Carbon::parse($visit->start_datetime->format('Y-m-d H:i:s'), ConsultationScheduler::TIMEZONE);
        if ($visit->schedule_status !== ProjectSchedule::STATUS_COMPLETED && $start->isFuture()) {
            $fail('The ocular visit is on '.$start->format('M j, Y, g:i A').'. Record the site assessment after the visit.');
        }

        $visit->load('outcome.files');

        return $visit;
    }

    private static function attach(AppointmentOutcome $outcome, UploadedFile $file, string $folder, string $type): string
    {
        $path = $file->store($folder);

        $outcome->files()->create([
            'file_type' => $type,
            'file_name' => mb_substr($file->getClientOriginalName(), 0, 150),
            'file_path' => $path,
        ]);

        return $path;
    }

    private static function clean(?string $text): ?string
    {
        $text = trim((string) $text);

        return $text === '' ? null : $text;
    }
}