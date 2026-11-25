<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Http\Requests\Customer\ProfileRequest;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Laravel\Fortify\Contracts\CreatesNewUsers;

/**
 * The registration page: the customer's login account and their full profile
 * (name, contact number, and optionally company and address), saved together.
 * They can change the profile later on My Profile.
 *
 * Each field shows one message, the most basic problem first ('bail'):
 * empty, then the format, then whether it is already registered.
 */
class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules, ProfileValidationRules;

    public function create(array $input): User
    {
        $input = $this->clean($input);

        Validator::make($input, [
            'first_name' => ['bail', 'required', 'string', 'max:50'],
            'last_name' => ['bail', 'required', 'string', 'max:50'],
            'email' => ['bail', ...$this->emailRules()],
            'contact_number' => [
                'bail', 'required', 'string', 'regex:'.ProfileRequest::MOBILE,
                Rule::unique('customer', 'contact_number'),
            ],
            'company_name' => ['bail', 'nullable', 'string', 'max:100'],
            'address' => ['bail', 'nullable', 'string', 'max:255'],
            'password' => ['bail', ...$this->passwordRules()],
            'terms' => ['accepted'],
        ], [
            'required' => 'Please fill out this field.',
            'email.email' => 'Enter a valid email address.',
            'email.unique' => 'This email is already registered.',
            'first_name.max' => 'Keep it to 50 characters or fewer.',
            'last_name.max' => 'Keep it to 50 characters or fewer.',
            'contact_number.regex' => 'Enter a valid mobile number (09XXXXXXXXX or +639XXXXXXXXX).',
            'contact_number.unique' => 'This contact number is already registered.',
            'company_name.max' => 'Keep the company name to 100 characters or fewer.',
            'address.max' => 'Keep the address to 255 characters or fewer.',
            'password.confirmed' => 'The passwords do not match.',
            'terms.accepted' => 'You must agree to the Terms & Conditions to create an account.',
        ])->validate();

        // The login account and its customer profile are saved together, or not at all.
        return DB::transaction(function () use ($input) {
            $user = User::create([
                'name' => $input['first_name'].' '.$input['last_name'],
                'email' => $input['email'],
                'password' => $input['password'],
            ]);

            Customer::create([
                'user_id' => $user->id,
                'first_name' => $input['first_name'],
                'last_name' => $input['last_name'],
                'contact_number' => $input['contact_number'],
                'company_name' => $input['company_name'],
                'address' => $input['address'],
            ]);

            return $user;
        });
    }

    /**
     * Trimmed text, empty optional fields as null, and the mobile number as
     * 09XXXXXXXXX (so "+63 917 123 4567" and "09171234567" are the same number).
     *
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function clean(array $input): array
    {
        foreach (['first_name', 'last_name', 'email', 'company_name', 'address'] as $field) {
            if (isset($input[$field]) && is_string($input[$field])) {
                $input[$field] = trim($input[$field]);
            }
        }

        foreach (['company_name', 'address'] as $field) {
            $input[$field] = ($input[$field] ?? '') === '' ? null : $input[$field];
        }

        $input['contact_number'] = Customer::normalizeMobile($input['contact_number'] ?? null);

        return $input;
    }
}
