<?php

namespace App\Http\Requests\TechnicalAdmin;

use App\Http\Controllers\TechnicalAdmin\EmployeeController;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Used for both creating and updating an employee record.
 * Access is already limited to the Technical Admin by the route's role middleware.
 */
class EmployeeRequest extends FormRequest
{
    /** 09XXXXXXXXX or +639XXXXXXXXX */
    private const PH_MOBILE = '/^(09|\+639)\d{9}$/';

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $contact = $this->contact_number;

        $this->merge([
            'first_name' => is_string($this->first_name) ? trim($this->first_name) : $this->first_name,
            'last_name' => is_string($this->last_name) ? trim($this->last_name) : $this->last_name,
            'email' => is_string($this->email) ? strtolower(trim($this->email)) : $this->email,
            // "0917 000 0001" and "0917-000-0001" are saved as "09170000001"
            'contact_number' => is_string($contact) ? preg_replace('/[\s\-().]/', '', $contact) : $contact,
            'user_id' => $this->user_id === '' ? null : $this->user_id,
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        /** @var Employee|null $employee */
        $employee = $this->route('employee');

        return [
            'first_name' => ['required', 'string', 'max:50'],
            'last_name' => ['required', 'string', 'max:50'],
            'position_id' => ['required', 'integer', Rule::exists('employee_positions', 'position_id')],
            'contact_number' => [
                'required', 'string', 'max:20', 'regex:'.self::PH_MOBILE,
                // one number per employee, whether written as 09... or +639...
                function (string $attribute, mixed $value, \Closure $fail) use ($employee) {
                    $local = preg_replace('/^\+63/', '0', $value);
                    $international = preg_replace('/^0/', '+63', $local);

                    $taken = Employee::query()
                        ->whereIn('contact_number', [$local, $international])
                        ->when($employee, fn ($q) => $q->where('employee_id', '!=', $employee->employee_id))
                        ->exists();

                    if ($taken) {
                        $fail('Contact number already registered');
                    }
                },
            ],
            'email' => [
                'required', 'string', 'email', 'max:100',
                Rule::unique(Employee::class, 'email')->ignore($employee?->employee_id, 'employee_id'),
            ],
            'user_id' => [
                'nullable', 'integer',
                // one employee record per account
                Rule::unique(Employee::class, 'user_id')->ignore($employee?->employee_id, 'employee_id'),
                // only staff accounts can be linked, never a customer or an admin
                function (string $attribute, mixed $value, \Closure $fail) {
                    $user = User::find($value);

                    if (! $user || ! in_array($user->role, EmployeeController::LINKABLE_ROLES, true)) {
                        $fail('Choose one of the staff accounts.');
                    }
                },
            ],
            'active' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'first_name.required' => 'First name is required.',
            'last_name.required' => 'Last name is required.',
            'position_id.required' => 'Position is required.',
            'position_id.exists' => 'Choose one of the listed positions.',
            'contact_number.required' => 'Contact number is required.',
            'contact_number.regex' => 'Enter a valid mobile number (09XXXXXXXXX or +639XXXXXXXXX).',
            'email.required' => 'Email is required. Assignments are sent by email.',
            'email.email' => 'Enter a valid email address.',
            'email.unique' => 'Email already registered',
            'user_id.unique' => 'That account is already linked to another employee.',
        ];
    }
}