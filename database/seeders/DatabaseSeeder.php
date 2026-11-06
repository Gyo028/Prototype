<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * One verified test account per role, e.g. technical_admin@example.com.
     * Password for all of them: "password". Safe to run more than once.
     * Change or remove these before the system is used with real data.
     */
    public function run(): void
    {
        foreach (Role::cases() as $role) {
            User::query()->updateOrCreate(
                ['email' => $role->value.'@example.com'],
                [
                    'name' => $role->label(),
                    'password' => 'password',
                    'email_verified_at' => now(),
                    'role' => $role,
                ],
            );
        }
    }
}