<?php

namespace App\Http\Requests\Customer;

use App\Services\ReservationFees;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A GCash payment for the reservation fee.
 * The amount must match the bill (paid in full); whether the bill can be
 * paid at all is checked by ReservationFees.
 */
class PaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        // The route is limited to customers; the controller checks the project is theirs.
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reference'))) {
            // GCash shows reference numbers with spaces ("1234 567 890123"); keep the digits and letters only.
            $this->merge(['reference' => preg_replace('/\s+/', '', $this->input('reference'))]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $today = app(ReservationFees::class)->today()->toDateString();
        $maxKb = (int) config('payments.receipt.max_mb', 5) * 1024;

        return [
            'reference' => ['required', 'string', 'min:6', 'max:30', 'regex:/^[A-Za-z0-9-]+$/'],
            'paymentDate' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.$today],
            'amount' => ['required', 'numeric', 'min:1'],
            'receipt' => ['required', 'file', 'mimes:'.implode(',', config('payments.receipt.mimes', ['pdf', 'jpg', 'jpeg', 'png'])), 'max:'.$maxKb],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        $maxMb = (int) config('payments.receipt.max_mb', 5);

        return [
            'reference.required' => 'Enter the GCash reference number.',
            'reference.min' => 'The reference number looks too short.',
            'reference.regex' => 'Use letters and numbers only.',
            'paymentDate.required' => 'Enter the date you paid.',
            'paymentDate.before_or_equal' => 'The payment date cannot be in the future.',
            'amount.required' => 'Enter the amount you paid.',
            'receipt.required' => 'Upload your payment receipt.',
            'receipt.mimes' => 'The receipt must be a PDF, JPG or PNG file.',
            'receipt.max' => "The receipt must be {$maxMb} MB or smaller.",
            'receipt.uploaded' => "The receipt could not be uploaded. It must be {$maxMb} MB or smaller.",
        ];
    }
}
