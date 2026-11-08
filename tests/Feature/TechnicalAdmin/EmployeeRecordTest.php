<?php

use App\Enums\Role;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->withoutVite();
    $this->admin = User::factory()->create(['role' => Role::TechnicalAdmin]);
});

function positionId(string $name = 'Fabrication Head'): int
{
    return EmployeePosition::where('position_name', $name)->value('position_id');
}

function validEmployee(array $overrides = []): array
{
    return array_merge([
        'first_name' => 'Ronaldo',
        'last_name' => 'Dizon',
        'position_id' => positionId(),
        'contact_number' => '0917 000 0004',
        'email' => 'ronaldo@email.com',
        'user_id' => null,
    ], $overrides);
}

function makeEmployee(array $overrides = []): Employee
{
    return Employee::create(array_merge([
        'position_id' => positionId(),
        'first_name' => 'Jun',
        'last_name' => 'Aquino',
        'contact_number' => '09170000005',
        'email' => 'jun@email.com',
        'employee_status' => Employee::STATUS_ACTIVE,
    ], $overrides));
}

test('only the Technical Admin can open or use the employee records screen', function (Role $role) {
    $user = User::factory()->create(['role' => $role]);

    $this->actingAs($user)->get(route('technical-admin.employees'))->assertForbidden();
    $this->actingAs($user)->post(route('technical-admin.employees.store'), validEmployee())->assertForbidden();
})->with([Role::Customer, Role::ProjectManager, Role::Owner]);

test('the screen lists employees, positions and only linkable staff accounts', function () {
    makeEmployee();
    User::factory()->create(['role' => Role::ProjectManager]);
    User::factory()->create(['role' => Role::DesignSpecialist]);
    User::factory()->create(['role' => Role::Bookkeeper]);
    User::factory()->create(['role' => Role::Owner]);
    User::factory()->create(['role' => Role::Customer]);

    $this->actingAs($this->admin)
        ->get(route('technical-admin.employees'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('technical-admin/employees')
            ->has('employees', 1)
            ->where('employees.0.position', 'Fabrication Head')
            ->where('employees.0.active', true)
            ->has('positions', 5)
            ->has('staffAccounts', 3)
        );
});

test('creating an employee saves an active record with a tidy email and contact number', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.employees.store'), validEmployee(['email' => ' Ronaldo@Email.com ']))
        ->assertRedirect(route('technical-admin.employees'));

    $employee = Employee::where('email', 'ronaldo@email.com')->firstOrFail();

    expect($employee->first_name)->toBe('Ronaldo')
        ->and($employee->contact_number)->toBe('09170000004')
        ->and($employee->employee_status)->toBe(Employee::STATUS_ACTIVE)
        ->and($employee->user_id)->toBeNull();
});

test('incomplete employee information is not saved', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.employees.store'), [
            'first_name' => '', 'last_name' => '', 'position_id' => '', 'contact_number' => '', 'email' => '',
        ])
        ->assertSessionHasErrors(['first_name', 'last_name', 'position_id', 'contact_number', 'email']);

    expect(Employee::count())->toBe(0);
});

test('a duplicate email shows "Email already registered"', function () {
    makeEmployee(['email' => 'ronaldo@email.com']);

    $this->actingAs($this->admin)
        ->post(route('technical-admin.employees.store'), validEmployee(['email' => 'RONALDO@email.com']))
        ->assertSessionHasErrors(['email' => 'Email already registered']);

    expect(Employee::count())->toBe(1);
});

test('contact numbers are accepted as Philippine mobile numbers in common formats', function (string $input, string $saved) {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.employees.store'), validEmployee(['contact_number' => $input]))
        ->assertSessionHasNoErrors();

    expect(Employee::first()->contact_number)->toBe($saved);
})->with([
    ['0917 000 0004', '09170000004'],
    ['0917-000-0004', '09170000004'],
    ['+63 917 000 0004', '+639170000004'],
]);

test('other contact numbers are rejected', function (string $input) {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.employees.store'), validEmployee(['contact_number' => $input]))
        ->assertSessionHasErrors('contact_number');

    expect(Employee::count())->toBe(0);
})->with(['12345', '0817 000 0004', '0917123456', 'call me', '+1 202 555 0100']);

test('an unknown position is rejected', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.employees.store'), validEmployee(['position_id' => 9999]))
        ->assertSessionHasErrors('position_id');
});

test('a staff account can be linked, but only to one employee', function () {
    $account = User::factory()->create(['role' => Role::ProjectManager]);

    $this->actingAs($this->admin)
        ->post(route('technical-admin.employees.store'), validEmployee([
            'position_id' => positionId('Project Manager'),
            'user_id' => $account->id,
        ]))
        ->assertSessionHasNoErrors();

    expect(Employee::first()->user_id)->toBe($account->id);

    $this->actingAs($this->admin)
        ->post(route('technical-admin.employees.store'), validEmployee([
            'email' => 'other@email.com',
            'user_id' => $account->id,
        ]))
        ->assertSessionHasErrors('user_id');

    expect(Employee::count())->toBe(1);
});

test('customer, owner and admin accounts cannot be linked', function (Role $role) {
    $account = User::factory()->create(['role' => $role]);

    $this->actingAs($this->admin)
        ->post(route('technical-admin.employees.store'), validEmployee(['user_id' => $account->id]))
        ->assertSessionHasErrors('user_id');

    expect(Employee::count())->toBe(0);
})->with([Role::Customer, Role::Owner, Role::TechnicalAdmin]);

test('an employee can be updated and keeps its own email and linked account', function () {
    $account = User::factory()->create(['role' => Role::Bookkeeper]);
    $employee = makeEmployee(['email' => 'liza@email.com', 'user_id' => $account->id]);

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.employees.update', $employee), validEmployee([
            'first_name' => 'Liza',
            'last_name' => 'Ramos',
            'position_id' => positionId('Bookkeeper'),
            'email' => 'liza@email.com',
            'user_id' => $account->id,
            'active' => false,
        ]))
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('technical-admin.employees'));

    $employee->refresh();

    expect($employee->full_name)->toBe('Liza Ramos')
        ->and($employee->position->position_name)->toBe('Bookkeeper')
        ->and($employee->employee_status)->toBe(Employee::STATUS_INACTIVE)
        ->and($employee->user_id)->toBe($account->id);
});

test('an employee can be archived and restored, and the record is kept', function () {
    $employee = makeEmployee();

    $this->actingAs($this->admin)->patch(route('technical-admin.employees.archive', $employee))
        ->assertRedirect(route('technical-admin.employees'));

    expect($employee->fresh()->employee_status)->toBe(Employee::STATUS_INACTIVE);

    $this->actingAs($this->admin)->patch(route('technical-admin.employees.restore', $employee))
        ->assertRedirect(route('technical-admin.employees'));

    expect($employee->fresh()->employee_status)->toBe(Employee::STATUS_ACTIVE)
        ->and(Employee::count())->toBe(1);
});