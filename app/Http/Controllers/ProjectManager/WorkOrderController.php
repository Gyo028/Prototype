<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Mail\NoticeMail;
use App\Mail\WorkOrderMail;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Services\ConsultationScheduler;
use App\Services\ExecutionSchedules;
use App\Services\ProjectNotices;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Backlog #33: Generate and send work orders.
 *   1. The work order with the project instructions is sent to the assigned Head.
 *   2. Without the Head (or their email) or the work assignment information, nothing is sent.
 *
 * Decided with the user (Nov 27): the work order is really emailed (the group's mail settings
 * in .env; MAIL_MAILER=log writes it to storage/logs/laravel.log), and it is recorded on the
 * phase's schedule (project_schedules.work_order_instructions / work_order_sent_at, added in
 * the same migration as #32's Head). Rescheduling makes a new schedule row, so the work order
 * has to be sent again.
 */
class WorkOrderController extends Controller
{
    public const INSTRUCTIONS_MAX = 2000;

    public function send(Request $request, Project $project, string $phase, ExecutionSchedules $execution): RedirectResponse
    {
        abort_unless(isset(ExecutionScheduleController::PHASES[$phase]), 404);

        $data = $request->validate([
            'instructions' => ['required', 'string', 'max:'.self::INSTRUCTIONS_MAX],
        ], [
            'instructions.required' => 'Write the project instructions for the Head.',
            'instructions.max' => 'The instructions can be up to '.self::INSTRUCTIONS_MAX.' characters.',
        ]);

        $project->loadMissing(['status', 'serviceRequest.customer', 'serviceRequest.eventType', 'projectManager']);
        if (in_array($project->status->status_name, [ProjectStatus::COMPLETED, ProjectStatus::CANCELLED], true)) {
            throw ValidationException::withMessages(['workOrder' => 'This project is '.strtolower($project->status->status_name).'.']);
        }

        // Acceptance criterion 2: the work assignment information must be complete.
        $schedule = $execution->current($project, $phase);
        $title = ExecutionScheduleController::PHASES[$phase]['title'];
        $headTitle = ExecutionScheduleController::PHASES[$phase]['head'];
        if ($schedule === null) {
            throw ValidationException::withMessages(['workOrder' => "Save the {$title} schedule first."]);
        }
        if ($schedule->schedule_status === ProjectSchedule::STATUS_COMPLETED) {
            throw ValidationException::withMessages(['workOrder' => "{$title} is already done."]);
        }
        $head = $schedule->assignedEmployee;
        if ($head === null) {
            throw ValidationException::withMessages(['workOrder' => "No {$headTitle} is assigned to this phase."]);
        }
        if (! filter_var($head->email, FILTER_VALIDATE_EMAIL)) {
            throw ValidationException::withMessages(['workOrder' => "{$head->full_name} has no email address in the employee records."]);
        }

        $instructions = trim($data['instructions']);
        $now = Carbon::now(ConsultationScheduler::TIMEZONE);

        // Acceptance criterion 1: email the work order to the Head; it is recorded only once sent.
        try {
            Mail::to($head->email)->send(new WorkOrderMail(self::mail($project, $schedule, $phase, $head->full_name, $instructions, $now)));
        } catch (Throwable $e) {
            report($e);
            throw ValidationException::withMessages(['workOrder' => 'The email could not be sent. Check the mail settings and try again.']);
        }

        $schedule->update(['work_order_instructions' => $instructions, 'work_order_sent_at' => $now]);

        // Use Case Table 8: "sends a work summary confirmation to the Project Manager" (fix list, Nov 27).
        self::sendWorkSummary($project, $schedule->fresh(), $phase, $head->full_name, (string) $head->email, $instructions, $now);
        return back();
    }

        /** The work summary confirmation emailed to the project's Project Manager after a work order is sent. */
    private static function sendWorkSummary(Project $project, ProjectSchedule $schedule, string $phase, string $head, string $headEmail, string $instructions, Carbon $now): void
    {
        $manager = $project->projectManager;

        ProjectNotices::send($manager?->email ?: $manager?->user?->email, new NoticeMail(
            subjectLine: 'Work summary: '.self::code($project, $phase)." sent · {$project->project_code}",
            heading: 'Work order sent',
            greeting: 'Hi '.($manager?->full_name ?? 'Project Manager').',',
            lines: ['This confirms the work order below was emailed to the assigned Head.'],
            details: [
                'Work order' => self::code($project, $phase),
                'Project' => (string) $project->project_code,
                'Phase' => ExecutionScheduleController::PHASES[$phase]['title'],
                'Activity' => (string) ($schedule->activity ?? ExecutionScheduleController::PHASES[$phase]['title']),
                'Sent to' => "{$head} ({$headEmail})",
                'Start date' => $schedule->start_datetime->format('M j, Y'),
                'Target completion date' => $schedule->end_datetime->format('M j, Y'),
                'Instructions' => $instructions,
                'Sent on' => $now->format('M j, Y g:i A'),
            ],
        ));
    }   
    /** "WO-26-0007-F": the project number with F (fabrication) or I (installation). */
    public static function code(Project $project, string $phase): string
    {
        return 'WO-'.preg_replace('/^PRJ-/', '', (string) $project->project_code).'-'.($phase === ProjectSchedule::TYPE_FABRICATION ? 'F' : 'I');
    }

    /**
     * The sent work order in the page's shape, or null while it has not been sent.
     *
     * @return array<string, string>|null
     */
    public static function page(Project $project, ProjectSchedule $schedule, string $phase): ?array
    {
        if ($schedule->work_order_sent_at === null) {
            return null;
        }

        return [
            'code' => self::code($project, $phase),
            'instructions' => (string) $schedule->work_order_instructions,
            'sentTo' => $schedule->assignedEmployee?->full_name ?? 'the Head',
            'sentToEmail' => (string) $schedule->assignedEmployee?->email,
            'sentBy' => $project->projectManager?->full_name ?? 'Project Manager',
            'sentAt' => $schedule->work_order_sent_at->toIso8601String(),
        ];
    }

    /** @return array<string, string> what the email shows */
    private static function mail(Project $project, ProjectSchedule $schedule, string $phase, string $head, string $instructions, Carbon $now): array
    {
        $request = $project->serviceRequest;
        $event = $request->isCustom() ? (string) $request->project_title : ($request->eventType?->event_type_name ?? 'Event');

        return [
            'code' => self::code($project, $phase),
            'phase' => ExecutionScheduleController::PHASES[$phase]['title'],
            'project' => (string) $project->project_code,
            'event' => $event.' · '.$request->start_date->format('M j, Y'),
            'customer' => $request->customer?->full_name ?? 'Customer',
            'venue' => (string) $request->venue,
            'activity' => (string) ($schedule->activity ?? ExecutionScheduleController::PHASES[$phase]['title']),
            'start' => $schedule->start_datetime->format('M j, Y'),
            'target' => $schedule->end_datetime->format('M j, Y'),
            'instructions' => $instructions,
            'head' => $head,
            'manager' => $project->projectManager?->full_name ?? 'Project Manager',
            'sentAt' => $now->format('M j, Y g:i A'),
        ];
    }
}