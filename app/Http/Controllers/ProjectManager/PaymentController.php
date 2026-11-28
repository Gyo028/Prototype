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
 * The customer pays a bill by QR Ph and uploads the receipt; the Project Manager
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

            // The bill is paid once its verified payments cover the full amount.
            $verified = (float) $billing->payments()->where('status', Payment::STATUS_VERIFIED)->sum('amount_paid');
            if ($verified >= (float) $billing->amount) {
                $billing->update(['status' => Billing::STATUS_PAID]);
            }

            // Reservation fee verified: the project is booked (Plan Project step 2).
            if ($billing->billing_type === Billing::TYPE_RESERVATION_FEE
                && $project->status->status_name === ProjectStatus::CONSULTATION) {
                $project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::BOOKED)]);
            }
        });

        if ($billing->billing_type === Billing::TYPE_FINAL_BILLING) {
            $contracts->startFabricationIfReady($project);
        }

        return back();
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