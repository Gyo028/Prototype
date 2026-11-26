<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Models\AppointmentOutcome;
use App\Models\AppointmentOutcomeFile;
use App\Models\Billing;
use App\Models\Contract;
use App\Models\DesignProposal;
use App\Models\DesignProposalFile;
use App\Models\DesignProposalItem;
use App\Models\Employee;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\SiteAccessDocument;
use App\Services\ExecutionSchedules;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Project Manager > Projects: the list and one project's page (the wizard).
 *
 * Each project is sent in the shape the Project Manager pages expect
 * (resources/js/data/project-manager/projects.ts, type Project).
 * Connected so far: the request details, the status and step 1 (Consultation, backlog #16).
 * The other steps are filled in as their backlogs are connected.
 */
class ProjectController extends Controller
{
    public const RELATIONS = [
        'serviceRequest.customer.user',
        'serviceRequest.eventType',
        'serviceRequest.services.service',
        'serviceRequest.files',
        'serviceRequest.project.projectManager',
        'status',
        'schedules.outcome.recordedBy',
        'schedules.outcome.files',
        'siteAccessDocuments',
        'projectManager',
        'designSpecialist',
        'designProposals.items',
        'designProposals.files',
        'designProposals.designSpecialist',
        'contracts.reviewer',
        'billings.payments.recordedBy',
        'schedules.changedBy',
        'schedules.assignedEmployee',
    ];

    /** The database status → the status shown on the pages (revision, Nov 19). */
    private const STATUS_NAMES = [
        ProjectStatus::CONSULTATION => 'Consultation',
        ProjectStatus::BOOKED => 'Ocular Visit',
        ProjectStatus::SITE_ASSESSMENT => 'Ocular Visit',
        ProjectStatus::DESIGNING => 'Design',
        ProjectStatus::CONTRACT => 'Contract',
        ProjectStatus::FABRICATING => 'Fabrication',
        ProjectStatus::INSTALLING => 'Installation',
        ProjectStatus::COMPLETED => 'Completed',
        ProjectStatus::CANCELLED => 'Cancelled',
    ];

    /** The database status → the wizard step the project is on (null: completed or cancelled). */
    private const STAGES = [
        ProjectStatus::CONSULTATION => 'consultation',
        ProjectStatus::BOOKED => 'ocularVisit',
        ProjectStatus::SITE_ASSESSMENT => 'ocularVisit',
        ProjectStatus::DESIGNING => 'design',
        ProjectStatus::CONTRACT => 'contract',
        ProjectStatus::FABRICATING => 'fabrication',
        ProjectStatus::INSTALLING => 'installation',
        ProjectStatus::COMPLETED => null,
        ProjectStatus::CANCELLED => null,
    ];

    /** The page's decision labels ↔ projects.customer_proceed_decision. */
    public const DECISIONS = [
        'Proceed' => Project::DECISION_PROCEED,
        'On hold' => Project::DECISION_HOLD,
        'Do not proceed' => Project::DECISION_CANCELLED,
    ];

    /** How the consultation notes are kept in appointment_outcomes.notes. */
    public const NOTE_ADDITIONAL = "\n\nAdditional details: ";

    public const NOTE_REASON = "\n\nReason for not proceeding: ";

    public function index(): Response
    {
        $projects = Project::query()
            ->with(self::RELATIONS)
            ->get()
            ->map(fn (Project $p) => self::toArray($p))
            ->values();

        return Inertia::render('project-manager/projects', ['projects' => $projects]);
    }

    public function show(Project $project): Response
    {
        $project->load(self::RELATIONS);

        return Inertia::render('project-manager/project-show', [
            'project' => self::toArray($project),
            // Backlog #21: the Design Specialists the project can be assigned to
            'specialists' => self::specialists(),
            // Backlog #32: the Fabrication and Installation Heads
            'setUpHeads' => ExecutionScheduleController::heads(),
        ]);
    }

        /** @return array<string, mixed> */
    public static function toArray(Project $p): array
    {
        $request = ServiceRequestController::toArray($p->serviceRequest);
        $schedules = $p->schedules;

        $consultations = self::ofType($schedules, ProjectSchedule::TYPE_CONSULTATION);
        $booked = $consultations->first(fn (ProjectSchedule $s) => in_array($s->schedule_status, ProjectSchedule::ACTIVE_STATUSES, true));
        $held = $consultations->first(fn (ProjectSchedule $s) => $s->schedule_status === ProjectSchedule::STATUS_COMPLETED);
        $closed = $consultations->first(fn (ProjectSchedule $s) => $s->schedule_status === ProjectSchedule::STATUS_CANCELLED);

        $ocular = self::ofType($schedules, ProjectSchedule::TYPE_OCULAR_VISIT)
            ->first(fn (ProjectSchedule $s) => $s->schedule_status !== ProjectSchedule::STATUS_CANCELLED);

        $fee = $p->billings->first(fn (Billing $b) => $b->billing_type === Billing::TYPE_RESERVATION_FEE);
        $statusName = $p->status->status_name;

        return array_merge($request, [
            'id' => $p->project_id,
            'code' => (string) $p->project_code,
            'requestCode' => (string) $p->serviceRequest->request_code,
            'statusName' => self::STATUS_NAMES[$statusName] ?? $statusName,
            'stage' => self::STAGES[$statusName] ?? null,
            'onHold' => $p->isOnHold(),

            // Step 1 · Consultation (backlog #16)
            'consultationAt' => $booked ? self::slot($booked) : null,
            'consultationNote' => ! $booked && ! $held ? $closed?->remarks : null,
            'consultation' => self::consultation($p, $held),

            // Step 2 · Ocular Visit: the reservation fee (backlog #27); the site assessment comes with #20
            'reservationFee' => [
                'amount' => $fee ? (float) $fee->amount : $p->serviceRequest->reservationFee(),
                'paid' => $fee !== null && ($fee->status === Billing::STATUS_PAID
                    || $fee->payments->contains('status', Payment::STATUS_VERIFIED)),
            ],
            // Site assessment (backlog #20)
            'ocularVisitAt' => $ocular ? self::slot($ocular) : null,
            'ocularVisitStatus' => $ocular?->schedule_status, // pending | tentative | confirmed | completed
            'siteAccessDocuments' => $p->siteAccessDocuments->whereNull('replaced_at')->sortBy('document_type')
                ->map(fn (SiteAccessDocument $d) => self::document($p, $d))->values()->all(),
            'siteAssessment' => self::siteAssessment($p, $ocular),
            // Step 3 · Design: the assignment (backlog #21)
            'assignment' => $p->designSpecialist ? [
                'specialistId' => $p->designSpecialist->employee_id,
                'specialistName' => $p->designSpecialist->full_name,
                'notes' => null, // not stored (decided with the user)
                'assignedBy' => $p->projectManager?->full_name ?? 'Project Manager',
                'assignedAt' => ($p->design_assigned_at ?? $p->updated_at)->toIso8601String(),
            ] : null,
            'assignmentLocked' => $p->designSpecialist !== null && DesignAssignmentController::proposalSubmitted($p),
                // Step 3 · Design: the design proposal (backlog #24)
            'designProposal' => self::designProposal($p, $request['customer']['name']),
                 // Step 4 · Contract (backlog #18)
            'contract' => self::contract($p),
                        // Step 4 · Contract: the bills issued after the contract and every payment (backlog #27)
            'billings' => array_values(array_map(fn (array $b) => $b['page'], self::bills($p))),
            'payments' => self::payments($p),
                        // Billing disputes (backlog #31)
            'disputes' => self::disputes($p),
                        // Step 5 · Fabrication and Step 6 · Installation (backlog #32)
            'execution' => ExecutionScheduleController::page($p, app(ExecutionSchedules::class)),
            'statusUpdates' => [],
        ]);
    }

        /**
     * The Design Specialists to choose from, with how many projects each is designing now.
     *
     * @return list<array{id: int, name: string, activeProjects: int}>
     */
    private static function specialists(): array
    {
        $designing = Project::query()
            ->where('current_status_id', ProjectStatus::idFor(ProjectStatus::DESIGNING))
            ->whereNotNull('design_specialist_id')
            ->selectRaw('design_specialist_id, count(*) as total')
            ->groupBy('design_specialist_id')
            ->pluck('total', 'design_specialist_id');

        return DesignAssignmentController::specialists()->orderBy('first_name')->orderBy('last_name')->get()
            ->map(fn (Employee $e) => ['id' => $e->employee_id, 'name' => $e->full_name, 'activeProjects' => (int) ($designing[$e->employee_id] ?? 0)])
            ->values()->all();
    }    
            /**
     * The contract the Project Manager reviews, in the page's shape, or null while the
     * customer has not signed the first version. After a rejection the group's code issues
     * the next version to sign; until it is signed, the rejected one is shown.
     */
    private static function contract(Project $p): ?array
    {
        $versions = $p->contracts->sortByDesc('version_number')->values();
        $c = $versions->first(fn (Contract $c) => $c->status !== Contract::STATUS_ISSUED);

        if ($c === null) {
            return null;
        }

        return [
            'code' => $c->code(),
            'version' => $c->version_number,
            'amount' => (float) ($c->contract_data['quotation']['total'] ?? 0),
            'file' => [
                'name' => $c->downloadName('signed'),
                'url' => "/project-manager/projects/{$p->project_id}/contracts/{$c->contract_id}/file",
            ],
            'submittedAt' => ($c->signed_at ?? $c->issued_at)->toIso8601String(),
            'status' => match ($c->status) {
                Contract::STATUS_VERIFIED => 'Approved',
                Contract::STATUS_REJECTED => 'Rejected',
                default => 'For Review',
            },
            'review' => $c->reviewed_at ? [
                'remarks' => $c->rejection_reason,
                'checklist' => array_values($c->checklist ?? []),
                'reviewedBy' => $c->reviewer?->name ?? 'Project Manager',
                'reviewedAt' => $c->reviewed_at->toIso8601String(),
            ] : null,
        ];
    }
    private const FILE_CATEGORIES = [
        DesignProposalFile::CATEGORY_2D => '2D design',
        DesignProposalFile::CATEGORY_3D => '3D visualization',
        DesignProposalFile::CATEGORY_OTHER => 'Other',
    ];

    /**
     * The newest submitted design proposal in the page's shape, or null.
     * Status: Submitted (waiting for the PM) → Awaiting Owner → Awaiting Customer → Approved;
     * Returned for Revision when the PM, the Owner or the customer sent it back.
     */
    private static function designProposal(Project $p, string $customerName): ?array
    {
        $d = DesignProposalController::latest($p);
        if ($d === null) {
            return null;
        }

        $at = fn ($time) => ($time ?? $d->updated_at)->toIso8601String();
        $pm = $p->projectManager?->full_name ?? 'Project Manager';
        $pmReview = ['remarks' => $d->pm_remarks, 'reviewedBy' => $pm, 'reviewedAt' => $at($d->pm_reviewed_at)];

        [$status, $review] = match (true) {
            $d->pm_review_decision === DesignProposal::PENDING => ['Submitted', null],
            $d->pm_review_decision === DesignProposal::REVISION_REQUESTED => ['Returned for Revision', ['decision' => 'return'] + $pmReview],
            $d->owner_review_decision === DesignProposal::PENDING => ['Awaiting Owner', ['decision' => 'approve'] + $pmReview],
            $d->owner_review_decision === DesignProposal::REVISION_REQUESTED => ['Returned for Revision', [
                'decision' => 'return', 'remarks' => $d->owner_remarks, 'reviewedBy' => 'Owner', 'reviewedAt' => $at($d->owner_reviewed_at),
            ]],
            $d->customer_decision === DesignProposal::PENDING => ['Awaiting Customer', ['decision' => 'approve'] + $pmReview],
            $d->customer_decision === DesignProposal::REVISION_REQUESTED => ['Returned for Revision', [
                'decision' => 'return', 'remarks' => $d->customer_remarks, 'reviewedBy' => $customerName.' (customer)', 'reviewedAt' => $at($d->decision_date),
            ]],
            default => ['Approved', [
                'decision' => 'approve', 'remarks' => $d->customer_remarks, 'reviewedBy' => $customerName.' (customer)', 'reviewedAt' => $at($d->decision_date),
            ]],
        };

        $url = fn (DesignProposalFile $f) => "/project-manager/projects/{$p->project_id}/design-proposal/files/{$f->proposal_file_id}";

        return [
            'version' => $d->version_number,
            'status' => $status,
            'submittedBy' => $d->designSpecialist?->full_name ?? $p->designSpecialist?->full_name ?? 'Design Specialist',
            'submittedAt' => $at($d->submitted_at),
            'notes' => '', // not stored
            'layoutSnapshotUrl' => null, // not stored
            'file' => null,
            'files' => $d->files->where('is_current', true)->values()
                ->map(fn (DesignProposalFile $f) => ['name' => $f->file_name, 'url' => $url($f), 'category' => self::FILE_CATEGORIES[$f->file_category] ?? 'Other'])
                ->all(),
            'externalLink' => $d->external_link,
            // The designer's lines; the PM edits them when approving (decided with the user: no discount).
            'quotation' => $d->items->isEmpty() ? null : [
                'items' => $d->items->map(fn (DesignProposalItem $i) => [
                    'id' => 'item-'.$i->item_id,
                    'description' => $i->item_name,
                    'quantity' => (int) $i->quantity,
                    'unitPrice' => (float) $i->unit_price,
                ])->values()->all(),
                'discount' => 0,
            ],
            'review' => $review,
        ];
    }
    /** The site assessment recorded on the held ocular visit, or null. */
    private static function siteAssessment(Project $p, ?ProjectSchedule $visit): ?array
    {
        $outcome = $visit?->schedule_status === ProjectSchedule::STATUS_COMPLETED ? $visit->outcome : null;
        $report = $outcome?->files->firstWhere('file_type', AppointmentOutcomeFile::TYPE_REPORT);

        if ($outcome === null || $report === null) {
            return null;
        }

        $url = fn (AppointmentOutcomeFile $f) => "/project-manager/projects/{$p->project_id}/site-assessment/files/{$f->outcome_file_id}";

        return [
            'assessedOn' => $visit->start_datetime->toDateString(), // the visit's date (no separate column)
            'findings' => $outcome->notes,
            'report' => [
                'name' => $report->file_name,
                'url' => $url($report),
                'type' => $report->extension() === 'docx' ? 'docx' : 'pdf',
            ],
            'photos' => $outcome->files->where('file_type', AppointmentOutcomeFile::TYPE_PHOTO)
                ->map(fn (AppointmentOutcomeFile $f) => ['id' => $f->outcome_file_id, 'name' => $f->file_name, 'url' => $url($f)])
                ->values()->all(),
            'recordedBy' => $outcome->recordedBy?->name ?? 'Project Manager',
            'recordedAt' => $outcome->recorded_at->toIso8601String(),
        ];
    }

    /** One current site access document in the page's shape. */
    private static function document(Project $p, SiteAccessDocument $d): array
    {
        return [
            'id' => $d->document_id,
            'type' => SiteAccessDocument::TYPES[$d->document_type] ?? $d->document_type,
            'name' => $d->file_name,
            'url' => "/project-manager/projects/{$p->project_id}/site-access-documents/{$d->document_id}",
            'status' => ucfirst($d->status), // Submitted | Approved | Rejected
            'remarks' => $d->remarks,
            'uploadedAt' => $d->uploaded_at?->toIso8601String(),
        ];
    }
        /**
     * The customer's billing disputes, newest first (backlog #31). A reservation fee dispute
     * shows on the Reservation Fee part; the others on Payments.
     *
     * @return list<array<string, mixed>>
     */
    private static function disputes(Project $p): array
    {
        $types = collect(self::bills($p))->mapWithKeys(fn (array $b) => [$b['model']->billing_id => $b['type']]);

        return $p->billings
            ->whereNotNull('dispute_status')
            ->sortByDesc('billing_id')
            ->map(fn (Billing $b) => DisputeController::page($p, $b, $types[$b->billing_id] ?? 'Reservation Fee'))
            ->values()
            ->all();
    }
    /**
     * The bills after the contract, oldest first, with the page's type: the first final
     * billing is the down payment, the second the remaining balance ("Final Payment").
     *
     * @return list<array{model: Billing, type: string, page: array<string, mixed>}>
     */
    private static function bills(Project $p): array
    {
        $finals = 0;

        return $p->billings
            ->whereIn('billing_type', [Billing::TYPE_FINAL_BILLING, Billing::TYPE_ADDITIONAL_CHARGE])
            ->sortBy('billing_id')
            ->map(function (Billing $b) use (&$finals) {
                $type = $b->billing_type === Billing::TYPE_ADDITIONAL_CHARGE
                    ? 'Additional Charge'
                    : (++$finals === 1 ? 'Down Payment' : 'Final Payment');

            // Additional charges keep the details and the reason together in description (backlog #29).
                [$details, $reason] = $type === 'Additional Charge'
                    ? AdditionalChargeController::split($b->description)
                    : [$b->description, null];

                return ['model' => $b, 'type' => $type, 'page' => [
                                        'id' => $b->billing_id,
                    'type' => $type,
                    'amount' => (float) $b->amount,
                    'issuedAt' => $b->issued_at->toIso8601String(),
                    'description' => $details,
                    'reason' => $reason,
                    'recordedBy' => null, // not stored
                ]];
            })
            ->values()
            ->all();
    }

    /**
     * Every payment the customer made: the reservation fee's and the bills', oldest first.
     *
     * @return list<array<string, mixed>>
     */
    private static function payments(Project $p): array
    {
        $fee = $p->billings->firstWhere('billing_type', Billing::TYPE_RESERVATION_FEE);
        $list = $fee ? $fee->payments->map(fn (Payment $pay) => self::payment($pay, 'Reservation Fee'))->all() : [];

        foreach (self::bills($p) as $bill) {
            foreach ($bill['model']->payments as $pay) {
                $list[] = self::payment($pay, $bill['type']);
            }
        }

        usort($list, fn (array $a, array $b) => $a['id'] <=> $b['id']);

        return $list;
    }
    /** The page's payment statuses ↔ payments.status. */
    private const PAYMENT_STATUSES = [
        Payment::STATUS_SUBMITTED => 'For Verification',
        Payment::STATUS_VERIFIED => 'Verified',
        Payment::STATUS_REJECTED => 'Rejected',
    ];

    private const PAYMENT_METHODS = [
        Payment::METHOD_GCASH => 'GCash',
        Payment::METHOD_CASH => 'Cash',
        Payment::METHOD_CHEQUE => 'Cheque',
    ];

    /**
     * One payment in the page's shape (resources/js/data/project-manager/payments.ts, type Payment).
     * The database does not store who reviewed a payment, or when a rejection was made.
     *
     * @return array<string, mixed>
     */
    public static function payment(Payment $pay, string $type): array
    {
        $decided = $pay->status !== Payment::STATUS_SUBMITTED;

        return [
            'id' => $pay->payment_id,
            'code' => 'PAY-'.str_pad((string) $pay->payment_id, 4, '0', STR_PAD_LEFT),
            'billingId' => $type === 'Reservation Fee' ? null : $pay->billing_id,
            'type' => $type,
            'amount' => (float) $pay->amount_paid,
            'method' => self::PAYMENT_METHODS[$pay->payment_method] ?? $pay->payment_method,
            'referenceNo' => $pay->payment_method === Payment::METHOD_CHEQUE ? 'Cheque '.$pay->payment_reference : $pay->payment_reference,
            'paidOn' => $pay->payment_date->toDateString(),
            'receipt' => $pay->receipt_file_path
                ? ['name' => $pay->receipt_file_name ?: basename($pay->receipt_file_path), 'url' => "/project-manager/payments/{$pay->payment_id}/receipt"]
                : null,
            'chequeNo' => $pay->payment_method === Payment::METHOD_CHEQUE ? $pay->payment_reference : null, // kept in payment_reference (backlog #28)
            'submittedAt' => $pay->submitted_at->toIso8601String(),
            'status' => self::PAYMENT_STATUSES[$pay->status] ?? $pay->status,
            'review' => $decided ? [
                'remarks' => $pay->remarks,
                'reviewedBy' => $pay->payment_method !== Payment::METHOD_GCASH ? ($pay->recordedBy?->name ?? 'Project Manager') : 'Project Manager', // cash / cheque: who recorded it
                'reviewedAt' => $pay->verified_at?->toIso8601String(),
            ] : null,
        ];
    }
    /** The consultation the Project Manager recorded, or null. */
    private static function consultation(Project $p, ?ProjectSchedule $held): ?array
    {
        if ($held === null) {
            return null;
        }

        /** @var AppointmentOutcome|null $outcome */
        $outcome = $held->outcome;
        [$summary, $additional, $reason] = self::splitNotes($outcome?->notes);

        return [
            'outcome' => 'Completed',
            'summary' => $summary,
            'additionalNotes' => $additional,
            'ocularVisit' => ['required' => (bool) $p->ocular_visit_required],
            'decision' => array_search($p->customer_proceed_decision, self::DECISIONS, true) ?: 'On hold',
            'decisionReason' => $reason,
            'recordedBy' => $outcome?->recordedBy?->name ?? 'Project Manager',
            'recordedAt' => ($outcome?->recorded_at ?? $held->end_datetime)->toIso8601String(),
        ];
    }

        /**
     * "Summary\n\nAdditional details: ...\n\nReason for not proceeding: ..." → its three parts.
     *
     * @return array{0: string, 1: string|null, 2: string|null}
     */
    public static function splitNotes(?string $notes): array
    {
        $notes = (string) $notes;
        $reason = null;
        $additional = null;

        if (($at = strpos($notes, self::NOTE_REASON)) !== false) {
            $reason = substr($notes, $at + strlen(self::NOTE_REASON));
            $notes = substr($notes, 0, $at);
        }

        if (($at = strpos($notes, self::NOTE_ADDITIONAL)) !== false) {
            $additional = substr($notes, $at + strlen(self::NOTE_ADDITIONAL));
            $notes = substr($notes, 0, $at);
        }

        return [$notes, $additional, $reason];
    }

    /** @return Collection<int, ProjectSchedule> newest first */
    private static function ofType(Collection $schedules, string $type): Collection
    {
        return $schedules
            ->where('schedule_type', $type)
            ->sortByDesc(fn (ProjectSchedule $s) => [$s->start_datetime->timestamp, $s->schedule_id])
            ->values();
    }

    /** "2026-11-30T10:00" (Manila time, as stored). */
    private static function slot(ProjectSchedule $s): string
    {
        return $s->start_datetime->format('Y-m-d\TH:i');
    }
}