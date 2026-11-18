<?php

namespace App\Services;

use App\Models\AppointmentOutcome;
use App\Models\AppointmentOutcomeFile;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Fabrication and installation (Manage Project Execution).
 *
 * The Project Manager schedules each with a start and a target completion
 * date, reschedules with a reason (the customer sees the old and new dates and
 * the reason), and marks it done with photos of the finished work as proof
 * (1–10 photos, JPG/PNG/WEBP up to 5 MB; a note is optional). The completion
 * is the project's progress update for that stage.
 *
 * Marking done moves the project on: fabrication → Installing, installation
 * → Completed.
 *
 * The completion photos and note are stored like the site assessment:
 * appointment_outcomes (note, recorded_by, recorded_at) and
 * appointment_outcome_files (file_type 'photo').
 *
 * The customer side only reads this. The PM screens (your groupmate) call
 * schedule(), reschedule() and markDone().
 */
class ExecutionSchedules
{
    public const TYPES = [ProjectSchedule::TYPE_FABRICATION, ProjectSchedule::TYPE_INSTALLATION];

    public const PHOTOS_MIN = 1;

    public const PHOTOS_MAX = 10;

    public const PHOTO_MAX_MB = 5;

    public const PHOTO_MIMES = ['jpg', 'jpeg', 'png', 'webp'];

    public const NOTE_MAX = 1000;

    public const REASON_MAX = 255;

    /** Validation rules for the PM's "mark done" form. @return array<string, mixed> */
    public static function completionRules(): array
    {
        return [
            'photos' => ['required', 'array', 'min:'.self::PHOTOS_MIN, 'max:'.self::PHOTOS_MAX],
            'photos.*' => ['file', 'mimes:'.implode(',', self::PHOTO_MIMES), 'max:'.self::PHOTO_MAX_MB * 1024],
            'note' => ['nullable', 'string', 'max:'.self::NOTE_MAX],
        ];
    }

    /** The current (not cancelled) fabrication or installation schedule. */
    public function current(Project $project, string $type): ?ProjectSchedule
    {
        $schedules = $project->relationLoaded('schedules') ? $project->schedules : $project->schedules()->get();

        return $schedules
            ->where('schedule_type', $type)
            ->where('schedule_status', '!=', ProjectSchedule::STATUS_CANCELLED)
            ->sortByDesc('schedule_id')
            ->first();
    }

    /** Earlier schedules that were moved, newest first. @return Collection<int, ProjectSchedule> */
    public function changes(Project $project, string $type): Collection
    {
        $schedules = $project->relationLoaded('schedules') ? $project->schedules : $project->schedules()->get();

        return $schedules
            ->where('schedule_type', $type)
            ->where('schedule_status', ProjectSchedule::STATUS_CANCELLED)
            ->sortByDesc('schedule_id')
            ->values();
    }

    /**
     * not_scheduled | scheduled | in_progress | done, as of today (Manila).
     */
    public function state(?ProjectSchedule $schedule): string
    {
        if ($schedule === null) {
            return 'not_scheduled';
        }

        if ($schedule->schedule_status === ProjectSchedule::STATUS_COMPLETED) {
            return 'done';
        }

        $today = Carbon::now(ConsultationScheduler::TIMEZONE)->toDateString();

        return $schedule->start_datetime->toDateString() <= $today ? 'in_progress' : 'scheduled';
    }

    /** For the PM side: set the dates (start and target completion). */
    public function schedule(Project $project, string $type, CarbonInterface $start, CarbonInterface $end, ?User $by = null): ProjectSchedule
    {
        $this->assertType($type);
        $this->assertDates($start, $end);

        if ($this->current($project, $type)) {
            throw new \LogicException("This project already has a {$type} schedule. Reschedule it instead.");
        }

        $schedule = $project->schedules()->create([
            'schedule_type' => $type,
            'start_datetime' => $start,
            'end_datetime' => $end,
            'schedule_status' => ProjectSchedule::STATUS_CONFIRMED,
            'changed_by' => $by?->id,
        ]);
        $project->unsetRelation('schedules');

        return $schedule;
    }

    /**
     * For the PM side: move the dates. The old schedule is kept as cancelled
     * with the reason, so the customer sees what changed and why.
     */
    public function reschedule(ProjectSchedule $schedule, CarbonInterface $start, CarbonInterface $end, string $reason, ?User $by = null): ProjectSchedule
    {
        $this->assertType($schedule->schedule_type);
        $this->assertDates($start, $end);

        $reason = trim($reason);

        if ($reason === '') {
            throw new \InvalidArgumentException('A reason is required to reschedule.');
        }

        if ($schedule->schedule_status === ProjectSchedule::STATUS_COMPLETED) {
            throw new \LogicException('This work is already done.');
        }

        return DB::transaction(function () use ($schedule, $start, $end, $reason, $by) {
            $schedule->update([
                'schedule_status' => ProjectSchedule::STATUS_CANCELLED,
                'remarks' => mb_substr($reason, 0, self::REASON_MAX),
                'changed_by' => $by?->id,
            ]);

            $new = $schedule->project->schedules()->create([
                'schedule_type' => $schedule->schedule_type,
                'start_datetime' => $start,
                'end_datetime' => $end,
                'schedule_status' => ProjectSchedule::STATUS_CONFIRMED,
                'changed_by' => $by?->id,
            ]);
            $schedule->project->unsetRelation('schedules');

            return $new;
        });
    }

    /**
     * For the PM side: the work is finished. Saves the photos (proof) and the
     * optional note, sets completed_at, and moves the project to the next status.
     *
     * @param  list<UploadedFile>  $photos
     */
    public function markDone(ProjectSchedule $schedule, array $photos, ?string $note = null, ?User $by = null, ?CarbonInterface $completedAt = null): void
    {
        $this->assertType($schedule->schedule_type);

        if ($schedule->schedule_status === ProjectSchedule::STATUS_COMPLETED) {
            throw new \LogicException('This work is already marked done.');
        }

        if ($schedule->schedule_status === ProjectSchedule::STATUS_CANCELLED) {
            throw new \LogicException('This schedule was moved; mark the current one done.');
        }

        if (count($photos) < self::PHOTOS_MIN || count($photos) > self::PHOTOS_MAX) {
            throw new \InvalidArgumentException('Add 1 to 10 photos of the finished work.');
        }

        $completedAt ??= Carbon::now(ConsultationScheduler::TIMEZONE);
        $project = $schedule->project;
        $folder = sprintf(
            'customers/%d/projects/%d/%s/completion',
            $project->serviceRequest()->value('customer_id'),
            $project->project_id,
            $schedule->schedule_type,
        );

        $stored = [];

        try {
            foreach ($photos as $photo) {
                $stored[] = ['name' => mb_substr($photo->getClientOriginalName(), 0, 255), 'path' => $photo->store($folder)];
            }

            DB::transaction(function () use ($schedule, $project, $stored, $note, $by, $completedAt) {
                $schedule->update([
                    'schedule_status' => ProjectSchedule::STATUS_COMPLETED,
                    'completed_at' => $completedAt,
                ]);

                $outcome = AppointmentOutcome::create([
                    'schedule_id' => $schedule->schedule_id,
                    'notes' => $note !== null && trim($note) !== '' ? trim($note) : null,
                    'recorded_by' => $by?->id,
                    'recorded_at' => $completedAt,
                ]);

                foreach ($stored as $file) {
                    $outcome->files()->create([
                        'file_type' => AppointmentOutcomeFile::TYPE_PHOTO,
                        'file_name' => $file['name'],
                        'file_path' => $file['path'],
                    ]);
                }

                $this->moveOn($project, $schedule->schedule_type);
            });
        } catch (\Throwable $e) {
            Storage::delete(array_column($stored, 'path'));

            throw $e;
        }
    }

    /** Fabrication done → Installing; installation done → Completed. */
    private function moveOn(Project $project, string $type): void
    {
        $project->loadMissing('status');
        $now = $project->status->status_name;

        $next = match (true) {
            $type === ProjectSchedule::TYPE_FABRICATION && $now === ProjectStatus::FABRICATING => ProjectStatus::INSTALLING,
            $type === ProjectSchedule::TYPE_INSTALLATION && $now === ProjectStatus::INSTALLING => ProjectStatus::COMPLETED,
            default => null,
        };

        if ($next) {
            $project->update(['current_status_id' => ProjectStatus::idFor($next)]);
            $project->unsetRelation('status');
        }
    }

    private function assertType(string $type): void
    {
        if (! in_array($type, self::TYPES, true)) {
            throw new \InvalidArgumentException('Only fabrication and installation can be scheduled here.');
        }
    }

    private function assertDates(CarbonInterface $start, CarbonInterface $end): void
    {
        if ($end->lt($start)) {
            throw new \InvalidArgumentException('The target completion date cannot be before the start date.');
        }
    }
}
