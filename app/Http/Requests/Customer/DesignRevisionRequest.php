<?php

namespace App\Http\Requests\Customer;

use App\Services\DesignProposals;
use Illuminate\Foundation\Http\FormRequest;

/** The customer's revision request on a design proposal: comments are required. */
class DesignRevisionRequest extends FormRequest
{
    public function authorize(): bool
    {
        // The route is limited to customers; the controller checks the project is theirs.
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('comments'))) {
            $this->merge(['comments' => trim($this->input('comments'))]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['comments' => ['required', 'string', 'min:10', 'max:'.DesignProposals::REMARKS_MAX]];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'comments.required' => 'Tell us what you would like changed.',
            'comments.min' => 'Please describe the changes in a little more detail.',
            'comments.max' => 'Keep your comments under '.DesignProposals::REMARKS_MAX.' characters.',
        ];
    }
}
