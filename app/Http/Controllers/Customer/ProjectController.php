<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ConsultationRequest;
use App\Models\AppointmentOutcomeFile;
use App\Models\Billing;
use App\Models\Contract;
use App\Models\Customer;
use App\Models\DesignProposal;
use App\Models\DesignProposalFile;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ServiceRequest;
use App\Models\SiteAccessDocument;
use App\Http\Requests\Customer\ContractUploadRequest;
use App\Services\Billings;
use App\Services\ConsultationScheduler;
use App\Services\Contracts;
use App\Services\DesignProposals;
use App\Services\ExecutionSchedules;
use App\Services\OcularVisitScheduler;
use App\Services\ProjectProgress;
use App\Services\ReservationFees;
use App\Services\SiteAccessDocuments;
use App\Support\PublicWebsite;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Inertia\Support\Header;

/**
 * Customer > My Projects (Plan Project, customer side).
 *
 * index(): every request the customer submitted. Approved ones have a
 * project and open its folder; pending and rejected ones are listed so the
 * customer can see what they sent.
 *
 * show(): the project folder: the 7-step timeline and what the customer can
 * do on each step (consultation, ocular visit, design and contract so far).
 * Bills are paid on Billing & Payments; the steps link to them.
 */
class ProjectController extends Controller
{
    public function __construct(
        private ConsultationScheduler $scheduler,
        private OcularVisitScheduler $ocular,
        private ProjectProgress $progress,
        private ReservationFees $fees,
        private SiteAccessDocuments $documents,
        private DesignProposals $proposals,
        private Contracts $contracts,
        private Billings $billings,
        private ExecutionSchedules $execution,
    ) {}

    public function index(Request $request): Response
    {
        $customer = Customer::query()->where('user_id', $request->user()->id)->first();

        // The table (code, title, date, status) comes with the page. What each request
        // needs next feeds only the "Action needed" filter and reads every project's
        // steps, so it is deferred: the browser fetches it right after the page appears.
        $loadingDeferred = $request->header(Header::PARTIAL_COMPONENT) === 'customer/projects';

        // Unpaid reservation fees past their due date cancel the project first (once, on the first request).
        if ($customer !== null && ! $loadingDeferred) {
            $this->fees->cancelOverdue($customer->customer_id);
        }

        $requests = $customer === null ? collect() : $customer->serviceRequests()
            ->with(['eventType', 'project.status'])
            ->latest('service_request_id')
            ->get();

        // The customer and each project's service request are already in memory:
        // attach them instead of loading them again (each query is a trip to the database).
        foreach ($requests as $r) {
            $r->setRelation('customer', $customer);
            $r->project?->setRelation('serviceRequest', $r);
        }

        return Inertia::render('customer/projects', [
            'profileMissing' => $customer === null,
            'items' => fn () => $requests->map(fn (ServiceRequest $r) => [
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
            ])->values(),
            // { requestId: nextAction } for the "Action needed" filter.
            'nextActions' => Inertia::defer(function () use ($requests) {
                $this->progress->preload(new EloquentCollection($requests->pluck('project')->filter()->values()->all()));

                return (object) $requests
                    ->mapWithKeys(fn (ServiceRequest $r) => [$r->service_request_id => $this->listAction($r)])
                    ->all();
            }, 'list'),
        ]);
    }

    public function show(Request $request, Project $project): Response
    {
        self::ensureOwned($request, $project);

        // The page opens on the current step and loads only that step's details. The
        // other steps are deferred: the browser fetches them in a second request right
        // after the page appears (Inertia deferred props). This is that second request.
        $loadingDeferred = $request->header(Header::PARTIAL_COMPONENT) === 'customer/project-show';

        // Housekeeping runs once, on the first request.
        if (! $loadingDeferred) {
            $cancelled = $this->fees->cancelOverdue($project->serviceRequest()->value('customer_id'));
            // A project in Contract always has a contract to sign (e.g. sample data).
            $issued = $this->contracts->ensureIssued($project);

            // Reload only when one of the two above changed something.
            if ($cancelled > 0 || $issued !== null) {
                $project->refresh();
            }
        }

        // Each value below is a function, so it runs only when its prop is sent, and
        // loads only what it needs (each query is a trip to the database).
        $progress = null;
        $progressOf = function () use (&$progress, $project) {
            return $progress ??= $this->progress->for($project);
        };

        $consultation = null;
        $consultationOf = function () use (&$consultation, $project, $request) {
            return $consultation ??= $this->consultationData($project, $request);
        };

        // The current step's details come with the page; the other steps' are deferred.
        // (On the second request every step is "deferred": only the ones asked for run.)
        $currentStep = $loadingDeferred ? null : $progressOf()['currentStep'];
        $step = fn (array $keys, callable $value) => in_array($currentStep, $keys, true)
            ? $value
            : Inertia::defer($value, 'steps');

        return Inertia::render('customer/project-show', [
            'project' => fn () => $this->projectData($project),
            'steps' => fn () => $progressOf()['steps'],
            'currentStep' => fn () => $progressOf()['currentStep'],
            'nextAction' => fn () => $progressOf()['nextAction'],
            // Shown on the current step after the consultation until the fee is verified.
            'reservationFee' => fn () => $this->reservationFeeData($project),
            'consultation' => $step(['consultation'], fn () => $consultationOf()['consultation']),
            'availableSlots' => $step(['consultation'], fn () => $consultationOf()['availableSlots']),
            'rules' => $step(['consultation'], fn () => $consultationOf()['rules']),
            'ocularVisit' => $step(['ocular_visit'], fn () => $this->ocularVisitData($project, $request)),
            'design' => $step(['design'], fn () => $this->designData($project)),
            'contract' => $step(['contract'], fn () => $this->contractData($project)),
            'execution' => $step(['fabrication', 'installation'], fn () => $this->executionData($project)),
        ]);
    }

    /** The header: code, title, dates, venue and status. @return array<string, mixed> */
    private function projectData(Project $project): array
    {
        $project->loadMissing(['serviceRequest.eventType', 'serviceRequest.customer', 'status']);
        $r = $project->serviceRequest;

        return [
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
        ];
    }

    /** The reservation fee card, while the fee is still to be paid or verified. @return array<string, mixed>|null */
    private function reservationFeeData(Project $project): ?array
    {
        if (! $this->progress->feeOutstanding($project)) {
            return null;
        }

        $project->loadMissing(['serviceRequest', 'reservationFee.payments']);
        $this->attachToBills($project);

        return [
            'bill' => $project->reservationFee ? $this->billings->card($project->reservationFee) : null,
            'expectedAmount' => $project->serviceRequest->reservationFee(),
            'basis' => $project->serviceRequest->reservationFeeBasis(),
        ];
    }

    /**
     * The consultation (Plan Project step 1): the booking, its history, and the open
     * slots and booking rules.
     *
     * @return array{consultation: array<string, mixed>, availableSlots: array<string, list<string>>|object, rules: array<string, mixed>}
     */
    private function consultationData(Project $project, Request $request): array
    {
        $project->loadMissing('serviceRequest');

        $current = $this->scheduler->current($project);
        $history = $this->history($project, ProjectSchedule::TYPE_CONSULTATION, $current);

        $bookingBlocked = $this->scheduler->bookingBlockedReason($project);
        $changeBlocked = $current ? $this->scheduler->changeBlockedReason($project, $current) : null;
        $needsSlots = $bookingBlocked === null || ($current !== null && $changeBlocked === null);

        return [
            'consultation' => [
                'current' => $current ? $this->scheduleData($current, $request) : null,
                'history' => $history->map(fn (ProjectSchedule $s) => $this->scheduleData($s, $request))->values(),
                'canBook' => $bookingBlocked === null,
                'bookingBlockedReason' => $current ? null : $bookingBlocked,
                'canChange' => $current !== null && $changeBlocked === null,
                'changeBlockedReason' => $changeBlocked,
                // Filled in by "Use GR3AT A's office" on the meeting place field.
                'officeAddress' => "GR3AT A's office, ".app(PublicWebsite::class)->contact()['address'],
                'placeMax' => ConsultationRequest::PLACE_MAX,
            ],
            'availableSlots' => $needsSlots ? $this->scheduler->availableSlots($project) : (object) [],
            'rules' => $this->scheduler->rules($project) + ['reasonMax' => ConsultationRequest::REASON_MAX],
        ];
    }

    /** The bills shown as cards belong to this project: attach it so each card doesn't load the project and its status again. */
    private function attachToBills(Project $project): void
    {
        foreach (['reservationFee', 'downPayment', 'balanceBill'] as $bill) {
            if ($project->relationLoaded($bill)) {
                $project->{$bill}?->setRelation('project', $project);
            }
        }
    }

    /**
     * Fabrication and installation (read-only for the customer): the dates,
     * where it stands, any moves with the reason, and once done, the photos
     * of the finished work.
     *
     * @return array<string, mixed>
     */
    private function executionData(Project $project): array
    {
        $project->loadMissing(['serviceRequest', 'schedules.outcome.files']);

        $stage = function (string $type) use ($project) {
            $current = $this->execution->current($project, $type);
            $outcome = $current?->schedule_status === ProjectSchedule::STATUS_COMPLETED ? $current->outcome : null;

            return [
                'state' => $this->execution->state($current),
                'schedule' => $current ? [
                    'start' => $current->start_datetime->toDateString(),
                    'end' => $current->end_datetime->toDateString(),
                    'completedAt' => $current->completed_at?->toDateString(),
                ] : null,
                'changes' => $this->execution->changes($project, $type)->map(fn (ProjectSchedule $s) => [
                    'start' => $s->start_datetime->toDateString(),
                    'end' => $s->end_datetime->toDateString(),
                    'reason' => $s->remarks,
                ])->values(),
                'completion' => $outcome ? [
                    'note' => $outcome->notes,
                    'recordedAt' => $outcome->recorded_at->toDateString(),
                    'photos' => $outcome->files->where('file_type', AppointmentOutcomeFile::TYPE_PHOTO)->map(fn (AppointmentOutcomeFile $f) => [
                        'id' => $f->outcome_file_id,
                        'name' => $f->file_name,
                        'url' => "/customer/projects/{$project->project_id}/work-photos/{$f->outcome_file_id}",
                    ])->values(),
                ] : null,
            ];
        };

        $request = $project->serviceRequest;

        return [
            'fabrication' => $stage(ProjectSchedule::TYPE_FABRICATION),
            'installation' => $stage(ProjectSchedule::TYPE_INSTALLATION) + [
                'event' => [
                    'date' => $request->start_date->toDateString(),
                    'endDate' => $request->end_date->toDateString(),
                    'venue' => $request->venue,
                ],
            ],
        ];
    }

    /**
     * The contract (Plan Project step 5): the current version and how to sign
     * it, earlier versions, the payment summary and, once verified, the down
     * payment.
     *
     * @return array<string, mixed>
     */
    private function contractData(Project $project): array
    {
        $project->loadMissing(['serviceRequest.customer', 'status', 'contracts', 'downPayment.payments', 'balanceBill.payments']);
        $this->attachToBills($project);
        $current = $this->contracts->current($project);
        $blocked = $this->contracts->signBlockedReason($project, $current);
        $base = "/customer/projects/{$project->project_id}/contracts";

        $version = fn (Contract $c) => [
            'id' => $c->contract_id,
            'code' => $c->code(),
            'version' => $c->version_number,
            'status' => $c->status,
            'issuedAt' => $c->issued_at->toDateString(),
            'fileName' => $c->downloadName(),
            'url' => "{$base}/{$c->contract_id}/file",
            'signedAt' => $c->signed_at?->toDateString(),
            'signMethod' => $c->sign_method,
            'signerName' => $c->signer_name,
            'signedFile' => $c->signed_contract_path ? [
                'name' => $c->downloadName('signed'),
                'extension' => $c->signedExtension(),
                'url' => "{$base}/{$c->contract_id}/file?signed=1",
            ] : null,
            // The fully signed contract (customer + Owner), once verified.
            'executedFile' => $c->executed_contract_path ? [
                'name' => $c->downloadName('executed'),
                'url' => "{$base}/{$c->contract_id}/file?executed=1",
            ] : null,
            'reviewedAt' => $c->reviewed_at?->toDateString(),
            'verifiedAt' => $c->verified_at?->toDateString(),
            'rejectionReason' => $c->rejection_reason,
        ];

        $payment = $current?->contract_data['payment'] ?? null;
        $down = $project->downPayment;
        $balance = $project->balanceBill;

        return [
            'current' => $current ? $version($current) : null,
            'history' => $this->contracts->history($project)->map($version)->values(),
            'canSign' => $blocked === null,
            'signBlockedReason' => $current ? $blocked : null,
            'signerName' => $project->serviceRequest->customer->full_name,
            'summary' => $payment ? [
                'quotationTotal' => (float) $current->contract_data['quotation']['total'],
                'reservationFeePaid' => (float) $payment['reservationFeePaid'],
                'finalBilling' => (float) $payment['finalBilling'],
                'downPercent' => (int) $payment['downPercent'],
                'downPayment' => (float) $payment['downPayment'],
                'balance' => (float) $payment['balance'],
                'downDueDays' => (int) $payment['downDueDays'],
                'balanceDaysBeforeEvent' => (int) $payment['balanceDaysBeforeEvent'],
            ] : null,
            'upload' => ['maxMb' => ContractUploadRequest::maxMb(), 'types' => config('contract.upload.mimes')],
            'pad' => ['width' => Contracts::PAD_WIDTH, 'height' => Contracts::PAD_HEIGHT],
            // Paid on Billing & Payments; the Contract step shows them as cards with "Pay now".
            'downPayment' => $down ? $this->billings->card($down) : null,
            'balance' => $balance && $down && $balance->billing_id !== $down->billing_id ? $this->billings->card($balance) : null,
        ];
    }

    /**
     * The design proposal (Plan Project step 4): the newest version approved by
     * the Project Manager and the Owner, earlier versions, and what the customer
     * can do with it.
     *
     * @return array<string, mixed>
     */
    private function designData(Project $project): array
    {
        $project->loadMissing(['status', 'reservationFee.payments', 'designProposals.items', 'designProposals.files']);
        $visible = $this->proposals->visible($project);
        $latest = $visible->last();
        $awaiting = $this->proposals->awaitingCustomer($project);

        $bill = $project->reservationFee;
        $feePaid = $bill && ($bill->status === Billing::STATUS_PAID || $bill->payments->contains('status', Payment::STATUS_VERIFIED))
            ? (float) $bill->amount
            : null;

        return [
            'latest' => $latest ? $this->proposalData($project, $latest) : null,
            'history' => $visible->slice(0, -1)->reverse()->map(fn (DesignProposal $p) => $this->proposalData($project, $p))->values(),
            'canDecide' => $awaiting !== null,
            'revisionInProgress' => $this->proposals->revisionInProgress($project),
            'designerAssigned' => $project->design_specialist_id !== null,
            'reservationFeePaid' => $feePaid,
            'remarksMax' => DesignProposals::REMARKS_MAX,
        ];
    }

    /** @return array<string, mixed> */
    private function proposalData(Project $project, DesignProposal $p): array
    {
        $file = fn (DesignProposalFile $f) => [
            'id' => $f->proposal_file_id,
            'name' => $f->file_name,
            'extension' => $f->extension(),
            'viewable' => $f->isViewable(),
            'url' => "/customer/projects/{$project->project_id}/design-files/{$f->proposal_file_id}",
        ];
        $current = $p->files->where('is_current', true);

        return [
            'id' => $p->design_proposal_id,
            'version' => $p->version_number,
            'submittedAt' => $p->submitted_at?->toDateString(),
            'quotationAmount' => (float) $p->quotation_amount,
            'items' => $p->items->map(fn ($i) => [
                'id' => $i->item_id,
                'name' => $i->item_name,
                'description' => $i->description,
                'quantity' => $i->quantity,
                'unit' => $i->unit,
                'unitPrice' => (float) $i->unit_price,
                'subtotal' => (float) $i->subtotal,
            ])->values(),
            'designFiles' => $current->where('file_category', DesignProposalFile::CATEGORY_2D)->map($file)->values(),
            'visualizationFiles' => $current->where('file_category', DesignProposalFile::CATEGORY_3D)->map($file)->values(),
            'otherFiles' => $current->where('file_category', DesignProposalFile::CATEGORY_OTHER)->map($file)->values(),
            'externalLink' => $p->external_link,
            'decision' => $p->customer_decision,
            'comments' => $p->customer_remarks,
            'decidedAt' => $p->decision_date?->toDateString(),
        ];
    }

    /**
     * The ocular visit (Plan Project step 3): the booking, its history, the
     * open slots and, once the Project Manager records it, the site assessment.
     *
     * @return array<string, mixed>
     */
    private function ocularVisitData(Project $project, Request $request): array
    {
        $project->loadMissing(['serviceRequest', 'status', 'siteAccessDocuments']);

        $current = $this->ocular->current($project);
        $held = $this->ocular->held($project);
        $history = $this->history($project, ProjectSchedule::TYPE_OCULAR_VISIT, $current);

        $bookingBlocked = $this->ocular->bookingBlockedReason($project);
        $changeBlocked = $current ? $this->ocular->changeBlockedReason($project, $current) : null;
        $needsSlots = $bookingBlocked === null || ($current !== null && $changeBlocked === null);

        return [
            'required' => $project->ocular_visit_required,
            'current' => $current ? $this->scheduleData($current, $request) : null,
            'history' => $history->map(fn (ProjectSchedule $s) => $this->scheduleData($s, $request))->values(),
            'canBook' => $bookingBlocked === null,
            'bookingBlockedReason' => $current ? null : $bookingBlocked,
            'canChange' => $current !== null && $changeBlocked === null,
            'changeBlockedReason' => $changeBlocked,
            'assessment' => $held ? $this->assessmentData($project, $held) : null,
            'documents' => $this->documentsData($project),
            'canUploadDocuments' => $this->documents->uploadBlockedReason($project) === null,
            'documentRules' => ['maxMb' => SiteAccessDocument::MAX_MB, 'types' => SiteAccessDocument::MIMES],
            'availableSlots' => $needsSlots ? $this->ocular->availableSlots($project) : (object) [],
            'rules' => $this->ocular->rules($project) + ['reasonMax' => ConsultationRequest::REASON_MAX],
        ];
    }

    /**
     * The authorization letter and venue permit: the current file of each,
     * with its review status, and the files it replaced.
     *
     * @return list<array<string, mixed>>
     */
    private function documentsData(Project $project): array
    {
        // Uses the documents loaded by ocularVisitData() (nothing changes them in between).
        $file = fn (SiteAccessDocument $d) => [
            'id' => $d->document_id,
            'name' => $d->file_name,
            'viewable' => $d->isViewable(),
            'url' => "/customer/projects/{$project->project_id}/site-access-documents/{$d->document_id}",
            'status' => $d->status,
            'remarks' => $d->remarks,
            'uploadedAt' => $d->uploaded_at->format('Y-m-d H:i'),
            'reviewedAt' => $d->reviewed_at?->toDateString(),
            'replacedAt' => $d->replaced_at?->toDateString(),
        ];

        return collect($this->documents->current($project))
            ->map(fn (?SiteAccessDocument $current, string $type) => [
                'type' => $type,
                'label' => SiteAccessDocument::TYPES[$type],
                'current' => $current ? $file($current) : null,
                'history' => $this->documents->history($project, $type)->map($file)->values()->all(),
            ])
            ->values()
            ->all();
    }

    /** The site assessment recorded for the held visit, or null until then. @return array<string, mixed>|null */
    private function assessmentData(Project $project, ProjectSchedule $visit): ?array
    {
        $outcome = $visit->outcome()->with(['files', 'recordedBy'])->first();

        if ($outcome === null) {
            return null;
        }

        $file = fn (AppointmentOutcomeFile $f) => [
            'id' => $f->outcome_file_id,
            'name' => $f->file_name,
            'extension' => $f->extension(),
            'viewable' => $f->isViewable(),
            'url' => "/customer/projects/{$project->project_id}/site-assessment/files/{$f->outcome_file_id}",
        ];

        return [
            'visitDate' => $visit->start_datetime->toDateString(),
            'notes' => $outcome->notes,
            'recordedAt' => $outcome->recorded_at->toDateString(),
            'recordedBy' => $outcome->recordedBy?->role?->label() ?? 'Project Manager',
            'report' => ($report = $outcome->files->firstWhere('file_type', AppointmentOutcomeFile::TYPE_REPORT)) ? $file($report) : null,
            'photos' => $outcome->files->where('file_type', AppointmentOutcomeFile::TYPE_PHOTO)->map($file)->values(),
            'attachments' => $outcome->files->where('file_type', AppointmentOutcomeFile::TYPE_ATTACHMENT)->map($file)->values(),
        ];
    }

    /** Earlier (cancelled or held) appointments of a type, newest first, without the current one. */
    private function history(Project $project, string $type, ?ProjectSchedule $current)
    {
        return $project->schedules()
            ->with('changedBy')
            ->where('schedule_type', $type)
            ->when($current, fn ($q) => $q->where('schedule_id', '!=', $current->schedule_id))
            ->latest('start_datetime')
            ->get();
    }

    /**
     * The "What to do now" line on My Projects: the project's next action, or
     * the review status of a request that has no project yet.
     *
     * @return array{title: string, detail: string, actionNeeded: bool, button: string|null, billId: int|null}|null
     */
    private function listAction(ServiceRequest $r): ?array
    {
        if ($r->project) {
            return $this->progress->for($r->project)['nextAction'];
        }

        return $r->request_status === ServiceRequest::STATUS_PENDING
            ? ['title' => 'Waiting for review', 'detail' => 'Our Project Manager is reviewing your request.', 'actionNeeded' => false, 'button' => null, 'billId' => null]
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

    /** e.g. "REQ-26-0001" (see HasYearlyCode). */
    public static function requestCode(ServiceRequest $r): string
    {
        return (string) $r->request_code;
    }

    /** e.g. "PRJ-26-0001" (see HasYearlyCode). */
    public static function projectCode(Project $p): string
    {
        return (string) $p->project_code;
    }

    /** Custom: the project title. Standard: the event type, e.g. "Wedding". */
    /** Event type names as they read in a title: "Corporate" → "Corporate Event". */
    private const TITLE_EVENT_NAMES = ['Corporate' => 'Corporate Event'];

    /**
     * A project's title everywhere it is shown. Custom projects keep the title
     * the customer typed; standard requests are named after the customer:
     * "Andrea's Wedding", "Andrea's Corporate Event".
     */
    public static function titleOf(ServiceRequest $r): string
    {
        if ($r->isCustom()) {
            return (string) $r->project_title;
        }

        $type = $r->eventType?->event_type_name ?? 'Event';
        $event = self::TITLE_EVENT_NAMES[$type] ?? $type;
        $name = trim((string) $r->customer?->first_name);

        if ($name === '') {
            return $event;
        }

        // "Andrea's", but "Charles'" for a name ending in s.
        $owner = str_ends_with(mb_strtolower($name), 's') ? "{$name}'" : "{$name}'s";

        return "{$owner} {$event}";
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
            'meetingPlace' => $s->meeting_place,
            'venueOwnership' => $s->venue_ownership,
            'status' => $s->schedule_status,
            'remarks' => $s->remarks,
            'changedBy' => $changedBy,
        ];
    }
}
