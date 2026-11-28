<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Services\ConsultationScheduler;
use App\Services\ExecutionSchedules;
use App\Services\ProjectNotices;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Backlog #35: Update the project's status.
 *   1. The status and remarks are saved and the project is updated; Cancelled needs remarks.
 *   2. Cancelling emails a cancellation notice to both the Fabrication and Installation Heads.
 *
 * Decided with the user (Nov 28):
 *   - Reschedule = the per-phase Reschedule from #32 (with remarks), as revised on Nov 19.
 *   - Completed follows the group's ExecutionSchedules::markDone: marking installation done
 *     (with 1–10 photos) completes the project automatically. No separate Completed button.
 *   - The remarks and the time are saved in projects.status_remarks / status_changed_at.
 * Workflow: the customer is emailed when a phase is done, when the project is completed and
 * when it is cancelled.
 */
class ProjectStatusController extends Controller
{
    public const REMARKS_MAX = 1000;

    /** Mark the fabrication or installation work as done (the group's markDone). */
    public function complete(Request $request, Project $project, string $phase, ExecutionSchedules $execution): RedirectResponse
    {
        abort_unless(isset(ExecutionScheduleController::PHASES[$phase]), 404);
        $title = ExecutionScheduleController::PHASES[$phase]['title'];

        $data = $request->validate([
            'photos' => ['required', 'array', 'min:'.ExecutionSchedules::PHOTOS_MIN, 'max:'.ExecutionSchedules::PHOTOS_MAX],
            'photos.*' => ['file', 'mimes:'.implode(',', ExecutionSchedules::PHOTO_MIMES), 'max:'.(ExecutionSchedules::PHOTO_MAX_MB * 1024)],
            'note' => ['nullable', 'string', 'max:'.ExecutionSchedules::NOTE_MAX],
        ], [
            'photos.required' => 'Add 1 to 10 photos of the finished work.',
            'photos.min' => 'Add 1 to 10 photos of the finished work.',
            'photos.max' => 'Add 1 to 10 photos of the finished work.',
            'photos.*.mimes' => 'The photos must be JPG, PNG or WEBP images.',
            'photos.*.max' => 'Each photo can be up to '.ExecutionSchedules::PHOTO_MAX_MB.' MB.',
        ]);

        self::ensureOpen($project, 'photos');
        $schedule = $execution->current($project, $phase);
        if ($schedule === null) {
            throw ValidationException::withMessages(['photos' => "Save the {$title} schedule first."]);
        }
        // My addition: the work order goes out before the work is done.
        if ($schedule->schedule_status !== ProjectSchedule::STATUS_COMPLETED && $schedule->work_order_sent_at === null) {
            throw ValidationException::withMessages(['photos' => "Send the {$title} work order first."]);
        }

        try {
            $execution->markDone($schedule, $data['photos'], $data['note'] ?? null, $request->user());
        } catch (Throwable $e) {
            throw ValidationException::withMessages(['photos' => $e->getMessage()]);
        }

        $project->refresh()->load('status');
        if ($project->status->status_name === ProjectStatus::COMPLETED) {
            // Installation done → the project is completed (the group's moveOn).
            $project->update([
                'status_remarks' => isset($data['note']) && trim($data['note']) !== '' ? trim($data['note']) : null,
                'status_changed_at' => Carbon::now(ConsultationScheduler::TIMEZONE),
            ]);
        }

        ProjectNotices::phaseDone($project, $phase);

        return back();
    }

        /** Cancel the project (from any step). Acceptance criteria 1 and 2. */
    public function update(Request $request, Project $project): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:Cancelled'],
            'remarks' => ['required', 'string', 'max:'.self::REMARKS_MAX],
        ], [
            'status.required' => 'Select the new status.',
            'status.in' => 'The project is completed automatically when installation is marked done.',
            'remarks.required' => 'Remarks are required when the project is cancelled.',
            'remarks.max' => 'The remarks can be up to '.self::REMARKS_MAX.' characters.',
        ]);

        self::ensureOpen($project, 'remarks');
        $remarks = trim($data['remarks']);

        $project->update([
            'current_status_id' => ProjectStatus::idFor(ProjectStatus::CANCELLED),
            'status_remarks' => $remarks,
            'status_changed_at' => Carbon::now(ConsultationScheduler::TIMEZONE),
        ]);

        // Acceptance criterion 2: both Heads; Use Case: the customer too.
        ProjectNotices::projectCancelled($project->fresh(), $remarks);

        return back();
    }

    /**
     * The status history in the page's shape: the last Completed / Cancelled change.
     *
     * @return list<array<string, mixed>>
     */
    public static function page(Project $project): array
    {
        $status = $project->status->status_name;
        if (! in_array($status, [ProjectStatus::COMPLETED, ProjectStatus::CANCELLED], true)) {
            return [];
        }

        return [[
            'status' => $status === ProjectStatus::COMPLETED ? 'Completed' : 'Cancelled',
            'remarks' => $project->status_remarks,
            'updatedBy' => $project->projectManager?->full_name ?? 'Project Manager',
            'updatedAt' => ($project->status_changed_at ?? $project->updated_at)->toIso8601String(),
        ]];
    }

    /** Completed and Cancelled are final (my addition). */
    private static function ensureOpen(Project $project, string $field): void
    {
        $project->loadMissing('status');
        $status = $project->status->status_name;

        if (in_array($status, [ProjectStatus::COMPLETED, ProjectStatus::CANCELLED], true)) {
            throw ValidationException::withMessages([$field => 'This project is already '.strtolower($status).'.']);
        }
    }
}