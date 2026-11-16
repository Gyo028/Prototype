<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Employee records for the test Project Manager and Design Specialist
 * accounts (created by DatabaseSeeder), linked by user_id. Projects need
 * them: projects.project_manager_id and design_specialist_id point to
 * employees. Skips any account that already has an employee record.
 */
class StaffEmployeeSeeder extends Seeder
{
    public function run(): void
    {
        $staff = [
            [Role::ProjectManager, 'Project Manager', 'Paolo', 'Reyes', '09181112222'],
            [Role::DesignSpecialist, 'Design Specialist', 'Bianca', 'Cruz', '09183334444'],
        ];

        foreach ($staff as [$role, $positionName, $firstName, $lastName, $contact]) {
            $user = User::query()->where('email', $role->value.'@example.com')->first();
            $position = EmployeePosition::query()->where('position_name', $positionName)->first();

            if ($user === null || $position === null || Employee::query()->where('user_id', $user->id)->exists()) {
                continue;
            }

            Employee::create([
                'user_id' => $user->id,
                'position_id' => $position->position_id,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'contact_number' => $contact,
                'email' => $user->email,
                'employee_status' => Employee::STATUS_ACTIVE,
            ]);
        }
    }
}
