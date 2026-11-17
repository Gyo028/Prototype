<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\OcularVisitRequest;
use App\Http\Requests\Customer\SiteAccessDocumentRequest;
use App\Models\AppointmentOutcomeFile;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\SiteAccessDocument;
use App\Services\OcularVisitScheduler;
use App\Services\SiteAccessDocuments;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Customer > My Projects > Ocular Visit (Plan Project step 3).
 *
 * The customer books a 2-hour, face-to-face visit at their venue and says
 * whose venue it is. Own property: confirmed right away. Third-party venue:
 * 'pending' until the Project Manager approves the authorization letter and
 * the venue permit (uploaded when booking or later, until the day before).
 * Booking moves the project from Booked to Site Assessment. Rescheduling keeps
 * history like the consultation. There is no cancellation .
 *
 * file(): the site assessment report and venue photos the Project Manager
 * uploaded, for the customer to view or download.
 */
class OcularVisitController extends Controller
{
    public function __construct(
        private OcularVisitScheduler $scheduler,
        private SiteAccessDocuments $documents,
    ) {}

    public function store(OcularVisitRequest $request, Project $project): RedirectResponse
    {
        ProjectController::ensureOwned($request, $project);

        if ($reason = $this->scheduler->bookingBlockedReason($project)) {
            return back()->withErrors(['ocularVisit' => $reason]);
        }

        $data = $request->validated();

        return DB::transaction(function () use ($request, $project, $data) {
            if ($problem = $this->scheduler->slotProblem($project, $data['date'], $data['time'])) {
                return back()->withErrors(['time' => $problem]);
            }

            $this->createBooking($project, $data, $data['venueOwnership']);

            // Documents only matter for a third-party venue.
            if ($data['venueOwnership'] === ProjectSchedule::VENUE_THIRD_PARTY) {
                foreach (['authorizationLetter' => SiteAccessDocument::TYPE_AUTHORIZATION_LETTER, 'venuePermit' => SiteAccessDocument::TYPE_VENUE_PERMIT] as $field => $type) {
                    if ($request->hasFile($field)) {
                        $this->documents->store($project, $type, $request->file($field), $request->user());
                    }
                }
            }

            // Paid and now booked: the project moves on to Site Assessment.
            if ((int) $project->current_status_id === ProjectStatus::idFor(ProjectStatus::BOOKED)) {
                $project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::SITE_ASSESSMENT)]);
            }

            return back();
        });
    }

    public function reschedule(OcularVisitRequest $request, Project $project): RedirectResponse
    {
        ProjectController::ensureOwned($request, $project);

        $current = $this->scheduler->current($project);

        if ($reason = $this->scheduler->changeBlockedReason($project, $current)) {
            return back()->withErrors(['ocularVisit' => $reason]);
        }

        $data = $request->validated();

        return DB::transaction(function () use ($request, $project, $current, $data) {
            if ($problem = $this->scheduler->slotProblem($project, $data['date'], $data['time'])) {
                return back()->withErrors(['time' => $problem]);
            }

            $current->update([
                'schedule_status' => ProjectSchedule::STATUS_CANCELLED,
                'remarks' => 'Rescheduled: '.$data['reason'],
                'changed_by' => $request->user()->id,
            ]);

            $this->createBooking($project, $data, $current->venue_ownership ?? ProjectSchedule::VENUE_OWN_PROPERTY);

            return back();
        });
    }

    /** Uploads or replaces the authorization letter or the venue permit. */
    public function uploadDocument(SiteAccessDocumentRequest $request, Project $project): RedirectResponse
    {
        ProjectController::ensureOwned($request, $project);

        if ($reason = $this->documents->uploadBlockedReason($project)) {
            return back()->withErrors(['documents' => $reason]);
        }

        $this->documents->store($project, $request->validated('type'), $request->file('file'), $request->user());

        return back();
    }

    /** Shows a site access document in the browser, or downloads it with ?download=1. */
    public function document(Request $request, Project $project, SiteAccessDocument $document): StreamedResponse
    {
        ProjectController::ensureOwned($request, $project);

        abort_unless((int) $document->project_id === (int) $project->project_id, 404);
        abort_unless(Storage::exists($document->file_path), 404);

        return $request->boolean('download') || ! $document->isViewable()
            ? Storage::download($document->file_path, $document->file_name)
            : Storage::response($document->file_path, $document->file_name);
    }

    /** Shows a site assessment file in the browser, or downloads it with ?download=1. */
    public function file(Request $request, Project $project, AppointmentOutcomeFile $file): StreamedResponse
    {
        ProjectController::ensureOwned($request, $project);

        $file->loadMissing('outcome.schedule');
        abort_unless((int) $file->outcome->schedule->project_id === (int) $project->project_id, 404);
        abort_unless(Storage::exists($file->file_path), 404);

        return $request->boolean('download') || ! $file->isViewable()
            ? Storage::download($file->file_path, $file->file_name)
            : Storage::response($file->file_path, $file->file_name);
    }

    /**
     * Own property: confirmed. Third-party venue: confirmed only when both
     * documents are already approved, otherwise pending.
     *
     * @param  array{date: string, time: string}  $data
     */
    private function createBooking(Project $project, array $data, string $venueOwnership): void
    {
        [$start, $end] = $this->scheduler->slotBounds($data['date'], $data['time']);

        $project->schedules()->create([
            'schedule_type' => ProjectSchedule::TYPE_OCULAR_VISIT,
            'start_datetime' => $start,
            'end_datetime' => $end,
            'schedule_status' => $this->documents->visitStatusFor($project, $venueOwnership),
            'meeting_mode' => ProjectSchedule::MODE_FACE_TO_FACE,
            'venue_ownership' => $venueOwnership,
        ]);
    }
}
