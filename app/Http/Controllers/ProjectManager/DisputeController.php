<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Models\Billing;
use App\Models\Project;
use App\Services\Billings;
use App\Services\ConsultationScheduler;
use App\Services\Contracts;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Backlog #31: Review and resolve billing disputes.
 * The customer disputes a bill on their billing page (the group's Billings::dispute).
 *   1. Start Review sets the status to "Reviewed"; resolving records the decision and the
 *      resolved date, and a corrected amount updates the bill.
 *   2. The customer sees the resolution and the remarks on their billing page.
 *   3. Without a decision, the dispute is not marked as resolved.
 *
 * Decided with the user (Nov 26): follow the group's Billings::resolveDispute, so Upheld and
 * Adjusted both need the corrected amount (Rejected keeps it), remarks are required, and the
 * PM picks the bill's new due date (7 days from today by default). A reservation fee dispute
 * shows on the Reservation Fee part; the others on Payments.
 */
class DisputeController extends Controller
{
    public const REMARKS_MAX = 1000;

    private const DECISIONS = [
        'Upheld' => Billing::RESOLUTION_UPHELD,
        'Rejected' => Billing::RESOLUTION_REJECTED,
        'Adjusted' => Billing::RESOLUTION_ADJUSTED,
    ];

    /** Start Review: pending → reviewed. */
    public function review(Project $project, Billing $billing, Billings $billings): RedirectResponse
    {
        self::ensureBelongs($project, $billing);

        if ($billing->dispute_status !== Billing::DISPUTE_PENDING) {
            throw ValidationException::withMessages(['decision' => 'This dispute is already being reviewed or is resolved.']);
        }

        $billings->markDisputeReviewed($billing);

        return back();
    }

    public function resolve(Request $request, Project $project, Billing $billing, Billings $billings, Contracts $contracts): RedirectResponse
    {
        self::ensureBelongs($project, $billing);
        $today = Carbon::today(ConsultationScheduler::TIMEZONE)->toDateString();

        // Acceptance criterion 3: no decision, no resolution.
        $data = $request->validate([
            'decision' => ['required', 'in:'.implode(',', array_keys(self::DECISIONS))],
            'newAmount' => ['nullable', 'required_unless:decision,Rejected', 'numeric', 'min:0', 'max:9999999999.99'],
            'remarks' => ['required', 'string', 'max:'.self::REMARKS_MAX],
            'dueDate' => ['required', 'date', 'after_or_equal:'.$today],
        ], [
            'decision.required' => 'Select a resolution decision before marking the dispute as resolved.',
            'decision.in' => 'Select a resolution decision before marking the dispute as resolved.',
            'newAmount.required_unless' => 'Enter the corrected bill amount.',
            'newAmount.numeric' => 'Enter the corrected bill amount.',
            'newAmount.min' => 'The amount cannot be negative.',
            'remarks.required' => 'Give your remarks to the customer.',
            'remarks.max' => 'The remarks can be up to '.self::REMARKS_MAX.' characters.',
            'dueDate.required' => 'Choose the new due date of the bill.',
            'dueDate.after_or_equal' => 'The new due date cannot be in the past.',
        ]);

        if ($billing->dispute_status !== Billing::DISPUTE_REVIEWED) {
            throw ValidationException::withMessages(['decision' => $billing->dispute_status === Billing::DISPUTE_PENDING
                ? 'Start the review before resolving the dispute.'
                : 'This dispute is already resolved.']);
        }

        $billings->resolveDispute(
            $billing,
            self::DECISIONS[$data['decision']],
            trim($data['remarks']),
            $data['decision'] === 'Rejected' ? null : (float) $data['newAmount'],
            Carbon::parse($data['dueDate'], ConsultationScheduler::TIMEZONE),
        );

        // A lower amount may now be covered by payments already verified (#27 / #28).
        $billing->refresh();
        PaymentController::settle($billing, $project->loadMissing('status'));
        if ($billing->billing_type === Billing::TYPE_FINAL_BILLING && $billing->fresh()->status === Billing::STATUS_PAID) {
            $contracts->startFabricationIfReady($project);
        }

        return back();
    }
        /** Opens the customer's proof file (add ?download=1 to download it). */
    public function proof(Request $request, Project $project, Billing $billing): StreamedResponse
    {
        self::ensureBelongs($project, $billing);
        $path = $billing->dispute_proof_file_path;
        abort_unless($path && Storage::exists($path), 404);
        $name = $billing->dispute_proof_file_name ?? 'Proof';

        return $request->boolean('download') ? Storage::download($path, $name) : Storage::response($path, $name);
    }

    /**
     * The dispute in the page's shape. Not stored in the database: when the review started,
     * the amount before the resolution and who resolved it.
     *
     * @return array<string, mixed>
     */
    public static function page(Project $project, Billing $billing, string $type): array
    {
        $resolved = $billing->dispute_status === Billing::DISPUTE_RESOLVED;

        return [
            'id' => $billing->billing_id,
            'code' => sprintf('DSP-%04d', $billing->billing_id),
            'billingId' => $billing->billing_id,
            'billingType' => $type,
            'currentAmount' => (float) $billing->amount,
            'reason' => (string) $billing->dispute_details,
            'submittedAt' => ($billing->dispute_submitted_at ?? $billing->issued_at)->toIso8601String(),
            'status' => match ($billing->dispute_status) {
                Billing::DISPUTE_PENDING => 'Submitted',
                Billing::DISPUTE_REVIEWED => 'Reviewed',
                default => 'Resolved',
            },
            'reviewedAt' => null, // not stored
            'proof' => $billing->dispute_proof_file_path ? [
                'name' => $billing->dispute_proof_file_name ?? 'Proof',
                'url' => route('project-manager.projects.disputes.proof', [$project, $billing]),
            ] : null,
            'resolution' => $resolved ? [
                'decision' => ucfirst((string) $billing->dispute_resolution),
                'remarks' => $billing->dispute_remarks,
                'previousAmount' => null, // not stored
                'newAmount' => (float) $billing->amount,
                'resolvedBy' => null, // not stored
                'resolvedAt' => ($billing->dispute_resolved_at ?? now())->toIso8601String(),
                'dueDate' => $billing->due_date->toDateString(),
            ] : null,
        ];
    }

    private static function ensureBelongs(Project $project, Billing $billing): void
    {
        abort_unless((int) $billing->project_id === (int) $project->project_id && $billing->dispute_status !== null, 404);
    }
}