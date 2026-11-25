<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Models\AppointmentOutcome;
use App\Models\Billing;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
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
        'billings.payments',
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

        return Inertia::render('project-manager/project-show', ['project' => self::toArray($project)]);
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
            'ocularVisitAt' => $ocular?->start_datetime->format('Y-m-d\TH:i'),
            'siteAssessment' => null,
            'assignment' => null,
            'designProposal' => null,
            'contract' => null,
            'billings' => [],
            'payments' => $fee ? $fee->payments->sortBy('payment_id')->map(fn (Payment $pay) => self::payment($pay, 'Reservation Fee'))->values()->all() : [], // only the reservation fee's for now
            'disputes' => [],
            'execution' => null,
            'statusUpdates' => [],
        ]);
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
            'referenceNo' => $pay->payment_reference,
            'paidOn' => $pay->payment_date->toDateString(),
            'receipt' => $pay->receipt_file_path
                ? ['name' => $pay->receipt_file_name ?: basename($pay->receipt_file_path), 'url' => "/project-manager/payments/{$pay->payment_id}/receipt"]
                : null,
            'chequeNo' => null,
            'submittedAt' => $pay->submitted_at->toIso8601String(),
            'status' => self::PAYMENT_STATUSES[$pay->status] ?? $pay->status,
            'review' => $decided ? [
                'remarks' => $pay->remarks,
                'reviewedBy' => 'Project Manager',
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