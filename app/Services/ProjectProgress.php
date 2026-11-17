<?php

namespace App\Services;

use App\Models\Billing;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\SiteAccessDocument;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * The customer's 8-step timeline for a project, worked out from its status
 * and schedules. The page only shows what this returns.
 *
 *   Planning:  1 Consultation · 2 Reservation Fee · 3 Ocular Visit · 4 Design · 5 Contract
 *   Execution: 6 Fabrication · 7 Installation
 *   Closed:    8 Completed
 *
 * Step states:
 *  - done       finished; can be opened (read-only)
 *  - current    where the project is now
 *  - locked     not reached yet; can't be opened
 *  - skipped    not needed (an ocular visit the consultation said wasn't required)
 *  - cancelled  where a cancelled project stopped
 *
 * "On Hold" is not a step state: the current step shows it in its next action.
 */
class ProjectProgress
{
    public const STEPS = [
        'consultation' => ['Consultation', 'planning', 'Meet our Project Manager to talk through your event and requirements.'],
        'reservation_fee' => ['Reservation Fee', 'planning', 'Pay 10% of your budget to reserve your date. Your date is confirmed once the payment is verified.'],
        'ocular_visit' => ['Ocular Visit', 'planning', 'Our team visits your venue to take measurements and check the site.'],
        'design' => ['Design', 'planning', 'Our Design Specialist prepares your design proposal and final quotation for your approval.'],
        'contract' => ['Contract', 'planning', 'Review and sign your project contract.'],
        'fabrication' => ['Fabrication', 'execution', 'We build and prepare the pieces for your event.'],
        'installation' => ['Installation', 'execution', 'We set up at your venue, ready for your event.'],
        'completed' => ['Completed', 'closed', 'Your event is done. Thank you for choosing us!'],
    ];

    public const DONE = 'done';

    public const CURRENT = 'current';

    public const LOCKED = 'locked';

    public const SKIPPED = 'skipped';

    public const CANCELLED = 'cancelled';

    /**
     * @return array{
     *     steps: list<array{key: string, label: string, phase: string, description: string, state: string, note: string|null, summary: string|null, details: list<array{label: string, value: string}>}>,
     *     currentStep: string,
     *     nextAction: array{title: string, detail: string, actionNeeded: bool}
     * }
     */
    public function for(Project $project): array
    {
        $project->loadMissing(['status', 'serviceRequest', 'schedules.outcome', 'reservationFee.payments', 'siteAccessDocuments']);
        $schedules = $project->schedules;
        $keys = array_keys(self::STEPS);

        $statusName = $project->status->status_name;
        $cancelled = $statusName === ProjectStatus::CANCELLED;
        $completed = $statusName === ProjectStatus::COMPLETED;
        $current = $this->currentIndex($project, $schedules);
        $ocularSkipped = $project->ocular_visit_required === false;
        $ocularIndex = array_search('ocular_visit', $keys, true);

        $steps = [];

        foreach ($keys as $i => $key) {
            [$label, $phase, $description] = self::STEPS[$key];

            $state = match (true) {
                $cancelled && $i === $current => self::CANCELLED,
                $i === $ocularIndex && $ocularSkipped && $i < $current => self::SKIPPED,
                $i < $current, $completed => self::DONE,
                $i === $current => self::CURRENT,
                default => self::LOCKED,
            };

            $note = $this->note($key, $state, $project, $schedules);

            $steps[] = [
                'key' => $key,
                'label' => $label,
                'phase' => $phase,
                'description' => $description,
                'state' => $state,
                // Short line under the step in the timeline.
                'note' => $note,
                // One line on the folded card.
                'summary' => $this->summary($key, $state, $note, $project),
                // Label/value rows on the open card (Consultation has its own panel).
                'details' => $state === self::LOCKED ? [] : $this->details($key, $state, $project, $schedules),
            ];
        }

        return [
            'steps' => $steps,
            'currentStep' => $keys[$current],
            'nextAction' => $this->nextAction($keys[$current], $project, $schedules),
        ];
    }

    /** Which step the project is on (0–7). */
    private function currentIndex(Project $project, Collection $schedules): int
    {
        $held = $this->latest($schedules, ProjectSchedule::TYPE_CONSULTATION, ProjectSchedule::STATUS_COMPLETED);

        return match ($project->status->status_name) {
            // After the consultation, a "proceed" decision moves the customer on to the fee.
            ProjectStatus::CONSULTATION => $held && $project->customer_proceed_decision === Project::DECISION_PROCEED ? 1 : 0,
            // Paid. Next is the ocular visit, or design when no visit is needed.
            ProjectStatus::BOOKED => $project->ocular_visit_required === false ? 3 : 2,
            ProjectStatus::SITE_ASSESSMENT => 2,
            ProjectStatus::DESIGNING => 3,
            ProjectStatus::CONTRACT => 4,
            ProjectStatus::FABRICATING => 5,
            ProjectStatus::INSTALLING => 6,
            ProjectStatus::COMPLETED => 7,
            // Cancelled: at the reservation fee if it went unpaid, at the design step if a
            // designer was already assigned, otherwise at the consultation.
            default => $project->reservationFee?->status === Billing::STATUS_OVERDUE ? 1 : ($project->design_specialist_id ? 3 : 0),
        };
    }

    /** The short line under a step in the timeline. */
    private function note(string $key, string $state, Project $project, Collection $schedules): ?string
    {
        if ($state === self::LOCKED) {
            return null;
        }

        if ($state === self::SKIPPED) {
            return 'Not needed';
        }

        if ($state === self::CANCELLED) {
            return 'Cancelled';
        }

        $done = $state === self::DONE;

        return match ($key) {
            'consultation' => ($s = $this->latest($schedules, ProjectSchedule::TYPE_CONSULTATION, ProjectSchedule::STATUS_COMPLETED))
                ? 'Held '.$this->day($s->start_datetime)
                : (($s = $this->active($schedules, ProjectSchedule::TYPE_CONSULTATION)) ? 'Booked for '.$this->day($s->start_datetime) : null),
            'reservation_fee' => $this->feeNote($project, $done),
            'ocular_visit' => ($s = $this->latest($schedules, ProjectSchedule::TYPE_OCULAR_VISIT, ProjectSchedule::STATUS_COMPLETED))
                ? 'Visited '.$this->day($s->start_datetime)
                : (($s = $this->active($schedules, ProjectSchedule::TYPE_OCULAR_VISIT)) ? 'Booked for '.$this->day($s->start_datetime) : null),
            'design' => $done ? 'Approved' : null,
            'contract' => $done ? 'Signed' : null,
            'fabrication', 'installation' => ($s = $this->latest($schedules, $key))
                ? ($done ? 'Done '.$this->day($s->end_datetime) : $this->range($s))
                : null,
            'completed' => ($event = $this->latest($schedules, ProjectSchedule::TYPE_EVENT)) ? 'Event on '.$this->day($event->start_datetime) : null,
            default => null,
        };
    }

    /** Timeline note for the reservation fee: due date, sent, or paid. */
    private function feeNote(Project $project, bool $done): ?string
    {
        $bill = $project->reservationFee;

        if ($bill === null) {
            return $done ? 'Verified' : $this->peso($project->serviceRequest->reservationFee());
        }

        if ($paid = $bill->payments->firstWhere('status', Payment::STATUS_VERIFIED)) {
            return 'Paid '.$this->day($paid->payment_date);
        }

        if ($done) {
            return 'Verified';
        }

        if ($bill->payments->contains('status', Payment::STATUS_SUBMITTED)) {
            return 'Payment sent';
        }

        return $this->peso((float) $bill->amount).' · due '.$this->day($bill->due_date);
    }

    /** The folded card's line: the note, plus the decision for the consultation. */
    private function summary(string $key, string $state, ?string $note, Project $project): ?string
    {
        if ($state === self::LOCKED) {
            return null;
        }

        if ($key === 'consultation' && $project->customer_proceed_decision !== null) {
            $decision = [
                Project::DECISION_PROCEED => 'You decided to proceed',
                Project::DECISION_HOLD => 'On hold',
                Project::DECISION_CANCELLED => 'You decided not to proceed',
            ][$project->customer_proceed_decision];

            return $note ? "{$note} · {$decision}" : $decision;
        }

        return $note;
    }

    /**
     * What happened in a step, as label/value rows. Steps that are not built
     * yet (payments, design proposals, contracts) only show their status.
     *
     * @return list<array{label: string, value: string}>
     */
    private function details(string $key, string $state, Project $project, Collection $schedules): array
    {
        $row = fn (string $label, string $value) => ['label' => $label, 'value' => $value];
        $done = $state === self::DONE;

        switch ($key) {
            case 'reservation_fee':
                $bill = $project->reservationFee;

                if ($bill === null) {
                    return [
                        $row('Amount', $this->peso($project->serviceRequest->reservationFee()).' (10% of your budget)'),
                        $row('Status', $done ? 'Paid and verified' : 'To be billed'),
                    ];
                }

                $paid = $bill->payments->firstWhere('status', Payment::STATUS_VERIFIED);

                return array_values(array_filter([
                    $row('Amount', $this->peso((float) $bill->amount).' (10% of your budget)'),
                    $row('Due date', $this->day($bill->due_date, true)),
                    $row('Status', match (true) {
                        $done || $paid !== null => 'Paid and verified',
                        $bill->status === Billing::STATUS_OVERDUE => 'Not paid by the due date',
                        $bill->payments->contains('status', Payment::STATUS_SUBMITTED) => 'Payment sent, waiting for verification',
                        default => 'Waiting for your payment',
                    }),
                    $paid ? $row('Paid on', $this->day($paid->payment_date, true).' · GCash ref. '.$paid->payment_reference) : null,
                ]));

            case 'ocular_visit':
                if ($state === self::SKIPPED) {
                    return [$row('Status', 'Not needed: the consultation found that no site visit was required.')];
                }

                $visit = $this->latest($schedules, ProjectSchedule::TYPE_OCULAR_VISIT, ProjectSchedule::STATUS_COMPLETED)
                    ?? $this->active($schedules, ProjectSchedule::TYPE_OCULAR_VISIT);

                if ($visit === null) {
                    return [];
                }

                $rows = $this->scheduleRows($visit, match ($visit->schedule_status) {
                    ProjectSchedule::STATUS_COMPLETED => 'Visited',
                    ProjectSchedule::STATUS_PENDING => 'Pending document review',
                    default => 'Booked',
                });

                if ($visit->outcome) {
                    $rows[] = $row('Site assessment', 'Recorded '.$this->day($visit->outcome->recorded_at, true));
                }

                return $rows;

            case 'design':
                return $done ? [$row('Status', 'Design proposal and quotation approved')] : [];

            case 'contract':
                return $done ? [$row('Status', 'Contract signed and verified')] : [];

            case 'fabrication':
            case 'installation':
                $work = $this->latest($schedules, $key);

                if ($work === null) {
                    return [];
                }

                $status = match ($work->schedule_status) {
                    ProjectSchedule::STATUS_COMPLETED => 'Done',
                    ProjectSchedule::STATUS_CONFIRMED => $state === self::CURRENT ? 'In progress' : 'Scheduled',
                    default => 'Scheduled',
                };

                return [$row('Dates', $this->range($work, true)), $row('Status', $status)];

            case 'completed':
                $event = $this->latest($schedules, ProjectSchedule::TYPE_EVENT);

                return $event ? [$row('Event', $this->day($event->start_datetime, true))] : [];

            default:
                return [];
        }
    }

    /** @return list<array{label: string, value: string}> */
    private function scheduleRows(ProjectSchedule $s, string $status): array
    {
        return [
            ['label' => 'Date', 'value' => $this->day($s->start_datetime, true)],
            ['label' => 'Time', 'value' => $s->start_datetime->format('g:i A').' – '.$s->end_datetime->format('g:i A')],
            ['label' => 'Status', 'value' => $status],
        ];
    }

    /** @return array{title: string, detail: string, actionNeeded: bool} */
    private function nextAction(string $step, Project $project, Collection $schedules): array
    {
        $action = fn (string $title, string $detail, bool $needed = false) => ['title' => $title, 'detail' => $detail, 'actionNeeded' => $needed];

        if ($project->status->status_name === ProjectStatus::CANCELLED) {
            $bill = $project->reservationFee;

            return $action(
                'This project was cancelled',
                $bill?->status === Billing::STATUS_OVERDUE
                    ? 'The reservation fee was not paid by '.$this->day($bill->due_date, true).'. Contact us if you would like to start a new request.'
                    : 'Contact us if you would like to start a new request.',
            );
        }

        if ($project->isOnHold()) {
            return $action('Your project is on hold', 'Let our Project Manager know when you are ready to continue.');
        }

        switch ($step) {
            case 'consultation':
                if ($s = $this->active($schedules, ProjectSchedule::TYPE_CONSULTATION)) {
                    $mode = $s->meeting_mode === ProjectSchedule::MODE_ONLINE ? 'online' : 'face to face';

                    return $action('Attend your consultation', $this->day($s->start_datetime, true).' at '.$s->start_datetime->format('g:i A').", {$mode}.");
                }

                if ($this->latest($schedules, ProjectSchedule::TYPE_CONSULTATION, ProjectSchedule::STATUS_COMPLETED)) {
                    return $action('Waiting for your consultation outcome', 'Our Project Manager is recording the results of your consultation.');
                }

                return $action('Book your consultation', 'Pick a date and time to meet our Project Manager.', true);

            case 'reservation_fee':
                $bill = $project->reservationFee;

                if ($bill === null) {
                    return $action(
                        'Your reservation fee bill is being prepared',
                        $this->peso($project->serviceRequest->reservationFee()).' (10% of your budget). You will be able to pay it here.',
                    );
                }

                $latest = $bill->payments->sortByDesc('payment_id')->first();
                $due = $this->day($bill->due_date, true);

                if ($latest?->status === Payment::STATUS_SUBMITTED) {
                    return $action('Waiting for payment verification', 'We received your GCash payment. Our Project Manager will verify it soon.');
                }

                if ($latest?->status === Payment::STATUS_REJECTED) {
                    return $action(
                        'Your payment was not accepted',
                        ($latest->remarks ? "Reason: {$latest->remarks}. " : '').'Please submit your payment again by '.$due.'.',
                        true,
                    );
                }

                return $action('Pay your reservation fee', $this->peso((float) $bill->amount)." by GCash, due {$due}. Your event date is confirmed once it is verified.", true);

            case 'ocular_visit':
                if ($project->ocular_visit_required !== true) {
                    return $action('Waiting for the Project Manager', 'We are confirming whether a site visit is needed for your venue.');
                }

                if ($s = $this->active($schedules, ProjectSchedule::TYPE_OCULAR_VISIT)) {
                    if ($s->schedule_status === ProjectSchedule::STATUS_PENDING) {
                        return $this->documentsAction($project, $s);
                    }

                    return $action(
                        'Attend your ocular visit',
                        $this->day($s->start_datetime, true).', '.$s->start_datetime->format('g:i A').' – '.$s->end_datetime->format('g:i A').', at '.$project->serviceRequest->venue.'.',
                    );
                }

                if ($held = $this->latest($schedules, ProjectSchedule::TYPE_OCULAR_VISIT, ProjectSchedule::STATUS_COMPLETED)) {
                    return $held->outcome
                        ? $action('Your site assessment is ready', 'See the report and venue photos below. A Design Specialist will be assigned next.')
                        : $action('Waiting for the site assessment', 'Our team is writing up what they found at your venue.');
                }

                return $action('Book your ocular visit', 'Pick a date and time for our team to visit your venue.', true);

            case 'design':
                return $action(
                    'Waiting for your design proposal',
                    $project->design_specialist_id ? 'Our Design Specialist is working on it.' : 'A Design Specialist will be assigned to your project.',
                );

            case 'contract':
                return $action('Waiting for your contract', 'Your final billing and contract are being prepared.');

            case 'fabrication':
                $install = $this->latest($schedules, ProjectSchedule::TYPE_INSTALLATION);

                return $action('Nothing needed from you', "We're making the pieces for your event.".($install ? ' Installation: '.$this->range($install).'.' : ''));

            case 'installation':
                $event = $this->latest($schedules, ProjectSchedule::TYPE_EVENT);

                return $action('Nothing needed from you', "We're setting up at your venue.".($event ? ' Your event: '.$this->day($event->start_datetime, true).'.' : ''));

            default:
                return $action('Your project is complete', 'Thank you! Ratings and reviews will open here soon.');
        }
    }

    /**
     * A pending visit at a third-party venue: upload the documents, or wait for
     * the Project Manager to review them.
     *
     * @return array{title: string, detail: string, actionNeeded: bool}
     */
    private function documentsAction(Project $project, ProjectSchedule $visit): array
    {
        $when = $this->day($visit->start_datetime, true).', '.$visit->start_datetime->format('g:i A');
        $current = $project->siteAccessDocuments->whereNull('replaced_at');

        $missing = [];
        $rejected = [];

        foreach (SiteAccessDocument::TYPES as $type => $label) {
            $doc = $current->firstWhere('document_type', $type);

            if ($doc === null) {
                $missing[] = strtolower($label);
            } elseif ($doc->status === SiteAccessDocument::STATUS_REJECTED) {
                $rejected[] = strtolower($label).($doc->remarks ? " ({$doc->remarks})" : '');
            }
        }

        if ($missing !== [] || $rejected !== []) {
            $parts = array_filter([
                $missing ? 'Still needed: '.implode(' and ', $missing).'.' : null,
                $rejected ? 'Not accepted: '.implode('; ', $rejected).'.' : null,
            ]);

            return [
                'title' => 'Upload your site access documents',
                'detail' => "Your visit on {$when} is pending until our Project Manager approves them. ".implode(' ', $parts),
                'actionNeeded' => true,
            ];
        }

        return [
            'title' => 'Waiting for document review',
            'detail' => "Our Project Manager is checking your authorization letter and venue permit. Your visit on {$when} is confirmed once they are approved.",
            'actionNeeded' => false,
        ];
    }

    /** The latest schedule of a type (optionally with a status). */
    private function latest(Collection $schedules, string $type, ?string $status = null): ?ProjectSchedule
    {
        return $schedules
            ->where('schedule_type', $type)
            ->when($status !== null, fn ($c) => $c->where('schedule_status', $status))
            ->sortByDesc('start_datetime')
            ->first();
    }

    /** The booked (not yet held) schedule of a type. */
    private function active(Collection $schedules, string $type): ?ProjectSchedule
    {
        return $schedules
            ->where('schedule_type', $type)
            ->whereIn('schedule_status', ProjectSchedule::ACTIVE_STATUSES)
            ->sortByDesc('start_datetime')
            ->first();
    }

    /** "Nov 23" or, long, "Mon, Nov 23, 2026". */
    private function day(CarbonInterface $date, bool $long = false): string
    {
        return $date->format($long ? 'D, M j, Y' : 'M j');
    }

    /** "Dec 4" or "Dec 4 – Dec 6" (long: with weekday and year). */
    private function range(ProjectSchedule $s, bool $long = false): string
    {
        $start = $this->day($s->start_datetime, $long);
        $end = $this->day($s->end_datetime, $long);

        return $start === $end ? $start : "{$start} – {$end}";
    }

    private function peso(float $amount): string
    {
        return '₱'.number_format($amount, $amount == floor($amount) ? 0 : 2);
    }
}
