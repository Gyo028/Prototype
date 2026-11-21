<?php

namespace App\Http\Requests\Customer;

use App\Services\Billings;
use Illuminate\Foundation\Http\FormRequest;

class BillingDisputeRequest extends FormRequest
{
    public function authorize(): bool
    {
        // The route is limited to customers; the controller checks the bill is theirs.
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'details' => ['required', 'string', 'min:'.Billings::DISPUTE_MIN, 'max:'.Billings::DISPUTE_MAX],
            'proof' => ['nullable', 'file', 'mimes:'.implode(',', Billings::PROOF_MIMES), 'max:'.Billings::PROOF_MAX_MB * 1024],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        $min = Billings::DISPUTE_MIN;
        $max = Billings::DISPUTE_MAX;
        $mb = Billings::PROOF_MAX_MB;

        return [
            'details.required' => 'Tell us what is wrong with this bill.',
            'details.min' => "Please explain in at least {$min} characters.",
            'details.max' => "Keep it to {$max} characters or fewer.",
            'proof.mimes' => 'The proof must be a PDF, JPG or PNG file.',
            'proof.max' => "The proof must be {$mb} MB or smaller.",
            'proof.uploaded' => "The proof could not be uploaded. It must be {$mb} MB or smaller.",
        ];
    }
}
