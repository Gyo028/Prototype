<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\AppointmentOutcome;
use App\Models\AppointmentOutcomeFile;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Sample fabrication and installation progress (Manage Project Execution),
 * until the Project Manager screens record it.
 *
 *  - Every finished fabrication/installation gets completed_at, a short note
 *    and photos of the finished work (stored like the site assessment:
 *    appointment_outcomes + files).
 *  - The Fabricating sample's fabrication was moved once, with a reason.
 *
 * Needs ProjectSeeder first. Skips anything that already has its photos.
 */
class ExecutionSeeder extends Seeder
{
    private const SAMPLES = __DIR__.'/samples/execution';

    private const PHOTOS = [
        ProjectSchedule::TYPE_FABRICATION => ['fabrication-backdrop-frame.jpg', 'fabrication-floral-panels.jpg'],
        ProjectSchedule::TYPE_INSTALLATION => ['installation-stage.jpg', 'installation-entrance-arch.jpg', 'installation-tables.jpg'],
    ];

    private const NOTES = [
        ProjectSchedule::TYPE_FABRICATION => 'All pieces are built and checked: backdrop frame, floral panels and signage. Ready for delivery.',
        ProjectSchedule::TYPE_INSTALLATION => 'Set-up is complete and checked with the venue coordinator. Enjoy your event!',
    ];

    public function run(): void
    {
        $manager = User::query()->where('email', Role::ProjectManager->value.'@example.com')->first();

        DB::transaction(function () use ($manager) {
            $finished = ProjectSchedule::query()
                ->with('project.serviceRequest')
                ->whereIn('schedule_type', array_keys(self::PHOTOS))
                ->where('schedule_status', ProjectSchedule::STATUS_COMPLETED)
                ->whereDoesntHave('outcome')
                ->get();

            foreach ($finished as $schedule) {
                $this->complete($schedule, $manager);
            }

            $this->sampleReschedule($manager);
        });
    }

    private function complete(ProjectSchedule $schedule, ?User $manager): void
    {
        $doneAt = $schedule->end_datetime->copy()->setTime(17, 30);
        $schedule->update(['completed_at' => $doneAt]);

        $outcome = AppointmentOutcome::create([
            'schedule_id' => $schedule->schedule_id,
            'notes' => self::NOTES[$schedule->schedule_type],
            'recorded_by' => $manager?->id,
            'recorded_at' => $doneAt,
        ]);

        $folder = sprintf(
            'customers/%d/projects/%d/%s/completion',
            $schedule->project->serviceRequest->customer_id,
            $schedule->project_id,
            $schedule->schedule_type,
        );

        foreach (self::PHOTOS[$schedule->schedule_type] as $name) {
            $path = "{$folder}/{$name}";
            Storage::put($path, (string) file_get_contents(self::SAMPLES."/{$name}"));

            $outcome->files()->create([
                'file_type' => AppointmentOutcomeFile::TYPE_PHOTO,
                'file_name' => $name,
                'file_path' => $path,
            ]);
        }
    }

    /** The Fabricating sample: fabrication was first set three days earlier, then moved. */
    private function sampleReschedule(?User $manager): void
    {
        $project = Project::query()
            ->where('current_status_id', ProjectStatus::idFor(ProjectStatus::FABRICATING))
            ->whereHas('schedules', fn ($q) => $q->where('schedule_type', ProjectSchedule::TYPE_FABRICATION))
            ->first();
        $current = $project?->schedules()
            ->where('schedule_type', ProjectSchedule::TYPE_FABRICATION)
            ->where('schedule_status', '!=', ProjectSchedule::STATUS_CANCELLED)
            ->first();

        if ($current === null || $project->schedules()->where('schedule_type', ProjectSchedule::TYPE_FABRICATION)->where('schedule_status', ProjectSchedule::STATUS_CANCELLED)->exists()) {
            return;
        }

        $project->schedules()->create([
            'schedule_type' => ProjectSchedule::TYPE_FABRICATION,
            'start_datetime' => $current->start_datetime->copy()->subDays(3),
            'end_datetime' => $current->end_datetime->copy()->subDays(3),
            'schedule_status' => ProjectSchedule::STATUS_CANCELLED,
            'remarks' => 'The fabric supplier delivered late, so we moved the start by three days.',
            'changed_by' => $manager?->id,
        ]);
    }
}
