<?php

namespace App\Http\Requests\Customer;

use App\Models\Customer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Customer > My Profile. The contact number is required (a customer needs it
 * before sending a service request) and belongs to one account only.
 */
class ProfileRequest extends FormRequest
{
    /** 09XXXXXXXXX, after Customer::normalizeMobile() (which turns +639… into 09…). */
    public const MOBILE = '/^09\d{9}$/';

    public function authorize(): bool
    {
        // The route is limited to customers; the controller only edits their own profile.
        return true;
    }

    protected function prepareForValidation(): void
    {
        $trim = fn (mixed $value) => is_string($value) ? trim($value) : $value;
        $blankToNull = fn (mixed $value) => is_string($value) && trim($value) === '' ? null : $trim($value);

        $this->merge([
            'first_name' => $trim($this->first_name),
            'last_name' => $trim($this->last_name),
            'contact_number' => Customer::normalizeMobile($this->contact_number),
            'company_name' => $blankToNull($this->company_name),
            'address' => $blankToNull($this->address),
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $own = Customer::query()->where('user_id', $this->user()->id)->value('customer_id');

        return [
            'first_name' => ['bail', 'required', 'string', 'max:50'],
            'last_name' => ['bail', 'required', 'string', 'max:50'],
            'contact_number' => [
                'bail', 'required', 'string', 'regex:'.self::MOBILE,
                Rule::unique('customer', 'contact_number')->ignore($own, 'customer_id'),
            ],
            'company_name' => ['bail', 'nullable', 'string', 'max:100'],
            'address' => ['bail', 'nullable', 'string', 'max:255'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'required' => 'Please fill out this field.',
            'first_name.max' => 'Keep it to 50 characters or fewer.',
            'last_name.max' => 'Keep it to 50 characters or fewer.',
            'contact_number.regex' => 'Enter a valid mobile number (09XXXXXXXXX or +639XXXXXXXXX).',
            'contact_number.unique' => 'This contact number is already registered.',
            'company_name.max' => 'Keep the company name to 100 characters or fewer.',
            'address.max' => 'Keep the address to 255 characters or fewer.',
        ];
    }
}
