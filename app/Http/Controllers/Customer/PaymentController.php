<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Payment receipts. Bills are paid on Billing & Payments
 * (BillingController); this serves the customer's own receipts.
 */
class PaymentController extends Controller
{
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
