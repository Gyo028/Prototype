<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Services\ConsultationScheduler;
use App\Services\ExecutionSchedules;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Backlog #32: Schedule project execution.
 *   1. The fabrication and installation schedule is saved with the assigned Heads.
 *   2. Incomplete scheduling information (a Head or a date missing) is not saved.
 *
 * Decided with the user (Nov 26): one start date and one target completion date per phase
 * (the group's project_schedules, also shown on the customer side), and the Head is saved in
 * the new project_schedules.assigned_employee_id column. Uses the group's ExecutionSchedules
 * (schedule, reschedule with a reason).
 */
class ExecutionScheduleController extends Controller
{
    public const PHASES = [
        ProjectSchedule::TYPE_FABRICATION => ['title' => 'Fabrication', 'head' => 'Fabrication Head'],
        ProjectSchedule::TYPE_INSTALLATION => ['title' => 'Installation', 'head' => 'Installation Head'],
    ];

    /** The first schedule: both phases at once. */
    public function store(Request $request, Project $project, ExecutionSchedules $execution): RedirectResponse
    {
        $rules = [];
        $messages = [];
        foreach (self::PHASES as $key => $phase) {
            $rules += self::phaseRules($key);
            $messages += self::phaseMessages($key, $phase);
        }
        $data = $request->validate($rules, $messages);

        self::ensureOpen($project, ProjectStatus::FABRICATING);
        if ($execution->current($project, ProjectSchedule::TYPE_FABRICATION) || $execution->current($project, ProjectSchedule::TYPE_INSTALLATION)) {
            throw ValidationException::withMessages(['schedule' => 'The schedule is already saved. Reschedule a phase instead.']);
        }

        DB::transaction(function () use ($data, $project, $execution, $request) {
            foreach (array_keys(self::PHASES) as $key) {
                [$start, $end] = self::dates($data[$key]);
                $schedule = $execution->schedule($project, $key, $start, $end, $request->user());
                $schedule->update(['assigned_employee_id' => (int) $data[$key]['headId'], 'activity' => trim($data[$key]['activity'])]);
            }
        });

        return back();
    }

    /** Move one phase (a reason is required); the Head can be changed too. */
    public function reschedule(Request $request, Project $project, string $phase, ExecutionSchedules $execution): RedirectResponse
    {
        abort_unless(isset(self::PHASES[$phase]), 404);

        $data = $request->validate(self::phaseRules($phase, '') + [
            'reason' => ['required', 'string', 'max:'.ExecutionSchedules::REASON_MAX],
        ], self::phaseMessages($phase, self::PHASES[$phase], '') + [
            'reason.required' => 'Give the reason for rescheduling.',
            'reason.max' => 'The reason can be up to '.ExecutionSchedules::REASON_MAX.' characters.',
        ]);

        self::ensureOpen($project);
        $current = $execution->current($project, $phase);
        if ($current === null) {
            throw ValidationException::withMessages(['schedule' => 'This phase has no schedule yet.']);
        }
        if ($current->schedule_status === ProjectSchedule::STATUS_COMPLETED) {
            throw ValidationException::withMessages(['schedule' => self::PHASES[$phase]['title'].' is already done.']);
        }

        DB::transaction(function () use ($data, $current, $execution, $request) {
            [$start, $end] = self::dates($data);
            $new = $execution->reschedule($current, $start, $end, $data['reason'], $request->user());
            $new->update(['assigned_employee_id' => (int) $data['headId'], 'activity' => trim($data['activity'])]);
        });

        return back();
    }

        /**
     * The Fabrication and Installation Heads to choose from, with how many open schedules each has.
     *
     * @return list<array<string, mixed>>
     */
    public static function heads(): array
    {
        $open = ProjectSchedule::query()
            ->whereNotNull('assigned_employee_id')
            ->whereIn('schedule_status', ProjectSchedule::ACTIVE_STATUSES)
            ->selectRaw('assigned_employee_id, count(*) as total')
            ->groupBy('assigned_employee_id')
            ->pluck('total', 'assigned_employee_id');

        $list = [];
        foreach (self::PHASES as $key => $phase) {
            foreach (self::headsOf($phase['head'])->orderBy('first_name')->orderBy('last_name')->get() as $e) {
                $list[] = [
                    'id' => $e->employee_id,
                    'name' => $e->full_name,
                    'phase' => $key,
                    'email' => $e->email ?: null,
                    'activeAssignments' => (int) ($open[$e->employee_id] ?? 0),
                ];
            }
        }

        return $list;
    }

    /**
     * The schedule in the page's shape, or null while nothing is scheduled.
     * Not stored: when the schedule was saved and when a phase was moved.
     *
     * @return array<string, mixed>|null
     */
    public static function page(Project $project, ExecutionSchedules $execution): ?array
    {
        $current = [];
        foreach (array_keys(self::PHASES) as $key) {
            $current[$key] = $execution->current($project, $key);
        }
        if (! array_filter($current)) {
            return null;
        }

        $first = $project->schedules
            ->whereIn('schedule_type', array_keys(self::PHASES))
            ->sortBy('schedule_id')
            ->first();

        $page = [
            'savedBy' => $first?->changedBy?->name ?? 'Project Manager',
            'savedAt' => null, // not stored
        ];

        foreach (self::PHASES as $key => $phase) {
            $s = $current[$key];
            $page[$key] = $s === null ? ['headId' => null, 'headName' => null, 'activities' => [], 'workOrder' => null, 'completion' => null, 'changes' => []] : [
                'headId' => $s->assigned_employee_id,
                'headName' => $s->assignedEmployee?->full_name,
                'activities' => [[
                    'id' => "{$key}-{$s->schedule_id}",
                    'activity' => $s->activity ?? $phase['title'],
                    'scheduledDate' => $s->start_datetime->toDateString(),
                    'targetDate' => $s->end_datetime->toDateString(),
                ]],
                'workOrder' => WorkOrderController::page($project, $s, $key), // backlog #33
                'completion' => $s->schedule_status === ProjectSchedule::STATUS_COMPLETED ? [
                    'completedBy' => $s->outcome?->recordedBy?->name ?? 'Project Manager',
                    'completedAt' => ($s->completed_at ?? $s->end_datetime)->toIso8601String(),
                ] : null,
                'changes' => $execution->changes($project, $key)->reverse()->map(fn (ProjectSchedule $c) => [
                    'reason' => (string) $c->remarks,
                    'changedBy' => $c->changedBy?->name ?? 'Project Manager',
                    'changedAt' => null, // not stored
                ])->values()->all(),
            ];
        }

        return $page;
    }

        /** @return array<string, mixed> */
    private static function phaseRules(string $key, ?string $prefix = null): array
    {
        $p = $prefix ?? "{$key}.";
        $head = self::PHASES[$key]['head'];

        return [
            "{$p}headId" => ['required', 'integer', function (string $attribute, mixed $value, \Closure $fail) use ($head) {
                if (! self::headsOf($head)->whereKey($value)->exists()) {
                    $fail("Choose a {$head}.");
                }
            }],
            "{$p}activity" => ['required', 'string', 'max:255'],
            "{$p}startDate" => ['required', 'date'],
            "{$p}targetDate" => ['required', 'date', "after_or_equal:{$p}startDate"],
        ];
    }

    /** @return array<string, string> */
    private static function phaseMessages(string $key, array $phase, ?string $prefix = null): array
    {
        $p = $prefix ?? "{$key}.";
        $title = strtolower($phase['title']);

        return [
            "{$p}headId.required" => "Assign the {$phase['head']}.",
            "{$p}activity.required" => "Enter the {$title} activity.",
            "{$p}activity.max" => 'The activity can be up to 255 characters.',
            "{$p}startDate.required" => "Enter the {$title} start date.",
            "{$p}targetDate.required" => "Enter the {$title} target completion date.",
            "{$p}targetDate.after_or_equal" => 'The target completion date cannot be before the start date.',
        ];
    }

    /** Active employees with the given position. @return Builder<Employee> */
    private static function headsOf(string $position): Builder
    {
        return Employee::query()
            ->where('employee_status', 'active')
            ->whereHas('position', fn (Builder $q) => $q->where('position_name', $position));
    }

    /** @return array{0: Carbon, 1: Carbon} the start of the first day and the end of the last. */
    private static function dates(array $phase): array
    {
        return [
            Carbon::parse($phase['startDate'], ConsultationScheduler::TIMEZONE)->startOfDay(),
            Carbon::parse($phase['targetDate'], ConsultationScheduler::TIMEZONE)->endOfDay(),
        ];
    }

    private static function ensureOpen(Project $project, ?string $required = null): void
    {
        $project->loadMissing('status');
        $status = $project->status->status_name;

        if ($required !== null && $status !== $required) {
            throw ValidationException::withMessages(['schedule' => 'Fabrication can be scheduled once the contract is verified and the down payment is paid.']);
        }
        if (in_array($status, [ProjectStatus::COMPLETED, ProjectStatus::CANCELLED], true)) {
            throw ValidationException::withMessages(['schedule' => 'This project is '.strtolower($status).'.']);
        }
    }
}