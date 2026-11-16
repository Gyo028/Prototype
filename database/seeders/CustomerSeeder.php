<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Gives the test customer account (customer@example.com, created by
 * DatabaseSeeder) a customer profile, so the request form can be tried
 * before registration saves profiles. Skips if any customer already exists.
 */
class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        if (Customer::query()->exists()) {
            return;
        }

        $user = User::query()->where('email', Role::Customer->value.'@example.com')->first();

        if ($user === null) {
            return;
        }

        Customer::create([
            'user_id' => $user->id,
            'first_name' => 'Sample',
            'last_name' => 'Customer',
            'contact_number' => '09171234567',
            'address' => 'Quezon City, Metro Manila',
        ]);
    }
}