<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;

/** A physically signed contract (story 17): PDF, JPG or PNG, up to the size in config/contract.php. */
class ContractUploadRequest extends FormRequest
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
            'file' => [
                'required',
                'file',
                'mimes:'.implode(',', config('contract.upload.mimes', ['pdf', 'jpg', 'jpeg', 'png'])),
                'max:'.self::maxMb() * 1024,
            ],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        $maxMb = self::maxMb();

        return [
            'file.required' => 'Choose your signed contract.',
            'file.mimes' => 'The signed contract must be a PDF, JPG or PNG file.',
            'file.max' => "The signed contract must be {$maxMb} MB or smaller.",
            'file.uploaded' => "The signed contract could not be uploaded. It must be {$maxMb} MB or smaller.",
        ];
    }

    public static function maxMb(): int
    {
        return (int) config('contract.upload.max_mb', 10);
    }
}
