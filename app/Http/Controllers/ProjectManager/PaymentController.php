<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Models\Billing;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Services\ConsultationScheduler;
use App\Services\Contracts;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Backlog #27: Verify online payments.
 * The customer pays a bill by GCash and uploads the receipt; the Project Manager
 * verifies or rejects the payment.
 *   1. The decision and the payment status are saved; the bill is marked paid once
 *      its verified payments cover the amount.
 *   2. A payment with a missing or invalid receipt cannot be verified.
 *   3. A rejection needs remarks (shown to the customer).
 *
 * Verifying the reservation fee moves the project from Consultation to Booked
 * (the customer can then book the ocular visit). Verifying the down payment lets
 * fabrication start once the contract is verified (Contracts::startFabricationIfReady).
 */
class PaymentController extends Controller
{
    /** Receipt files the Project Manager can verify (the customer's upload allows pdf, jpg, jpeg, png). */
    public const RECEIPT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

    public function verify(Request $request, Project $project, Payment $payment, Contracts $contracts): RedirectResponse
    {
        $data = $request->validate(['remarks' => ['nullable', 'string', 'max:255']]);
        $billing = self::billingOf($project, $payment);

        // Acceptance criterion 2: a missing or invalid receipt cannot be verified.
        if (! self::receiptIsValid($payment)) {
            throw ValidationException::withMessages([
                'receipt' => 'This payment has no valid receipt (an image or a PDF), so it cannot be verified. Reject it and ask the customer to upload one.',
            ]);
        }

        DB::transaction(function () use ($payment, $billing, $project, $data) {
            $payment->update([
                'status' => Payment::STATUS_VERIFIED,
                'verified_at' => Carbon::now(ConsultationScheduler::TIMEZONE),
                'remarks' => self::clean($data['remarks'] ?? null),
            ]);

        self::settle($billing, $project);
        });

        if ($billing->billing_type === Billing::TYPE_FINAL_BILLING) {
            $contracts->startFabricationIfReady($project);
        }

        return back();
    }

        /**
     * Backlog #28: Record a cash or cheque payment the customer paid in person.
     *   1. Amount, method, date and (for cheques) the cheque number are saved as verified,
     *      and the bill is marked paid once it is covered.
     *   2. Nothing is saved when a required detail is missing.
     * billingId null = the reservation fee. The cheque number is kept in payment_reference.
     */
    public function record(Request $request, Project $project, Contracts $contracts): RedirectResponse
    {
        $data = $request->validate([
            'billingId' => ['nullable', 'integer'],
            'method' => ['required', 'in:Cash,Cheque'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999999.99'],
            'paidOn' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.Carbon::now(ConsultationScheduler::TIMEZONE)->toDateString()],
            'chequeNo' => ['nullable', 'required_if:method,Cheque', 'string', 'max:100'],
        ], [
            'method.required' => 'Select the payment method.',
            'amount.required' => 'Enter the amount received.',
            'amount.gt' => 'Enter the amount received.',
            'paidOn.required' => 'Enter the date the payment was received.',
            'paidOn.before_or_equal' => 'The payment date cannot be in the future.',
            'chequeNo.required_if' => 'Enter the cheque number.',
        ]);

        $project->loadMissing('status');
        if (in_array($project->status->status_name, [ProjectStatus::CANCELLED, ProjectStatus::COMPLETED], true)) {
            throw ValidationException::withMessages(['target' => 'This project is '.strtolower($project->status->status_name).'.']);
        }

        $billing = $data['billingId'] === null
            ? $project->billings()->where('billing_type', Billing::TYPE_RESERVATION_FEE)->first()
            : $project->billings()->whereKey($data['billingId'])->first();

        if ($billing === null) {
            throw ValidationException::withMessages(['target' => 'Select what the payment is for.']);
        }

        // My addition: no more than what is still owed.
        $paid = (float) $billing->payments()->where('status', Payment::STATUS_VERIFIED)->sum('amount_paid');
        $balance = round((float) $billing->amount - $paid, 2);
        if ($balance <= 0) {
            throw ValidationException::withMessages(['target' => 'This bill is already paid.']);
        }
        if (round((float) $data['amount'], 2) > $balance) {
            throw ValidationException::withMessages(['amount' => 'The amount is more than the remaining balance (₱'.number_format($balance, 2).').']);
        }

        DB::transaction(function () use ($request, $project, $billing, $data) {
            $now = Carbon::now(ConsultationScheduler::TIMEZONE);
            $cheque = $data['method'] === 'Cheque';

            $billing->payments()->create([
                'amount_paid' => round((float) $data['amount'], 2),
                'payment_reference' => $cheque ? trim((string) $data['chequeNo']) : 'Cash',
                'payment_date' => $data['paidOn'],
                'submitted_at' => $now,
                'payment_method' => $cheque ? Payment::METHOD_CHEQUE : Payment::METHOD_CASH,
                'status' => Payment::STATUS_VERIFIED,
                'verified_at' => $now,
                'recorded_by' => $request->user()->id,
            ]);

            self::settle($billing, $project);
        });

        if ($billing->billing_type === Billing::TYPE_FINAL_BILLING) {
            $contracts->startFabricationIfReady($project);
        }

        return back();
    }

    /** After a payment is verified: the bill is paid once covered; a paid reservation fee books the project. */
    public static function settle(Billing $billing, Project $project): void
    {
        $verified = (float) $billing->payments()->where('status', Payment::STATUS_VERIFIED)->sum('amount_paid');
        if ($verified >= (float) $billing->amount) {
            $billing->update(['status' => Billing::STATUS_PAID]);
        }

        if ($billing->billing_type === Billing::TYPE_RESERVATION_FEE
            && $billing->fresh()->status === Billing::STATUS_PAID
            && $project->status->status_name === ProjectStatus::CONSULTATION) {
            $project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::BOOKED)]);
        }
    }
    public function reject(Request $request, Project $project, Payment $payment): RedirectResponse
    {
        // Acceptance criterion 3: no rejection without remarks.
        $data = $request->validate(
            ['remarks' => ['required', 'string', 'max:255']],
            ['remarks.required' => 'Remarks are required when rejecting a payment. Tell the customer what is wrong.'],
        );

        self::billingOf($project, $payment);

        $payment->update([
            'status' => Payment::STATUS_REJECTED,
            'remarks' => self::clean($data['remarks']),
        ]);

        return back();
    }

    /** Opens the customer's receipt (add ?download=1 to download it). */
    public function receipt(Request $request, Payment $payment): StreamedResponse
    {
        abort_unless($payment->receipt_file_path && Storage::exists($payment->receipt_file_path), 404);

        return $request->boolean('download')
            ? Storage::download($payment->receipt_file_path, $payment->receipt_file_name)
            : Storage::response($payment->receipt_file_path, $payment->receipt_file_name);
    }

    /** The payment's bill, after checking it belongs to this project and still waits for a decision. */
    private static function billingOf(Project $project, Payment $payment): Billing
    {
        $billing = $payment->billing;
        abort_unless($billing && (int) $billing->project_id === (int) $project->project_id, 404);

        // Decided already (e.g. two tabs, or a double click).
        if ($payment->status !== Payment::STATUS_SUBMITTED) {
            throw ValidationException::withMessages(['remarks' => 'This payment has already been '.$payment->status.'.']);
        }

        $project->loadMissing('status');
        if (in_array($project->status->status_name, [ProjectStatus::CANCELLED, ProjectStatus::COMPLETED], true)) {
            throw ValidationException::withMessages(['remarks' => 'This project is '.strtolower($project->status->status_name).'.']);
        }

        return $billing;
    }

    /** True when there is a receipt file with an image or PDF extension. */
    public static function receiptIsValid(Payment $payment): bool
    {
        $name = $payment->receipt_file_name ?: $payment->receipt_file_path;

        return $payment->receipt_file_path !== null
            && in_array(strtolower(pathinfo((string) $name, PATHINFO_EXTENSION)), self::RECEIPT_EXTENSIONS, true);
    }

    private static function clean(?string $text): ?string
    {
        $text = trim((string) $text);

        return $text === '' ? null : $text;
    }
}