<?php

namespace App\Services;

use App\Models\Billing;
use App\Models\Contract;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectStatus;
use Carbon\CarbonInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Billing & Payments: every bill of a customer, how to pay
 * it, and billing disputes.
 *
 * Bills: the reservation fee, the down payment and the remaining balance (the
 * final billing, from the verified contract), and additional charges.
 *
 * Paying: by QR Ph with the reference number and receipt, in full; one
 * payment waits for verification at a time (ReservationFees::submit).
 *
 * Disputes:
 *  - any bill not yet paid, with no payment under review, can be disputed
 *  - the reason is required (20–1,000 characters); a proof file is optional
 *    (PDF, JPG or PNG, up to 5 MB)
 *  - while it is open (pending or reviewed) the bill can't be paid and can't
 *    go overdue (the reservation fee's auto-cancel skips it)
 *  - the Project Manager resolves it (resolveDispute): upheld or adjusted with
 *    a corrected amount, or rejected; with remarks and a new due date
 */
class Billings
{
    public const DISPUTE_MIN = 20;

    public const DISPUTE_MAX = 1000;

    public const PROOF_MAX_MB = 5;

    public const PROOF_MIMES = ['pdf', 'jpg', 'jpeg', 'png'];

    public const KIND_RESERVATION_FEE = 'reservation_fee';

    public const KIND_DOWN_PAYMENT = 'down_payment';

    public const KIND_BALANCE = 'balance';

    public const KIND_ADDITIONAL_CHARGE = 'additional_charge';

    /** For the filters on Billing & Payments. */
    public const STATE_UNPAID = 'unpaid';

    public const STATE_UNDER_REVIEW = 'under_review';

    public const STATE_DISPUTED = 'disputed';

    public const STATE_PAID = 'paid';

    public const STATE_OVERDUE = 'overdue';

    public function __construct(private ReservationFees $fees, private Contracts $contracts) {}

    /** reservation_fee | down_payment | balance | additional_charge */
    public function kind(Billing $billing): string
    {
        if ($billing->billing_type === Billing::TYPE_RESERVATION_FEE) {
            return self::KIND_RESERVATION_FEE;
        }

        if ($billing->billing_type === Billing::TYPE_ADDITIONAL_CHARGE) {
            return self::KIND_ADDITIONAL_CHARGE;
        }

        // The final billing has two bills: the first is the down payment.
        $first = $billing->relationLoaded('project') && $billing->project->relationLoaded('billings')
            ? $billing->project->billings->where('billing_type', Billing::TYPE_FINAL_BILLING)->min('billing_id')
            : Billing::query()
                ->where('project_id', $billing->project_id)
                ->where('billing_type', Billing::TYPE_FINAL_BILLING)
                ->min('billing_id');

        return (int) $first === (int) $billing->billing_id ? self::KIND_DOWN_PAYMENT : self::KIND_BALANCE;
    }

    /** The bill's name, e.g. "Down payment". */
    public function title(Billing $billing, ?string $kind = null): string
    {
        return match ($kind ?? $this->kind($billing)) {
            self::KIND_RESERVATION_FEE => 'Reservation fee',
            self::KIND_DOWN_PAYMENT => 'Down payment',
            self::KIND_BALANCE => 'Remaining balance',
            default => $billing->description ?: 'Additional charge',
        };
    }

    public function isPaid(Billing $billing): bool
    {
        $billing->loadMissing('payments');

        return $billing->status === Billing::STATUS_PAID || $this->fees->verified($billing) !== null;
    }

    /** The state used for the filters: paid, under_review, disputed, overdue or unpaid. */
    public function state(Billing $billing): string
    {
        $billing->loadMissing('payments');

        return match (true) {
            $this->isPaid($billing) => self::STATE_PAID,
            $billing->hasOpenDispute() => self::STATE_DISPUTED,
            $this->fees->pending($billing) !== null => self::STATE_UNDER_REVIEW,
            $billing->status === Billing::STATUS_OVERDUE => self::STATE_OVERDUE,
            default => self::STATE_UNPAID,
        };
    }

    /** Why this bill can't be paid now, or null when it can. */
    public function payBlockedReason(Billing $billing): ?string
    {
        $billing->loadMissing(['payments', 'project.status']);

        if ($this->isPaid($billing)) {
            return 'This bill is already paid.';
        }

        if ($billing->hasOpenDispute()) {
            return 'This bill is on hold while your dispute is reviewed.';
        }

        if ($billing->billing_type === Billing::TYPE_RESERVATION_FEE) {
            return $this->fees->payBlockedReason($billing);
        }

        return match (true) {
            $billing->project->status->status_name === ProjectStatus::CANCELLED => 'This project was cancelled.',
            $billing->status === Billing::STATUS_OVERDUE => 'This bill is overdue.',
            $this->fees->pending($billing) !== null => 'Your payment is waiting for verification.',
            default => null,
        };
    }

    /** Why this bill can't be disputed now, or null when it can. */
    public function disputeBlockedReason(Billing $billing): ?string
    {
        $billing->loadMissing(['payments', 'project.status']);

        return match (true) {
            $billing->dispute_status !== null => 'This bill has already been disputed.',
            $this->isPaid($billing) => 'A paid bill cannot be disputed.',
            $this->fees->pending($billing) !== null => 'Your payment for this bill is waiting for verification.',
            $billing->status === Billing::STATUS_OVERDUE => 'This bill is overdue.',
            $billing->project->status->status_name === ProjectStatus::CANCELLED => 'This project was cancelled.',
            default => null,
        };
    }

    /** The customer disputes the bill: paying and the due date are on hold until it is resolved. */
    public function dispute(Billing $billing, string $details, ?UploadedFile $proof): void
    {
        $path = null;

        if ($proof !== null) {
            $folder = sprintf('customers/%d/billings/%d/dispute', $billing->project->serviceRequest->customer_id, $billing->billing_id);
            $path = $proof->store($folder);
        }

        try {
            $billing->update([
                'dispute_details' => $details,
                'dispute_proof_file_path' => $path,
                'dispute_proof_file_name' => $proof ? mb_substr($proof->getClientOriginalName(), 0, 150) : null,
                'dispute_status' => Billing::DISPUTE_PENDING,
                'dispute_submitted_at' => Carbon::now(ConsultationScheduler::TIMEZONE),
            ]);
        } catch (\Throwable $e) {
            if ($path) {
                Storage::delete($path);
            }

            throw $e;
        }
    }

    /** For the Project Manager side: mark an open dispute as being looked at. */
    public function markDisputeReviewed(Billing $billing): void
    {
        if ($billing->dispute_status === Billing::DISPUTE_PENDING) {
            $billing->update(['dispute_status' => Billing::DISPUTE_REVIEWED]);
        }
    }

    /**
     * For the Project Manager side: resolve an open dispute.
     *  - upheld / adjusted: $newAmount is required (the corrected amount)
     *  - rejected: the amount stays
     * The bill gets $newDueDate, since the old one may have passed while it was on hold.
     * A bill corrected to ₱0 is marked paid.
     */
    public function resolveDispute(Billing $billing, string $resolution, string $remarks, ?float $newAmount, CarbonInterface $newDueDate): void
    {
        if (! $billing->hasOpenDispute()) {
            throw new \LogicException('This bill has no open dispute.');
        }

        if (! in_array($resolution, [Billing::RESOLUTION_UPHELD, Billing::RESOLUTION_REJECTED, Billing::RESOLUTION_ADJUSTED], true)) {
            throw new \InvalidArgumentException('Unknown resolution.');
        }

        if ($resolution !== Billing::RESOLUTION_REJECTED && ($newAmount === null || $newAmount < 0)) {
            throw new \InvalidArgumentException('A corrected amount is required when the dispute is upheld or adjusted.');
        }

        if (trim($remarks) === '') {
            throw new \InvalidArgumentException('Remarks are required when resolving a dispute.');
        }

        DB::transaction(function () use ($billing, $resolution, $remarks, $newAmount, $newDueDate) {
            $amount = $resolution === Billing::RESOLUTION_REJECTED ? (float) $billing->amount : round((float) $newAmount, 2);

            $billing->update([
                'dispute_status' => Billing::DISPUTE_RESOLVED,
                'dispute_resolution' => $resolution,
                'dispute_remarks' => trim($remarks),
                'dispute_resolved_at' => Carbon::now(ConsultationScheduler::TIMEZONE),
                'amount' => $amount,
                'due_date' => $newDueDate->toDateString(),
                'status' => $amount <= 0 ? Billing::STATUS_PAID : Billing::STATUS_ISSUED,
            ]);

            if ($amount <= 0 && $this->kind($billing) === self::KIND_DOWN_PAYMENT) {
                $this->contracts->startFabricationIfReady($billing->project);
            }
        });
    }

    /**
     * The bill as a small card for the project page (reservation fee on the
     * Ocular Visit / Design step, down payment and balance on the Contract step).
     *
     * @return array<string, mixed>
     */
    public function card(Billing $billing): array
    {
        $kind = $this->kind($billing);
        $state = $this->state($billing);
        $paid = $this->fees->verified($billing);

        return [
            'id' => $billing->billing_id,
            'kind' => $kind,
            'title' => $this->title($billing, $kind),
            'amount' => (float) $billing->amount,
            'dueDate' => $billing->due_date->toDateString(),
            'state' => $state,
            'pastDue' => $state !== self::STATE_PAID && ! $billing->hasOpenDispute() && $this->fees->isPastDue($billing),
            'paidOn' => $paid?->payment_date->toDateString(),
            'lastPaymentRejected' => $billing->payments->sortByDesc('payment_id')->first()?->status === Payment::STATUS_REJECTED,
            'canPay' => $this->payBlockedReason($billing) === null,
            'url' => "/customer/billing/{$billing->billing_id}",
        ];
    }

    /** The contract's total price (approved quotation) once a contract is verified, else null. */
    public function contractPrice(Project $project): ?float
    {
        $contract = $project->contracts->firstWhere('status', Contract::STATUS_VERIFIED)
            ?? $project->contracts->sortByDesc('version_number')->first();

        return $contract ? (float) $contract->contract_data['quotation']['total'] : null;
    }
}
