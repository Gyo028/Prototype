<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ConsultationRequest;
use App\Models\Customer;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ServiceRequest;
use App\Services\ConsultationScheduler;
use App\Services\ProjectProgress;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Customer > My Projects (Plan Project, customer side).
 *
 * index(): every request the customer submitted. Approved ones have a
 * project and open its folder; pending and rejected ones are listed so the
 * customer can see what they sent.
 *
 * show(): the project folder. Stage tabs: Consultation, Ocular Visit,
 * Design, Contract, Execution. Only Consultation works for now.
 */
class ProjectController extends Controller
{
    public function __construct(
        private ConsultationScheduler $scheduler,
        private ProjectProgress $progress,
    ) {}

    public function index(Request $request): Response
    {
        $customer = Customer::query()->where('user_id', $request->user()->id)->first();

        $requests = $customer === null ? collect() : $customer->serviceRequests()
            ->with(['eventType', 'project.status', 'project.schedules', 'project.serviceRequest'])
            ->latest('service_request_id')
            ->get();

        return Inertia::render('customer/projects', [
            'profileMissing' => $customer === null,
            'items' => $requests->map(fn (ServiceRequest $r) => [
                'requestId' => $r->service_request_id,
                'requestCode' => self::requestCode($r),
                'projectId' => $r->project?->project_id,
                'projectCode' => $r->project ? self::projectCode($r->project) : null,
                'title' => self::titleOf($r),
                'requestType' => $r->request_type,
                'startDate' => $r->start_date->toDateString(),
                'endDate' => $r->end_date->toDateString(),
                'startTime' => $r->event_start_time ? substr($r->event_start_time, 0, 5) : null,
                'endTime' => $r->event_end_time ? substr($r->event_end_time, 0, 5) : null,
                'venue' => $r->venue,
                'requestStatus' => $r->request_status,
                'requestDate' => $r->request_date->toDateString(),
                'status' => $r->project ? self::statusOf($r->project) : null,
                'nextAction' => $this->listAction($r),
            ])->values(),
        ]);
    }

    public function show(Request $request, Project $project): Response
    {
        self::ensureOwned($request, $project);

        $project->load(['serviceRequest.eventType', 'status', 'schedules']);
        $r = $project->serviceRequest;

        $current = $this->scheduler->current($project);
        $history = $project->schedules()
            ->with('changedBy')
            ->where('schedule_type', ProjectSchedule::TYPE_CONSULTATION)
            ->when($current, fn ($q) => $q->where('schedule_id', '!=', $current->schedule_id))
            ->latest('start_datetime')
            ->get();

        $bookingBlocked = $this->scheduler->bookingBlockedReason($project);
        $changeBlocked = $current ? $this->scheduler->changeBlockedReason($project, $current) : null;
        $needsSlots = $bookingBlocked === null || ($current !== null && $changeBlocked === null);

        $progress = $this->progress->for($project);

        return Inertia::render('customer/project-show', [
            'project' => [
                'id' => $project->project_id,
                'requestId' => $r->service_request_id,
                'code' => self::projectCode($project),
                'requestCode' => self::requestCode($r),
                'title' => self::titleOf($r),
                'requestType' => $r->request_type,
                'startDate' => $r->start_date->toDateString(),
                'endDate' => $r->end_date->toDateString(),
                'startTime' => $r->event_start_time ? substr($r->event_start_time, 0, 5) : null,
                'endTime' => $r->event_end_time ? substr($r->event_end_time, 0, 5) : null,
                'venue' => $r->venue,
                'guests' => $r->guest_count,
                'budgetMin' => (float) $r->budget_min,
                'budgetMax' => $r->budget_max === null ? null : (float) $r->budget_max,
                'status' => self::statusOf($project),
                'decision' => $project->customer_proceed_decision,
            ],
            'steps' => $progress['steps'],
            'currentStep' => $progress['currentStep'],
            'nextAction' => $progress['nextAction'],
            'consultation' => [
                'current' => $current ? $this->scheduleData($current, $request) : null,
                'history' => $history->map(fn (ProjectSchedule $s) => $this->scheduleData($s, $request))->values(),
                'canBook' => $bookingBlocked === null,
                'bookingBlockedReason' => $current ? null : $bookingBlocked,
                'canChange' => $current !== null && $changeBlocked === null,
                'changeBlockedReason' => $changeBlocked,
            ],
            'availableSlots' => $needsSlots ? $this->scheduler->availableSlots($project) : (object) [],
            'rules' => [
                'earliestDate' => $this->scheduler->earliestDate()->toDateString(),
                'latestDate' => $this->scheduler->latestDate($project)->toDateString(),
                'leadDays' => ConsultationScheduler::LEAD_DAYS,
                'changeCutoffDays' => ConsultationScheduler::CHANGE_CUTOFF_DAYS,
                'reasonMax' => ConsultationRequest::REASON_MAX,
            ],
        ]);
    }

    /**
     * The "What to do now" line on My Projects: the project's next action, or
     * the review status of a request that has no project yet.
     *
     * @return array{title: string, detail: string, actionNeeded: bool}|null
     */
    private function listAction(ServiceRequest $r): ?array
    {
        if ($r->project) {
            return $this->progress->for($r->project)['nextAction'];
        }

        return $r->request_status === ServiceRequest::STATUS_PENDING
            ? ['title' => 'Waiting for review', 'detail' => 'Our Project Manager is reviewing your request.', 'actionNeeded' => false]
            : null;
    }

    /** Projects belong to the customer whose request created them; anyone else gets a 404. */
    public static function ensureOwned(Request $request, Project $project): void
    {
        $ownerUserId = Customer::query()
            ->whereKey($project->serviceRequest()->value('customer_id'))
            ->value('user_id');

        abort_unless($ownerUserId !== null && (int) $ownerUserId === (int) $request->user()->id, 404);
    }

    public static function requestCode(ServiceRequest $r): string
    {
        return sprintf('REQ-%04d', $r->service_request_id);
    }

    public static function projectCode(Project $p): string
    {
        return sprintf('PRJ-%04d', $p->project_id);
    }

    /** Custom: the project title. Standard: the event type, e.g. "Wedding". */
    public static function titleOf(ServiceRequest $r): string
    {
        return $r->isCustom() ? (string) $r->project_title : ($r->eventType?->event_type_name ?? 'Event');
    }

    /** @return array{name: string, phase: string, onHold: bool, terminal: bool} */
    public static function statusOf(Project $p): array
    {
        return [
            'name' => $p->status->status_name,
            'phase' => $p->status->phaseLabel(),
            'onHold' => $p->isOnHold(),
            'terminal' => $p->status->is_terminal,
        ];
    }

    /** @return array<string, mixed> */
    private function scheduleData(ProjectSchedule $s, Request $request): array
    {
        $changedBy = null;

        if ($s->changed_by !== null) {
            $changedBy = (int) $s->changed_by === (int) $request->user()->id
                ? 'You'
                : ($s->changedBy?->role?->label() ?? 'Staff');
        }

        return [
            'id' => $s->schedule_id,
            'date' => $s->start_datetime->toDateString(),
            'startTime' => $s->start_datetime->format('H:i'),
            'endTime' => $s->end_datetime->format('H:i'),
            'meetingMode' => $s->meeting_mode,
            'status' => $s->schedule_status,
            'remarks' => $s->remarks,
            'changedBy' => $changedBy,
        ];
    }
}
