<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        foreach (Role::cases() as $role) {
            User::factory()->create([
                'name' => ucwords(str_replace('_', ' ', $role->value)),
                'email' => $role->value . '@example.com',
                'role' => $role,
            ]);
        }
    }
}