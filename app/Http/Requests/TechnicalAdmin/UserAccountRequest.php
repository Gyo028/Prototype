<?php

namespace App\Http\Requests\TechnicalAdmin;

use App\Http\Controllers\TechnicalAdmin\UserAccountController;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Used for both creating and updating a staff account.
 * Access is already limited to the Technical Admin by the route's role middleware.
 */
class UserAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => is_string($this->name) ? trim($this->name) : $this->name,
            'email' => is_string($this->email) ? strtolower(trim($this->email)) : $this->email,
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        /** @var User|null $user */
        $user = $this->route('user');

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique(User::class, 'email')->ignore($user?->id)],
            // Only staff roles can be assigned here: never Customer or Technical Admin.
            'role' => ['required', 'string', Rule::in(UserAccountController::managedRoleKeys())],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.required' => 'Full name is required.',
            'email.required' => 'Email address is required.',
            'email.email' => 'Enter a valid email address.',
            'email.unique' => 'Email already registered',
            'role.required' => 'Role is required.',
            'role.in' => 'Choose one of the staff roles.',
        ];
    }
}