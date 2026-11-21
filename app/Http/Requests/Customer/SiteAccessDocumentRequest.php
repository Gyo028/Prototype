<?php

namespace App\Http\Requests\Customer;

use App\Models\SiteAccessDocument;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Uploading or replacing one site access document after the ocular visit is
 * booked: type (authorization_letter | venue_permit) and file.
 */
class SiteAccessDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        // The route is limited to customers; the controller checks the project is theirs.
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(array_keys(SiteAccessDocument::TYPES))],
            'file' => ['required', 'file', 'mimes:'.implode(',', SiteAccessDocument::MIMES), 'max:'.(SiteAccessDocument::MAX_MB * 1024)],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        $max = SiteAccessDocument::MAX_MB;

        return [
            'type.*' => 'Choose which document this is.',
            'file.required' => 'Choose a file to upload.',
            'file.mimes' => 'The file must be a PDF, JPG or PNG.',
            'file.max' => "The file must be {$max} MB or smaller.",
            'file.uploaded' => "The file could not be uploaded. It must be {$max} MB or smaller.",
        ];
    }
}
