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
use App\Mail\WorkOrderMail;
use App\Services\ExecutionSchedules;
use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Backlog #33: Generate and send work orders.
 *   1. The work order with the project instructions is sent to the assigned Head.
 *   2. Without the Head (or their email) or the work assignment information, nothing is sent.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);
    Mail::fake();

    $this->pm = User::factory()->create(['role' => Role::ProjectManager, 'name' => 'Paolo Reyes']);
    $manager = Employee::create([
        'user_id' => $this->pm->id,
        'position_id' => EmployeePosition::where('position_name', 'Project Manager')->value('position_id'),
        'first_name' => 'Paolo',
        'last_name' => 'Reyes',
        'contact_number' => '09181112222',
        'email' => 'pm@example.com',
    ]);

    $this->fabHead = woHead('Fabrication Head', 'Mark', 'mark@example.com');
    $this->instHead = woHead('Installation Head', 'Jun', 'jun@example.com');

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

    // The schedule from #32: both phases with their Heads.
    $this->actingAs($this->pm)->put(route('project-manager.projects.execution-schedule', $this->project), [
        'fabrication' => ['headId' => $this->fabHead->employee_id, 'startDate' => '2027-01-10', 'targetDate' => '2027-01-20'],
        'installation' => ['headId' => $this->instHead->employee_id, 'startDate' => '2027-02-12', 'targetDate' => '2027-02-13'],
    ])->assertSessionHasNoErrors();
});

function woHead(string $position, string $first, ?string $email): Employee
{
    return Employee::create([
        'position_id' => EmployeePosition::where('position_name', $position)->value('position_id'),
        'first_name' => $first,
        'last_name' => 'Cruz',
        'contact_number' => '09170000000',
        'email' => $email,
    ]);
}

function woSend($test, string $phase, string $instructions = 'Use the pastel palette from the approved design.')
{
    return $test->actingAs($test->pm)->post(route('project-manager.projects.work-orders.send', [$test->project, $phase]), ['instructions' => $instructions]);
}

function woSchedule($test, string $type): ProjectSchedule
{
    return app(ExecutionSchedules::class)->current($test->project->fresh(), $type);
}

function woPage($test): array
{
    $result = null;
    $test->actingAs($test->pm)
        ->get(route('project-manager.projects.show', $test->project))
        ->assertInertia(function (Assert $page) use (&$result) {
            $all = $page->toArray();
            $result = ($all['props'] ?? $all)['project']['execution'];
        });

    return $result;
}

test('sending emails the work order to the head and records it', function () {
    woSend($this, 'fabrication')->assertSessionHasNoErrors();

    Mail::assertSent(WorkOrderMail::class, function (WorkOrderMail $mail) {
        return $mail->hasTo('mark@example.com')
            && $mail->order['instructions'] === 'Use the pastel palette from the approved design.'
            && $mail->order['start'] === 'Jan 10, 2027'
            && $mail->order['venue'] === 'Grand Palace Events Hall, Quezon City';
    });

    expect(woSchedule($this, ProjectSchedule::TYPE_FABRICATION)->work_order_sent_at)->not->toBeNull();

    $order = woPage($this)['fabrication']['workOrder'];
    expect($order['sentTo'])->toBe('Mark Cruz')
        ->and($order['sentToEmail'])->toBe('mark@example.com')
        ->and($order['sentBy'])->toBe('Paolo Reyes')
        ->and($order['code'])->toEndWith('-F')
        ->and(woPage($this)['installation']['workOrder'])->toBeNull();
});

test('nothing is sent without instructions', function () {
    woSend($this, 'fabrication', '  ')->assertSessionHasErrors('instructions');

    Mail::assertNothingSent();
    expect(woSchedule($this, ProjectSchedule::TYPE_FABRICATION)->work_order_sent_at)->toBeNull();
});

test('nothing is sent when the head or their email is missing', function () {
    woSchedule($this, ProjectSchedule::TYPE_INSTALLATION)->update(['assigned_employee_id' => null]);
    woSend($this, 'installation')->assertSessionHasErrors('workOrder');

    $this->fabHead->update(['email' => '']);
    woSend($this, 'fabrication')->assertSessionHasErrors('workOrder');

    Mail::assertNothingSent();
});

test('rescheduling a phase clears its work order', function () {
    woSend($this, 'fabrication');

    $this->actingAs($this->pm)->put(route('project-manager.projects.execution-schedule.reschedule', [$this->project, 'fabrication']), [
        'headId' => $this->fabHead->employee_id, 'startDate' => '2027-01-13', 'targetDate' => '2027-01-23', 'reason' => 'The supplier delivered late.',
    ])->assertSessionHasNoErrors();

    expect(woPage($this)['fabrication']['workOrder'])->toBeNull();
});

test('a finished phase or a completed project gets no work order', function () {
    woSchedule($this, ProjectSchedule::TYPE_FABRICATION)->update(['schedule_status' => ProjectSchedule::STATUS_COMPLETED, 'completed_at' => now()]);
    woSend($this, 'fabrication')->assertSessionHasErrors('workOrder');

    $this->project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::COMPLETED)]);
    woSend($this, 'installation')->assertSessionHasErrors('workOrder');

    Mail::assertNothingSent();
});