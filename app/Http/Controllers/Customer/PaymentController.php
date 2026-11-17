<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\PaymentRequest;
use App\Models\Payment;
use App\Models\Project;
use App\Services\ReservationFees;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Customer > My Projects > Reservation Fee.
 * The customer pays by GCash and uploads the receipt; the Project Manager
 * verifies it on their side.
 */
class PaymentController extends Controller
{
    public function __construct(private ReservationFees $fees) {}

    public function store(PaymentRequest $request, Project $project): RedirectResponse
    {
        ProjectController::ensureOwned($request, $project);

        // An overdue bill is cancelled before anything else happens.
        $this->fees->cancelOverdue($project->serviceRequest->customer_id);

        $billing = $project->reservationFee()->with('payments')->first();

        if ($reason = $this->fees->payBlockedReason($billing)) {
            return back()->withErrors(['payment' => $reason]);
        }

        $data = $request->validated();

        // Paid in full: the amount must match the bill.
        if (round((float) $data['amount'], 2) !== round((float) $billing->amount, 2)) {
            return back()->withErrors(['amount' => 'Please pay the full amount of ₱'.number_format((float) $billing->amount, 2).'.']);
        }

        if ($data['paymentDate'] < $billing->issued_at->toDateString()) {
            return back()->withErrors(['paymentDate' => 'The payment date cannot be before the bill was issued.']);
        }

        $this->fees->submit($billing, $data, $request->file('receipt'), $request->user());

        return back();
    }

    /** Shows the customer's own receipt, or downloads it with ?download=1. */
    public function receipt(Request $request, Payment $payment): StreamedResponse
    {
        $payment->loadMissing('billing.project');
        ProjectController::ensureOwned($request, $payment->billing->project);

        abort_unless($payment->receipt_file_path && Storage::exists($payment->receipt_file_path), 404);

        return $request->boolean('download')
            ? Storage::download($payment->receipt_file_path, $payment->receipt_file_name)
            : Storage::response($payment->receipt_file_path, $payment->receipt_file_name);
    }
}
