<?php

use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\User;
use Illuminate\Database\QueryException;

function makeEmployee(array $overrides = []): Employee
{
    return Employee::create(array_merge([
        'position_id' => EmployeePosition::where('position_name', 'Fabrication Head')->value('position_id'),
        'first_name' => 'Ronaldo',
        'last_name' => 'Dizon',
        'contact_number' => '0917 000 0004',
        'email' => 'ronaldo@email.com',
    ], $overrides));
}

test('the five starting positions exist', function () {
    $this->assertDatabaseCount('employee_positions', 5);
    $this->assertDatabaseHas('employee_positions', ['position_name' => 'Installation Head']);
});

test('a field employee can be saved without a user account', function () {
    $employee = makeEmployee();

    expect($employee->fresh()->user_id)->toBeNull()
        ->and($employee->fresh()->employee_status)->toBe(Employee::STATUS_ACTIVE)
        ->and($employee->position->position_name)->toBe('Fabrication Head');
});

test('an employee can be linked to a user account, but only one employee per account', function () {
    $user = User::factory()->create();

    makeEmployee(['user_id' => $user->id]);

    expect(fn () => makeEmployee(['user_id' => $user->id, 'email' => 'other@email.com']))
        ->toThrow(QueryException::class);
});

test('an incomplete employee record is not saved', function () {
    expect(fn () => makeEmployee(['contact_number' => null]))->toThrow(QueryException::class);
    expect(fn () => makeEmployee(['first_name' => null]))->toThrow(QueryException::class);
});

test('a position that still has employees cannot be deleted', function () {
    $employee = makeEmployee();

    expect(fn () => $employee->position->delete())->toThrow(QueryException::class);
});

test('deleting a user account keeps the employee record', function () {
    $user = User::factory()->create();
    $employee = makeEmployee(['user_id' => $user->id]);

    $user->delete();

    expect($employee->fresh())->not->toBeNull()
        ->and($employee->fresh()->user_id)->toBeNull();
});