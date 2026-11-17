<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ConsultationRequest;
use App\Models\AppointmentOutcomeFile;
use App\Models\Billing;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ServiceRequest;
use App\Models\SiteAccessDocument;
use App\Services\ConsultationScheduler;
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
 * show(): the project folder: the 8-step timeline and what the customer can
 * do on each step (consultation, reservation fee, ocular visit so far).
 */
class ProjectController extends Controller
{
    public function __construct(
        private ConsultationScheduler $scheduler,
        private OcularVisitScheduler $ocular,
        private ProjectProgress $progress,
        private ReservationFees $fees,
        private SiteAccessDocuments $documents,
    ) {}

    public function index(Request $request): Response
    {
        $customer = Customer::query()->where('user_id', $request->user()->id)->first();

        // Unpaid reservation fees past their due date cancel the project first.
        if ($customer !== null) {
            $this->fees->cancelOverdue($customer->customer_id);
        }

        $requests = $customer === null ? collect() : $customer->serviceRequests()
            ->with(['eventType', 'project.status', 'project.schedules.outcome', 'project.serviceRequest', 'project.reservationFee.payments', 'project.siteAccessDocuments'])
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
            'reservationFee' => $this->reservationFeeData($project),
            'ocularVisit' => $this->ocularVisitData($project, $request),
            'availableSlots' => $needsSlots ? $this->scheduler->availableSlots($project) : (object) [],
            'rules' => $this->scheduler->rules($project) + ['reasonMax' => ConsultationRequest::REASON_MAX],
        ]);
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

    /** The bill, its payments and how to pay (Plan Project step 2). @return array<string, mixed> */
    private function reservationFeeData(Project $project): array
    {
        /** @var Billing|null $billing */
        $billing = $project->reservationFee;
        $blocked = $this->fees->payBlockedReason($billing);

        return [
            'billing' => $billing ? [
                'id' => $billing->billing_id,
                'amount' => (float) $billing->amount,
                'issuedAt' => $billing->issued_at->toDateString(),
                'dueDate' => $billing->due_date->toDateString(),
                'status' => $billing->status,
                'pastDue' => $this->fees->isPastDue($billing),
            ] : null,
            'payments' => $billing
                ? $billing->payments->sortByDesc('payment_id')->map(fn (Payment $p) => [
                    'id' => $p->payment_id,
                    'amount' => (float) $p->amount_paid,
                    'reference' => $p->payment_reference,
                    'paymentDate' => $p->payment_date->toDateString(),
                    'submittedAt' => $p->submitted_at->format('Y-m-d H:i'),
                    'method' => $p->payment_method,
                    'status' => $p->status,
                    'remarks' => $p->remarks,
                    'verifiedAt' => $p->verified_at?->toDateString(),
                    'receiptName' => $p->receipt_file_name,
                    'receiptUrl' => $p->receipt_file_path ? "/customer/payments/{$p->payment_id}/receipt" : null,
                ])->values()
                : [],
            'canPay' => $blocked === null,
            'payBlockedReason' => $blocked,
            'expectedAmount' => $project->serviceRequest->reservationFee(),
            'dueDays' => $this->fees->dueDays(),
            'gcash' => config('payments.gcash'),
            'receipt' => [
                'maxMb' => (int) config('payments.receipt.max_mb', 5),
                'types' => config('payments.receipt.mimes'),
            ],
        ];
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
