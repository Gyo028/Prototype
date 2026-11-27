<?php

namespace App\Services;

use App\Http\Controllers\Customer\ProjectController;
use App\Models\Billing;
use App\Models\Customer;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ServiceRequest;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * What the customer's dashboard shows, across all of their projects:
 *
 *  - countdown   the next event (date, venue, where the project is)
 *  - actions     what is waiting on the customer, from each project's next action
 *                (the page shows 3 at a time)
 *  - upcoming    the next 3 consultations and ocular visits, within 30 days
 *  - pending     requests still waiting for the Project Manager's review
 *
 * A customer with no requests yet gets none of these: the page shows
 * "Start your first project" and how it works instead.
 *
 * Schedules hold Manila wall-clock times, so they
 * are sent as date and time strings.
 */
class CustomerDashboard
{
    public const UPCOMING_DAYS = 30;

    public const MAX_UPCOMING = 3;

    public function __construct(
        private ProjectProgress $progress,
        private ReservationFees $fees,
    ) {}

    /** @return array<string, mixed> */
    public function for(?Customer $customer): array
    {
        if ($customer === null) {
            return $this->empty(null);
        }

        // Unpaid reservation fees past their due date cancel the project first (as on My Projects).
        $this->fees->cancelOverdue($customer->customer_id);

        $requests = $customer->serviceRequests()
            ->with([
                'eventType',
                'customer',
                'project.status',
                'project.serviceRequest.eventType',
                'project.serviceRequest.customer',
                'project.schedules.outcome',
                'project.billings.payments',
                'project.reservationFee.payments',
                'project.downPayment.payments',
                'project.siteAccessDocuments',
                'project.designProposals',
                'project.contracts',
            ])
            ->latest('service_request_id')
            ->get();

        if ($requests->isEmpty()) {
            return $this->empty($customer);
        }

        /** @var Collection<int, Project> $projects */
        $projects = $requests->pluck('project')->filter()->values();
        $open = $projects->reject(fn (Project $p) => $p->status->is_terminal)->values();

        return [
            'firstName' => $customer->first_name,
            'hasRequests' => true,
            'countdown' => $this->countdown($open),
            'actions' => $this->actions($open),
            'pending' => $requests
                ->where('request_status', ServiceRequest::STATUS_PENDING)
                ->map(fn (ServiceRequest $r) => [
                    'code' => ProjectController::requestCode($r),
                    'title' => ProjectController::titleOf($r),
                    'submittedOn' => $r->request_date->toDateString(),
                    'url' => "/customer/requests/{$r->service_request_id}",
                ])->values(),
            'upcoming' => $this->upcoming($open),
        ];
    }

    /** @return array<string, mixed> */
    private function empty(?Customer $customer): array
    {
        return [
            'firstName' => $customer?->first_name,
            'hasRequests' => false,
            'countdown' => null,
            'actions' => [],
            'pending' => [],
            'upcoming' => [],
        ];
    }

    private function today(): Carbon
    {
        return Carbon::now(AppointmentScheduler::TIMEZONE)->startOfDay();
    }

    /** The day of a schedule as Manila wall-clock time. */
    private function dayOf(CarbonInterface $datetime): Carbon
    {
        return Carbon::parse($datetime->toDateString(), AppointmentScheduler::TIMEZONE);
    }

    /** @return array{code: string, title: string, url: string} */
    private function projectRef(Project $p): array
    {
        return [
            'code' => ProjectController::projectCode($p),
            'title' => ProjectController::titleOf($p->serviceRequest),
            'url' => "/customer/projects/{$p->project_id}",
        ];
    }

    /**
     * The next event among the open projects (today or later).
     *
     * @param  Collection<int, Project>  $open
     * @return array<string, mixed>|null
     */
    private function countdown(Collection $open): ?array
    {
        $today = $this->today();

        $next = $open
            ->map(fn (Project $p) => [$p, $this->eventOf($p)])
            ->filter(fn (array $pair) => $pair[1] !== null && $this->dayOf($pair[1]->start_datetime)->gte($today))
            ->sortBy(fn (array $pair) => $pair[1]->start_datetime->toDateTimeString())
            ->first();

        if ($next === null) {
            return null;
        }

        /** @var Project $project */
        /** @var ProjectSchedule $event */
        [$project, $event] = $next;
        $progress = $this->progress->for($project);
        $steps = collect($progress['steps']);
        $currentIndex = (int) $steps->search(fn (array $s) => $s['key'] === $progress['currentStep']);

        return [
            ...$this->projectRef($project),
            'date' => $event->start_datetime->toDateString(),
            'startTime' => $event->start_datetime->format('H:i'),
            'endTime' => $event->end_datetime->format('H:i'),
            'endDate' => $event->end_datetime->toDateString(),
            'venue' => $project->serviceRequest->venue,
            'daysLeft' => (int) $today->diffInDays($this->dayOf($event->start_datetime)),
            'steps' => $steps->map(fn (array $s) => ['label' => $s['label'], 'state' => $s['state']])->values(),
            'currentStep' => $steps[$currentIndex]['label'],
            'currentNumber' => $currentIndex + 1,
            'onHold' => $project->isOnHold(),
        ];
    }

    private function eventOf(Project $p): ?ProjectSchedule
    {
        return $p->schedules
            ->where('schedule_type', ProjectSchedule::TYPE_EVENT)
            ->where('schedule_status', '!=', ProjectSchedule::STATUS_CANCELLED)
            ->sortByDesc('schedule_id')
            ->first();
    }

    /**
     * Everything waiting on the customer: each open project's next action, when
     * it needs them. Soonest event first.
     *
     * @param  Collection<int, Project>  $open
     * @return list<array<string, mixed>>
     */
    private function actions(Collection $open): array
    {
        return $open
            ->sortBy(fn (Project $p) => $this->eventOf($p)?->start_datetime->toDateTimeString() ?? '9999')
            ->map(function (Project $p) {
                $action = $this->progress->for($p)['nextAction'];

                if (! $action['actionNeeded']) {
                    return null;
                }

                $project = $this->projectRef($p);
                $bill = $action['billId'] !== null ? $p->billings->firstWhere('billing_id', $action['billId']) : null;

                return [
                    'projectCode' => $project['code'],
                    'projectTitle' => $project['title'],
                    'title' => $action['title'],
                    'note' => $this->note($action, $bill),
                    'button' => $action['button'] ?? 'Open',
                    'payment' => $action['billId'] !== null,
                    // A payment opens its bill; anything else opens the project on its current step.
                    'url' => $action['billId'] !== null ? "/customer/billing/{$action['billId']}" : $project['url'],
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    /**
     * One short line under the project: the amount and due date for a payment,
     * else a hint of what to do.
     *
     * @param  array{title: string, detail: string, actionNeeded: bool, button: string|null, billId: int|null}  $action
     */
    private function note(array $action, ?Billing $bill): string
    {
        if ($bill !== null) {
            return $this->peso((float) $bill->amount).' · Due '.$bill->due_date->format('M j, Y');
        }

        return match ($action['button']) {
            'Book now' => str_contains($action['title'], 'ocular')
                ? 'Pick a date for our visit to your venue'
                : 'Pick a date to meet our Project Manager',
            'Upload documents' => 'Authorization letter and venue permit, before your visit',
            'Review design' => 'Approve it or ask for changes',
            'Sign contract' => str_contains($action['title'], 'not accepted')
                ? 'Please review and sign it again'
                : 'Sign it here or upload a signed copy',
            default => $action['detail'],
        };
    }

    /**
     * The next 3 consultations and ocular visits, within 30 days. Event days are
     * left out: the countdown shows the next one.
     *
     * @param  Collection<int, Project>  $open
     * @return list<array<string, mixed>>
     */
    private function upcoming(Collection $open): array
    {
        $today = $this->today();
        $until = $today->copy()->addDays(self::UPCOMING_DAYS);
        $types = [ProjectSchedule::TYPE_CONSULTATION, ProjectSchedule::TYPE_OCULAR_VISIT];

        return $open
            ->flatMap(fn (Project $p) => $p->schedules
                ->whereIn('schedule_type', $types)
                ->whereIn('schedule_status', ProjectSchedule::ACTIVE_STATUSES)
                ->filter(fn (ProjectSchedule $s) => $this->dayOf($s->start_datetime)->betweenIncluded($today, $until))
                ->map(fn (ProjectSchedule $s) => [
                    'id' => $s->schedule_id,
                    'type' => $s->schedule_type,
                    'date' => $s->start_datetime->toDateString(),
                    'startTime' => $s->start_datetime->format('H:i'),
                    'endTime' => $s->end_datetime->format('H:i'),
                    'where' => match (true) {
                        $s->schedule_type === ProjectSchedule::TYPE_OCULAR_VISIT => 'At the venue',
                        $s->meeting_mode === ProjectSchedule::MODE_ONLINE => 'Online',
                        $s->meeting_place !== null => 'Face to face · '.$s->meeting_place,
                        default => 'Face to face',
                    },
                    // A third-party venue's visit waits for the Project Manager to approve the documents.
                    'pending' => $s->schedule_status === ProjectSchedule::STATUS_PENDING,
                    ...$this->projectRef($p),
                ]))
            ->sortBy(fn (array $u) => $u['date'].' '.$u['startTime'])
            ->take(self::MAX_UPCOMING)
            ->values()
            ->all();
    }

    private function peso(float $amount): string
    {
        return '₱'.number_format($amount, $amount == floor($amount) ? 0 : 2);
    }
}
