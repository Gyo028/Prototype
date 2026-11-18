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

        // Unpaid reservation fees past their due date cancel the project first.
        if ($customer !== null) {
            $this->fees->cancelOverdue($customer->customer_id);
        }

        $requests = $customer === null ? collect() : $customer->serviceRequests()
            ->with(['eventType', 'project.status', 'project.schedules.outcome', 'project.serviceRequest', 'project.reservationFee.payments', 'project.siteAccessDocuments', 'project.designProposals', 'project.contracts', 'project.downPayment.payments'])
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

        $this->fees->cancelOverdue($project->serviceRequest()->value('customer_id'));
        // A project in Contract always has a contract to sign (e.g. sample data).
        $this->contracts->ensureIssued($project);

        $project->refresh()->load(['serviceRequest.eventType', 'status', 'schedules', 'reservationFee.payments']);
        $r = $project->serviceRequest;

        $current = $this->scheduler->current($project);
        $history = $this->history($project, ProjectSchedule::TYPE_CONSULTATION, $current);

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
            // Shown on the step after the consultation until the fee is verified.
            'reservationFee' => $this->progress->feeOutstanding($project) ? [
                'bill' => $project->reservationFee ? $this->billings->card($project->reservationFee) : null,
                'expectedAmount' => $project->serviceRequest->reservationFee(),
            ] : null,
            'ocularVisit' => $this->ocularVisitData($project, $request),
            'design' => $this->designData($project),
            'contract' => $this->contractData($project),
            'execution' => $this->executionData($project),
            'availableSlots' => $needsSlots ? $this->scheduler->availableSlots($project) : (object) [],
            'rules' => $this->scheduler->rules($project) + ['reasonMax' => ConsultationRequest::REASON_MAX],
        ]);
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
        $project->load(['schedules.outcome.files']);

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
        $project->load(['contracts', 'downPayment.payments', 'balanceBill.payments']);
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
        $project->load(['designProposals.items', 'designProposals.files']);
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
        $project->unsetRelation('siteAccessDocuments');
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
            'venueOwnership' => $s->venue_ownership,
            'status' => $s->schedule_status,
            'remarks' => $s->remarks,
            'changedBy' => $changedBy,
        ];
    }
}
