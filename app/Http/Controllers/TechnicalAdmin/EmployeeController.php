<?php

namespace App\Http\Controllers\TechnicalAdmin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\TechnicalAdmin\EmployeeRequest;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Technical Admin > Employee Records.
 *
 * Employees are never deleted: "archive" sets employee_status to inactive,
 * and restore sets it back to active. An employee may optionally be linked
 * to a staff login account (employees.user_id); field personnel have none.
 */
class EmployeeController extends Controller
{
    /** Roles whose accounts can be linked to an employee record. */
    public const LINKABLE_ROLES = [
        Role::ProjectManager,
        Role::DesignSpecialist,
        Role::Bookkeeper,
    ];

    public function index(): Response
    {
        $employees = Employee::query()
            ->with('position')
            ->orderBy('employee_id')
            ->get()
            ->map(fn (Employee $employee) => [
                'id' => $employee->employee_id,
                'firstName' => $employee->first_name,
                'lastName' => $employee->last_name,
                'positionId' => $employee->position_id,
                'position' => $employee->position->position_name,
                'contact' => $employee->contact_number,
                'email' => $employee->email,
                'userId' => $employee->user_id,
                'active' => $employee->employee_status === Employee::STATUS_ACTIVE,
            ]);

        $staffAccounts = User::query()
            ->whereHas('userRole', fn ($q) => $q->whereIn('name', self::linkableRoleKeys()))
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->label(),
            ]);

        return Inertia::render('technical-admin/employees', [
            'employees' => $employees,
            'positions' => EmployeePosition::query()
                ->orderBy('position_id')
                ->get(['position_id', 'position_name'])
                ->map(fn (EmployeePosition $position) => [
                    'id' => $position->position_id,
                    'name' => $position->position_name,
                ]),
            'staffAccounts' => $staffAccounts,
        ]);
    }

    public function store(EmployeeRequest $request): RedirectResponse
    {
        Employee::create($this->attributes($request, active: true));

        return to_route('technical-admin.employees');
    }

    public function update(EmployeeRequest $request, Employee $employee): RedirectResponse
    {
        $employee->update($this->attributes($request, active: $request->boolean('active', true)));

        return to_route('technical-admin.employees');
    }

    public function archive(Employee $employee): RedirectResponse
    {
        $employee->update(['employee_status' => Employee::STATUS_INACTIVE]);

        return to_route('technical-admin.employees');
    }

    public function restore(Employee $employee): RedirectResponse
    {
        $employee->update(['employee_status' => Employee::STATUS_ACTIVE]);

        return to_route('technical-admin.employees');
    }

    /** @return array<string, mixed> */
    private function attributes(EmployeeRequest $request, bool $active): array
    {
        return [
            'user_id' => $request->validated('user_id'),
            'position_id' => $request->validated('position_id'),
            'first_name' => $request->validated('first_name'),
            'last_name' => $request->validated('last_name'),
            'contact_number' => $request->validated('contact_number'),
            'email' => $request->validated('email'),
            'employee_status' => $active ? Employee::STATUS_ACTIVE : Employee::STATUS_INACTIVE,
        ];
    }

    /** @return list<string> */
    public static function linkableRoleKeys(): array
    {
        return array_map(fn (Role $role) => $role->value, self::LINKABLE_ROLES);
    }
}