<?php

namespace App\Services;

use App\Models\Billing;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * The reservation fee (Plan Project step 2), in one place.
 *
 *  - Issued after the consultation, once the customer decides to proceed
 *    (the Project Manager side calls issue(); sample bills come from a seeder).
 *  - Amount: 10% of the budget range (max, or min when there is no max).
 *  - Due 7 days after it is issued (the due date itself still counts).
 *  - Paid in full, by GCash, with the reference number and a receipt.
 *  - One payment waiting for verification at a time. A rejected payment stays
 *    as history and the customer submits a new one.
 *  - Not paid by the due date (no payment submitted or verified, and no open
 *    dispute): the bill becomes 'overdue' and the project is cancelled. This rule is to be
 *    confirmed with the client at the next UAT.
 *
 * Verifying a payment (which makes the project Booked) is the Project
 * Manager's side and is not built here.
 */
class ReservationFees
{
    public function dueDays(): int
    {
        return (int) config('payments.reservation_fee.due_days', 7);
    }

    public function today(): Carbon
    {
        return Carbon::now(ConsultationScheduler::TIMEZONE)->startOfDay();
    }

    /** Creates the reservation fee bill for a project (once). */
    public function issue(Project $project, ?CarbonInterface $issuedAt = null): Billing
    {
        $issuedAt ??= Carbon::now(ConsultationScheduler::TIMEZONE);

        return $project->billings()->firstOrCreate(
            ['billing_type' => Billing::TYPE_RESERVATION_FEE],
            [
                'amount' => $project->serviceRequest->reservationFee(),
                'issued_at' => $issuedAt,
                'due_date' => $issuedAt->copy()->addDays($this->dueDays())->toDateString(),
                'status' => Billing::STATUS_ISSUED,
                'description' => 'Reservation fee (10% of the budget range)',
            ],
        );
    }

    /** The payment waiting for the Project Manager, if any. */
    public function pending(Billing $billing): ?Payment
    {
        return $billing->payments->firstWhere('status', Payment::STATUS_SUBMITTED);
    }

    public function verified(Billing $billing): ?Payment
    {
        return $billing->payments->firstWhere('status', Payment::STATUS_VERIFIED);
    }

    public function isPastDue(Billing $billing): bool
    {
        return $this->today()->gt(Carbon::parse($billing->due_date->toDateString(), ConsultationScheduler::TIMEZONE));
    }

    /** Why the customer can't pay this bill now, or null when they can. */
    public function payBlockedReason(?Billing $billing): ?string
    {
        if ($billing === null) {
            return 'Your reservation fee bill has not been issued yet.';
        }

        $billing->loadMissing('payments');

        return match (true) {
            $billing->status === Billing::STATUS_PAID || $this->verified($billing) !== null => 'Your reservation fee is already paid.',
            $billing->status === Billing::STATUS_OVERDUE => 'This bill is overdue.',
            $this->pending($billing) !== null => 'Your payment is waiting for verification.',
            $this->isPastDue($billing) => 'The due date for this bill has passed.',
            default => null,
        };
    }

    /**
     * Saves a GCash payment with its receipt.
     *
     * @param  array{reference: string, paymentDate: string, amount: numeric-string|float}  $data
     */
    public function submit(Billing $billing, array $data, UploadedFile $receipt, User $user): Payment
    {
        $folder = sprintf('customers/%d/billings/%d/receipts', $billing->project->serviceRequest->customer_id, $billing->billing_id);
        $path = $receipt->store($folder);

        try {
            return DB::transaction(fn () => $billing->payments()->create([
                'amount_paid' => $data['amount'],
                'payment_reference' => $data['reference'],
                'payment_date' => $data['paymentDate'],
                'receipt_file_name' => mb_substr($receipt->getClientOriginalName(), 0, 150),
                'receipt_file_path' => $path,
                'submitted_at' => Carbon::now(ConsultationScheduler::TIMEZONE), // Manila wall time, like the schedules
                'payment_method' => Payment::METHOD_GCASH,
                'status' => Payment::STATUS_SUBMITTED,
                'recorded_by' => $user->id,
            ]));
        } catch (\Throwable $e) {
            Storage::delete($path);

            throw $e;
        }
    }

    /**
     * Cancels projects whose reservation fee was not paid by its due date
     * (nothing submitted or verified). Returns how many were cancelled.
     * Runs daily (routes/console.php) and before a customer's pages load.
     *
     * @param  int|null  $customerId  limit to one customer's projects
     */
    public function cancelOverdue(?int $customerId = null): int
    {
        $bills = Billing::query()
            ->with('project.serviceRequest')
            ->where('billing_type', Billing::TYPE_RESERVATION_FEE)
            ->where('status', Billing::STATUS_ISSUED)
            ->where('due_date', '<', $this->today()->toDateString())
            ->whereDoesntHave('payments', fn ($q) => $q->whereIn('status', [Payment::STATUS_SUBMITTED, Payment::STATUS_VERIFIED]))
            // A disputed bill is on hold until the Project Manager resolves it.
            ->where(fn ($q) => $q->whereNull('dispute_status')->orWhere('dispute_status', Billing::DISPUTE_RESOLVED))
            ->when($customerId !== null, fn ($q) => $q->whereHas('project.serviceRequest', fn ($r) => $r->where('customer_id', $customerId)))
            ->get();

        $cancelledId = ProjectStatus::idFor(ProjectStatus::CANCELLED);

        foreach ($bills as $bill) {
            DB::transaction(function () use ($bill, $cancelledId) {
                $bill->update(['status' => Billing::STATUS_OVERDUE]);
                $bill->project->update(['current_status_id' => $cancelledId]);
                $bill->project->schedules()
                    ->where('schedule_type', ProjectSchedule::TYPE_EVENT)
                    ->whereIn('schedule_status', ProjectSchedule::ACTIVE_STATUSES)
                    ->update(['schedule_status' => ProjectSchedule::STATUS_CANCELLED, 'remarks' => 'Reservation fee not paid by the due date.']);
            });
        }

        return $bills->count();
    }
}
