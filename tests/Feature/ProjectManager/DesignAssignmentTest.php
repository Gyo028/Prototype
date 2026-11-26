<?php

use App\Enums\Role;
use App\Models\AppointmentOutcomeFile;
use App\Models\Billing;
use App\Models\Customer;
use App\Models\DesignProposal;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\EventType;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Services\ReservationFees;
use Database\Seeders\ServiceAssetSeeder;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Backlog #21: Assign a Design Specialist.
 *   1. The assignment is saved and the Design Specialist can see the project.
 *   2. It is not saved when no specialist is selected or the project information is incomplete.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);

    $this->pm = User::factory()->create(['role' => Role::ProjectManager, 'name' => 'Paolo Reyes']);
    $this->manager = daEmployee($this->pm, 'Project Manager', 'Paolo', 'Reyes');
    $this->bianca = daEmployee(User::factory()->create(['role' => Role::DesignSpecialist]), 'Design Specialist', 'Bianca', 'Cruz');
    $this->marco = daEmployee(User::factory()->create(['role' => Role::DesignSpecialist]), 'Design Specialist', 'Marco', 'Lim');

    $customerUser = User::factory()->create(['role' => Role::Customer]);
    $this->customer = Customer::create([
        'user_id' => $customerUser->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => '09171234567',
    ]);

    // Site Assessment: fee paid, ocular visit held with a report.
    $this->project = daProject($this->customer, $this->manager, ProjectStatus::SITE_ASSESSMENT, ocular: true);
    daHeldVisit($this->project, withReport: true);
});

function daEmployee(User $user, string $position, string $first, string $last): Employee
{
    return Employee::create([
        'user_id' => $user->id,
        'position_id' => EmployeePosition::where('position_name', $position)->value('position_id'),
        'first_name' => $first,
        'last_name' => $last,
        'contact_number' => '0918'.random_int(1000000, 9999999),
        'email' => strtolower($first).'@example.com',
        'employee_status' => Employee::STATUS_ACTIVE,
    ]);
}

/** A Wedding project whose consultation said "proceed" and whose reservation fee is paid. */
function daProject(Customer $customer, Employee $manager, string $status, bool $ocular, bool $feePaid = true): Project
{
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

    $project = Project::create([
        'service_request_id' => $request->service_request_id,
        'project_manager_id' => $manager->employee_id,
        'current_status_id' => ProjectStatus::idFor($status),
        'customer_proceed_decision' => Project::DECISION_PROCEED,
        'ocular_visit_required' => $ocular,
    ]);

    $fee = app(ReservationFees::class)->issue($project);
    if ($feePaid) {
        $fee->update(['status' => Billing::STATUS_PAID]);
    }

    return $project;
}

function daHeldVisit(Project $project, bool $withReport): void
{
    $visit = $project->schedules()->create([
        'schedule_type' => ProjectSchedule::TYPE_OCULAR_VISIT,
        'start_datetime' => now()->subDay()->toDateString().' 09:00:00',
        'end_datetime' => now()->subDay()->toDateString().' 11:00:00',
        'schedule_status' => ProjectSchedule::STATUS_COMPLETED,
        'meeting_mode' => ProjectSchedule::MODE_FACE_TO_FACE,
        'venue_ownership' => ProjectSchedule::VENUE_OWN_PROPERTY,
    ]);

    if ($withReport) {
        $visit->outcome()->create(['notes' => null, 'recorded_by' => User::first()->id, 'recorded_at' => now()])
            ->files()->create(['file_type' => AppointmentOutcomeFile::TYPE_REPORT, 'file_name' => 'report.pdf', 'file_path' => 'report.pdf']);
    }
}

function daAssign($test, ?int $specialistId, ?Project $project = null)
{
    return $test->actingAs($test->pm)
        ->patch(route('project-manager.projects.design-assignment', $project ?? $test->project), ['specialistId' => $specialistId]);
}

test('the project page lists the active Design Specialists and no assignment yet', function () {
    $this->actingAs($this->pm)
        ->get(route('project-manager.projects.show', $this->project))
        ->assertOk()
        ->assertInertia(function (Assert $page) {
            $all = $page->toArray();
            $props = $all['props'] ?? $all;

            expect(collect($props['specialists'])->pluck('name')->all())->toBe(['Bianca Cruz', 'Marco Lim'])
                ->and($props['specialists'][0]['activeProjects'])->toBe(0)
                ->and($props['project']['assignment'])->toBeNull();
        });
});

test('assigning saves the specialist and moves the project to Designing', function () {
    daAssign($this, $this->bianca->employee_id)->assertSessionHasNoErrors();

    $this->project->refresh();
    expect($this->project->design_specialist_id)->toBe($this->bianca->employee_id)
        ->and($this->project->design_assigned_at)->not->toBeNull()
        ->and($this->project->status->status_name)->toBe(ProjectStatus::DESIGNING);

    $this->actingAs($this->pm)
        ->get(route('project-manager.projects.show', $this->project))
        ->assertInertia(function (Assert $page) {
            $all = $page->toArray();
            $props = $all['props'] ?? $all;

            expect($props['project']['assignment']['specialistName'])->toBe('Bianca Cruz')
                ->and($props['project']['assignment']['assignedBy'])->toBe('Paolo Reyes')
                ->and($props['project']['assignmentLocked'])->toBeFalse()
                ->and($props['specialists'][0]['activeProjects'])->toBe(1);
        });
});

test('nothing is saved without a specialist', function () {
    daAssign($this, null)->assertSessionHasErrors('specialistId');

    expect($this->project->refresh()->design_specialist_id)->toBeNull();
});

test('only an active Design Specialist can be assigned', function () {
    daAssign($this, $this->manager->employee_id)->assertSessionHasErrors('specialistId');

    $this->marco->update(['employee_status' => Employee::STATUS_INACTIVE]);
    daAssign($this, $this->marco->employee_id)->assertSessionHasErrors('specialistId');

    expect($this->project->refresh()->design_specialist_id)->toBeNull();
});

test('nothing is saved while the site assessment is missing', function () {
    $project = daProject($this->customer, $this->manager, ProjectStatus::SITE_ASSESSMENT, ocular: true);
    daHeldVisit($project, withReport: false);

    daAssign($this, $this->bianca->employee_id, $project)->assertSessionHasErrors('project');

    expect($project->refresh()->design_specialist_id)->toBeNull()
        ->and($project->status->status_name)->toBe(ProjectStatus::SITE_ASSESSMENT);
});

test('nothing is saved while the reservation fee is unpaid', function () {
    $project = daProject($this->customer, $this->manager, ProjectStatus::CONSULTATION, ocular: false, feePaid: false);

    daAssign($this, $this->bianca->employee_id, $project)->assertSessionHasErrors('project');

    expect($project->refresh()->design_specialist_id)->toBeNull();
});

test('with no ocular visit needed, a booked project can be assigned', function () {
    $project = daProject($this->customer, $this->manager, ProjectStatus::BOOKED, ocular: false);

    daAssign($this, $this->marco->employee_id, $project)->assertSessionHasNoErrors();

    expect($project->refresh()->status->status_name)->toBe(ProjectStatus::DESIGNING);
});

test('another specialist can be assigned until a design proposal is submitted', function () {
    daAssign($this, $this->bianca->employee_id);

    daAssign($this, $this->bianca->employee_id)->assertSessionHasErrors('specialistId'); // already assigned
    daAssign($this, $this->marco->employee_id)->assertSessionHasNoErrors();
    expect($this->project->refresh()->design_specialist_id)->toBe($this->marco->employee_id);

    DesignProposal::create([
        'project_id' => $this->project->project_id,
        'design_specialist_id' => $this->marco->employee_id,
        'version_number' => 1,
        'quotation_amount' => 180000,
        'status' => DesignProposal::STATUS_SUBMITTED,
    ]);

    daAssign($this, $this->bianca->employee_id)->assertSessionHasErrors('specialistId');
    expect($this->project->refresh()->design_specialist_id)->toBe($this->marco->employee_id);
});