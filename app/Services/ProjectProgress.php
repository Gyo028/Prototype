<?php

namespace App\Services;

use App\Models\Billing;
use App\Models\Contract;
use App\Models\DesignProposal;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\SiteAccessDocument;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * The customer's 7-step timeline for a project, worked out from its status
 * and schedules. The page only shows what this returns.
 *
 *   Planning:  1 Consultation · 2 Ocular Visit · 3 Design · 4 Contract
 *   Execution: 5 Fabrication · 6 Installation
 *   Closed:    7 Completed
 *
 * The reservation fee is a bill (Billing & Payments), not a step: after the
 * consultation the project moves to the Ocular Visit step (or Design, when no
 * visit is needed), which asks the customer to pay it first.
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
        $project->loadMissing(['status', 'serviceRequest', 'schedules.outcome', 'reservationFee.payments', 'siteAccessDocuments', 'designProposals', 'contracts', 'downPayment.payments']);
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

    /** Which step the project is on (0–6). */
    private function currentIndex(Project $project, Collection $schedules): int
    {
        $held = $this->latest($schedules, ProjectSchedule::TYPE_CONSULTATION, ProjectSchedule::STATUS_COMPLETED);
        // After the consultation: the ocular visit, or design when no visit is needed.
        $afterConsultation = $project->ocular_visit_required === false ? 2 : 1;

        return match ($project->status->status_name) {
            // A "proceed" decision moves the customer on; the reservation fee is paid there.
            ProjectStatus::CONSULTATION => $held && $project->customer_proceed_decision === Project::DECISION_PROCEED ? $afterConsultation : 0,
            ProjectStatus::BOOKED => $afterConsultation,
            ProjectStatus::SITE_ASSESSMENT => 1,
            ProjectStatus::DESIGNING => 2,
            ProjectStatus::CONTRACT => 3,
            ProjectStatus::FABRICATING => 4,
            ProjectStatus::INSTALLING => 5,
            ProjectStatus::COMPLETED => 6,
            // Cancelled: where the unpaid reservation fee stopped it, at the design step if a
            // designer was already assigned, otherwise at the consultation.
            default => match (true) {
                $project->reservationFee?->status === Billing::STATUS_OVERDUE => $afterConsultation,
                $project->design_specialist_id !== null => 2,
                default => 0,
            },
        };
    }

    /**
     * True while the reservation fee is the next thing to do: the customer chose
     * to proceed after the consultation, and the fee isn't verified yet.
     */
    public function feeOutstanding(Project $project): bool
    {
        $project->loadMissing(['status', 'schedules']);

        return $project->status->status_name === ProjectStatus::CONSULTATION
            && $project->customer_proceed_decision === Project::DECISION_PROCEED
            && $this->latest($project->schedules, ProjectSchedule::TYPE_CONSULTATION, ProjectSchedule::STATUS_COMPLETED) !== null;
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
            'ocular_visit' => $this->feeOutstanding($project) ? $this->feeNote($project) : (($s = $this->latest($schedules, ProjectSchedule::TYPE_OCULAR_VISIT, ProjectSchedule::STATUS_COMPLETED))
                ? 'Visited '.$this->day($s->start_datetime)
                : (($s = $this->active($schedules, ProjectSchedule::TYPE_OCULAR_VISIT)) ? 'Booked for '.$this->day($s->start_datetime) : null)),
            'design' => $this->feeOutstanding($project) ? $this->feeNote($project) : $this->designNote($project, $done),
            'contract' => $this->contractNote($project, $done),
            'fabrication', 'installation' => ($s = $this->latest($schedules, $key))
                ? ($done ? 'Done '.$this->day($s->end_datetime) : $this->range($s))
                : null,
            'completed' => ($event = $this->latest($schedules, ProjectSchedule::TYPE_EVENT)) ? 'Event on '.$this->day($event->start_datetime) : null,
            default => null,
        };
    }

    /** The version the customer approved, if any. */
    private function approvedProposal(Project $project): ?DesignProposal
    {
        return $project->designProposals->firstWhere('customer_decision', DesignProposal::APPROVED);
    }

    /** Timeline note for the design step: approved version, ready for review, or revision requested. */
    private function designNote(Project $project, bool $done): ?string
    {
        if ($approved = $this->approvedProposal($project)) {
            return 'Approved v'.$approved->version_number;
        }

        if ($done) {
            return 'Approved';
        }

        $latest = $project->designProposals->filter->isVisibleToCustomer()->sortBy('version_number')->last();

        return match ($latest?->customer_decision) {
            DesignProposal::PENDING => 'Ready for review · v'.$latest->version_number,
            DesignProposal::REVISION_REQUESTED => 'Revision requested',
            default => null,
        };
    }

    /** The newest contract version, if any. */
    private function latestContract(Project $project): ?Contract
    {
        return $project->contracts->sortBy('version_number')->last();
    }

    /** Timeline note for the contract: ready to sign, sent, verified, down payment. */
    private function contractNote(Project $project, bool $done): ?string
    {
        $contract = $this->latestContract($project);

        if ($done) {
            return $contract?->status === Contract::STATUS_VERIFIED && $contract->verified_at
                ? 'Verified '.$this->day($contract->verified_at)
                : 'Signed';
        }

        if ($contract === null) {
            return null;
        }

        if ($contract->status === Contract::STATUS_VERIFIED) {
            $bill = $project->downPayment;

            return match (true) {
                $bill === null => 'Verified',
                $bill->payments->contains('status', Payment::STATUS_VERIFIED) => 'Down payment paid',
                $bill->hasOpenDispute() => 'Down payment disputed',
                $bill->payments->contains('status', Payment::STATUS_SUBMITTED) => 'Down payment sent',
                default => 'Down payment due '.$this->day($bill->due_date),
            };
        }

        return match ($contract->status) {
            Contract::STATUS_SIGNED => 'Signed · in review',
            default => $contract->version_number > 1 ? 'Sign again · v'.$contract->version_number : 'Ready to sign',
        };
    }

    /** Timeline note while the reservation fee is outstanding: due, sent or disputed. */
    private function feeNote(Project $project): ?string
    {
        $bill = $project->reservationFee;

        if ($bill === null) {
            return 'Fee being prepared';
        }

        return match (true) {
            $bill->hasOpenDispute() => 'Fee disputed',
            $bill->payments->contains('status', Payment::STATUS_SUBMITTED) => 'Fee payment sent',
            default => 'Fee due '.$this->day($bill->due_date),
        };
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
                $approved = $this->approvedProposal($project);

                if ($approved) {
                    return [
                        $row('Version', 'Version '.$approved->version_number),
                        $row('Quotation', $this->peso((float) $approved->quotation_amount)),
                        $row('Approved on', $approved->decision_date ? $this->day($approved->decision_date, true) : '—'),
                    ];
                }

                return $done ? [$row('Status', 'Design proposal and quotation approved')] : [];

            case 'contract':
                $contract = $project->contracts->firstWhere('status', Contract::STATUS_VERIFIED);

                if ($contract === null) {
                    return $done ? [$row('Status', 'Contract signed and verified')] : [];
                }

                $down = $project->downPayment;
                $paid = $down?->payments->firstWhere('status', Payment::STATUS_VERIFIED);

                return array_values(array_filter([
                    $row('Contract', $contract->code().' · version '.$contract->version_number),
                    $contract->signed_at ? $row('Signed on', $this->day($contract->signed_at, true).($contract->sign_method === Contract::METHOD_ELECTRONIC ? ' · e-signed' : ' · signed copy uploaded')) : null,
                    $contract->verified_at ? $row('Verified on', $this->day($contract->verified_at, true)) : null,
                    $down ? $row('Down payment', $this->peso((float) $down->amount).($paid ? ' · paid '.$this->day($paid->payment_date, true) : ' · due '.$this->day($down->due_date, true))) : null,
                ]));

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

            case 'ocular_visit':
                if ($this->feeOutstanding($project)) {
                    return $this->feeAction($project, 'You can book your ocular visit once it is verified.');
                }

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
                if ($this->feeOutstanding($project)) {
                    return $this->feeAction($project, 'A Design Specialist is assigned to your project once it is verified.');
                }

                $latest = $project->designProposals->filter->isVisibleToCustomer()->sortBy('version_number')->last();

                if ($latest?->customer_decision === DesignProposal::PENDING) {
                    return $action(
                        'Review your design proposal',
                        'Version '.$latest->version_number.' is ready, with a quotation of '.$this->peso((float) $latest->quotation_amount).'. Approve it or ask for changes.',
                        true,
                    );
                }

                if ($latest?->customer_decision === DesignProposal::REVISION_REQUESTED) {
                    return $action('Revision in progress', 'Our Design Specialist is updating your design based on your comments.');
                }

                return $action(
                    'Waiting for your design proposal',
                    $project->design_specialist_id ? 'Our Design Specialist is working on it.' : 'A Design Specialist will be assigned to your project.',
                );

            case 'contract':
                return $this->contractAction($project);

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
     * The reservation fee, on the step after the consultation. $next says what
     * paying it unlocks.
     *
     * @return array{title: string, detail: string, actionNeeded: bool}
     */
    private function feeAction(Project $project, string $next): array
    {
        $action = fn (string $title, string $detail, bool $needed = false) => ['title' => $title, 'detail' => $detail, 'actionNeeded' => $needed];
        $bill = $project->reservationFee;

        if ($bill === null) {
            return $action(
                'Your reservation fee bill is being prepared',
                $this->peso($project->serviceRequest->reservationFee()).' (10% of your budget). You will be able to pay it on Billing & Payments.',
            );
        }

        $latest = $bill->payments->sortByDesc('payment_id')->first();
        $due = $this->day($bill->due_date, true);

        return match (true) {
            $bill->hasOpenDispute() => $action('Your reservation fee is disputed', 'Our Project Manager is reviewing your dispute. The bill is on hold until then.'),
            $latest?->status === Payment::STATUS_SUBMITTED => $action('Waiting for payment verification', "We received your reservation fee payment. {$next}"),
            $latest?->status === Payment::STATUS_REJECTED => $action(
                'Your payment was not accepted',
                ($latest->remarks ? 'Reason: '.rtrim($latest->remarks, '. ').'. ' : '')."Please pay your reservation fee again by {$due}.",
                true,
            ),
            default => $action('Pay your reservation fee', $this->peso((float) $bill->amount)." by GCash, due {$due}. {$next}", true),
        };
    }

    /**
     * The contract step: sign, wait for verification, then pay the down payment.
     *
     * @return array{title: string, detail: string, actionNeeded: bool}
     */
    private function contractAction(Project $project): array
    {
        $action = fn (string $title, string $detail, bool $needed = false) => ['title' => $title, 'detail' => $detail, 'actionNeeded' => $needed];
        $contract = $this->latestContract($project);

        if ($contract === null) {
            return $action('Waiting for your contract', 'Your contract is being prepared.');
        }

        if ($contract->status === Contract::STATUS_ISSUED) {
            $rejected = $project->contracts->firstWhere('version_number', $contract->version_number - 1);

            if ($rejected?->status === Contract::STATUS_REJECTED) {
                return $action(
                    'Your signed contract was not accepted',
                    ($rejected->rejection_reason ? 'Reason: '.rtrim($rejected->rejection_reason, '. ').'. ' : '').'Please review and sign the contract again.',
                    true,
                );
            }

            return $action('Review and sign your contract', 'Read the contract, then sign it here or upload a signed copy.', true);
        }

        if ($contract->status === Contract::STATUS_SIGNED) {
            return $action('Waiting for contract verification', 'Our Project Manager is checking your signed contract.');
        }

        $bill = $project->downPayment;

        if ($bill === null) {
            return $action('Your contract is verified', 'Your down payment bill is being prepared.');
        }

        $latest = $bill->payments->sortByDesc('payment_id')->first();
        $due = $this->day($bill->due_date, true);

        return match ($latest?->status) {
            Payment::STATUS_VERIFIED => $action('Getting ready for fabrication', 'Your contract and down payment are verified. We will start making the pieces for your event.'),
            Payment::STATUS_SUBMITTED => $action('Waiting for payment verification', 'We received your down payment. Our Project Manager will verify it soon.'),
            Payment::STATUS_REJECTED => $action(
                'Your payment was not accepted',
                ($latest->remarks ? "Reason: {$latest->remarks}. " : '').'Please submit your down payment again by '.$due.'.',
                true,
            ),
            default => $bill->hasOpenDispute()
                ? $action('Your down payment is disputed', 'Our Project Manager is reviewing your dispute. The bill is on hold until then.')
                : $action('Pay your down payment', $this->peso((float) $bill->amount)." by GCash, due {$due}. Work starts once it is verified.", true),
        };
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
