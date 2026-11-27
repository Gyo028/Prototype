<?php

use App\Enums\Role;
use App\Models\Contract;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\EventType;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use Database\Seeders\ServiceAssetSeeder;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Backlog #32: Schedule project execution.
 *   1. The fabrication and installation schedule is saved with the assigned Heads.
 *   2. Incomplete scheduling information is not saved.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);

    $this->pm = User::factory()->create(['role' => Role::ProjectManager, 'name' => 'Paolo Reyes']);
    $manager = Employee::create([
        'user_id' => $this->pm->id,
        'position_id' => EmployeePosition::where('position_name', 'Project Manager')->value('position_id'),
        'first_name' => 'Paolo',
        'last_name' => 'Reyes',
        'contact_number' => '09181112222',
        'email' => 'pm@example.com',
    ]);

    $this->fabHead = exHead('Fabrication Head', 'Mark', 'mark@example.com');
    $this->instHead = exHead('Installation Head', 'Jun', 'jun@example.com');

    $customer = Customer::create([
        'user_id' => User::factory()->create(['role' => Role::Customer])->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => '09171234567',
    ]);

    $request = ServiceRequest::create([
        'customer_id' => $customer->customer_id,
        'request_type' => ServiceRequest::TYPE_STANDARD,
        'event_type_id' => EventType::where('event_type_name', 'Wedding')->value('event_type_id'),
        'request_date' => now()->toDateString(),
        'start_date' => now()->addMonths(3)->toDateString(),
        'end_date' => now()->addMonths(3)->toDateString(),
        'event_start_time' => '14:00:00',
        'event_end_time' => '22:00:00',
        'venue' => 'Grand Palace Events Hall, Quezon City',
        'guest_count' => 150,
        'budget_min' => 100000,
        'budget_max' => 250000,
        'project_description' => 'Rustic garden wedding.',
        'request_status' => ServiceRequest::STATUS_APPROVED,
        'reviewed_at' => now(),
    ]);

    // Fabricating: the contract is verified and the down payment is paid.
    $this->project = Project::create([
        'service_request_id' => $request->service_request_id,
        'project_manager_id' => $manager->employee_id,
        'current_status_id' => ProjectStatus::idFor(ProjectStatus::FABRICATING),
        'customer_proceed_decision' => Project::DECISION_PROCEED,
        'ocular_visit_required' => false,
    ]);
    $this->project->contracts()->create([
        'version_number' => 1,
        'status' => Contract::STATUS_VERIFIED,
        'issued_at' => now()->subDays(10),
        'verified_at' => now()->subDays(8),
        'contract_file_path' => 'contract.pdf',
        'contract_data' => [],
    ]);
});

function exHead(string $position, string $first, string $email): Employee
{
    return Employee::create([
        'position_id' => EmployeePosition::where('position_name', $position)->value('position_id'),
        'first_name' => $first,
        'last_name' => 'Cruz',
        'contact_number' => '09170000000',
        'email' => $email,
    ]);
}

function exForm($test): array
{
    return [
        'fabrication' => ['headId' => $test->fabHead->employee_id, 'activity' => 'Build the stage backdrop and floral arch', 'startDate' => '2027-01-10', 'targetDate' => '2027-01-20'],
        'installation' => ['headId' => $test->instHead->employee_id, 'activity' => 'Set up the stage and ceiling drapes', 'startDate' => '2027-02-12', 'targetDate' => '2027-02-13'],
    ];
}

function exSave($test, array $data)
{
    return $test->actingAs($test->pm)->put(route('project-manager.projects.execution-schedule', $test->project), $data);
}

function exReschedule($test, string $phase, array $data)
{
    return $test->actingAs($test->pm)->put(route('project-manager.projects.execution-schedule.reschedule', [$test->project, $phase]), $data);
}

function exPage($test): array
{
    $result = null;
    $test->actingAs($test->pm)
        ->get(route('project-manager.projects.show', $test->project))
        ->assertInertia(function (Assert $page) use (&$result) {
            $all = $page->toArray();
            $result = $all['props'] ?? $all;
        });

    return $result;
}

function exCurrent($test, string $type): ?ProjectSchedule
{
    return $test->project->schedules()->where('schedule_type', $type)->where('schedule_status', '!=', ProjectSchedule::STATUS_CANCELLED)->first();
}

test('the page lists the heads and has no schedule yet', function () {
    $page = exPage($this);

    expect($page['project']['execution'])->toBeNull()
        ->and(collect($page['setUpHeads'])->pluck('name', 'phase')->all())->toBe([
            'fabrication' => 'Mark Cruz',
            'installation' => 'Jun Cruz',
        ]);
});

test('saving the schedule saves both phases with their dates and heads', function () {
    exSave($this, exForm($this))->assertSessionHasNoErrors();

    $fab = exCurrent($this, ProjectSchedule::TYPE_FABRICATION);
    $inst = exCurrent($this, ProjectSchedule::TYPE_INSTALLATION);
    expect($fab->start_datetime->toDateString())->toBe('2027-01-10')
        ->and($fab->end_datetime->toDateString())->toBe('2027-01-20')
        ->and($fab->assigned_employee_id)->toEqual($this->fabHead->employee_id)
        ->and($fab->activity)->toBe('Build the stage backdrop and floral arch')
        ->and($fab->schedule_status)->toBe(ProjectSchedule::STATUS_CONFIRMED)
        ->and($inst->assigned_employee_id)->toEqual($this->instHead->employee_id);

    $execution = exPage($this)['project']['execution'];
    expect($execution['fabrication']['headName'])->toBe('Mark Cruz')
        ->and($execution['fabrication']['activities'][0]['activity'])->toBe('Build the stage backdrop and floral arch')
        ->and($execution['fabrication']['activities'][0]['scheduledDate'])->toBe('2027-01-10')
        ->and($execution['installation']['activities'][0]['targetDate'])->toBe('2027-02-13')
        ->and($execution['savedBy'])->toBe('Paolo Reyes');
});

test('nothing is saved when an activity, a head or a date is missing', function () {
    $form = exForm($this);
    $form['installation']['headId'] = null;
    $form['fabrication']['startDate'] = '';
    $form['fabrication']['activity'] = '  ';
    exSave($this, $form)->assertSessionHasErrors(['installation.headId', 'fabrication.startDate', 'fabrication.activity']);

    $form = exForm($this);
    $form['installation']['targetDate'] = '2027-02-01';
    exSave($this, $form)->assertSessionHasErrors('installation.targetDate');

    $form = exForm($this);
    $form['fabrication']['headId'] = $this->instHead->employee_id; // not a Fabrication Head
    exSave($this, $form)->assertSessionHasErrors('fabrication.headId');

    expect($this->project->schedules()->count())->toBe(0);
});

test('the schedule cannot be saved before fabrication or twice', function () {
    $this->project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::CONTRACT)]);
    exSave($this, exForm($this))->assertSessionHasErrors('schedule');
    expect($this->project->schedules()->count())->toBe(0);

    $this->project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::FABRICATING)]);
    exSave($this, exForm($this))->assertSessionHasNoErrors();
    exSave($this, exForm($this))->assertSessionHasErrors('schedule');
    expect($this->project->schedules()->count())->toBe(2);
});

test('rescheduling needs a reason and keeps the old dates with the reason', function () {
    exSave($this, exForm($this));
    $other = exHead('Fabrication Head', 'Paolo', 'paolo@example.com');
    $move = ['headId' => $other->employee_id, 'activity' => 'Build the stage backdrop and floral arch', 'startDate' => '2027-01-13', 'targetDate' => '2027-01-23'];

    exReschedule($this, 'fabrication', $move)->assertSessionHasErrors('reason');
    exReschedule($this, 'fabrication', $move + ['reason' => 'The supplier delivered late.'])->assertSessionHasNoErrors();

    $fab = exCurrent($this, ProjectSchedule::TYPE_FABRICATION);
    expect($fab->start_datetime->toDateString())->toBe('2027-01-13')
        ->and($fab->assigned_employee_id)->toEqual($other->employee_id);

    $phase = exPage($this)['project']['execution']['fabrication'];
    expect($phase['headName'])->toBe('Paolo Cruz')
        ->and($phase['changes'])->toHaveCount(1)
        ->and($phase['changes'][0]['reason'])->toBe('The supplier delivered late.');
});

test('a finished phase cannot be rescheduled', function () {
    exSave($this, exForm($this));
    exCurrent($this, ProjectSchedule::TYPE_FABRICATION)->update(['schedule_status' => ProjectSchedule::STATUS_COMPLETED, 'completed_at' => now()]);

    exReschedule($this, 'fabrication', [
    'headId' => $this->fabHead->employee_id, 'activity' => 'Build the stage backdrop', 'startDate' => '2027-01-13', 'targetDate' => '2027-01-23', 'reason' => 'Late.',
    ])->assertSessionHasErrors('schedule');

    expect(exPage($this)['project']['execution']['fabrication']['completion'])->not->toBeNull();
});

test('each head shows how many open schedules they have', function () {
    exSave($this, exForm($this));

    $heads = collect(exPage($this)['setUpHeads'])->keyBy('name');
    expect($heads['Mark Cruz']['activeAssignments'])->toBe(1)
        ->and($heads['Jun Cruz']['activeAssignments'])->toBe(1);
});