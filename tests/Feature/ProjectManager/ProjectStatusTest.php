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
use App\Services\ExecutionSchedules;
use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use App\Mail\NoticeMail;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Backlog #35: Update the project's status.
 *   1. The status and remarks are saved; Cancelled needs remarks.
 *   2. Cancelling emails a cancellation notice to both Heads.
 * Decided with the user (Nov 28): installation done (1–10 photos) completes the project.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);
    Mail::fake();
    Storage::fake();

    $this->pm = User::factory()->create(['role' => Role::ProjectManager, 'name' => 'Paolo Reyes']);
    $manager = Employee::create([
        'user_id' => $this->pm->id,
        'position_id' => EmployeePosition::where('position_name', 'Project Manager')->value('position_id'),
        'first_name' => 'Paolo',
        'last_name' => 'Reyes',
        'contact_number' => '09181112222',
        'email' => 'pm@example.com',
    ]);

    $this->fabHead = psHead('Fabrication Head', 'Mark', 'mark@example.com');
    $this->instHead = psHead('Installation Head', 'Jun', 'jun@example.com');

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
        'fabrication' => ['headId' => $this->fabHead->employee_id, 'activity' => 'Build the stage backdrop and floral arch', 'startDate' => '2027-01-10', 'targetDate' => '2027-01-20'],
        'installation' => ['headId' => $this->instHead->employee_id, 'activity' => 'Set up the stage and ceiling drapes', 'startDate' => '2027-02-12', 'targetDate' => '2027-02-13'],
    ])->assertSessionHasNoErrors();

    // The work orders from #33.
    foreach (['fabrication', 'installation'] as $phase) {
        $this->actingAs($this->pm)->post(route('project-manager.projects.work-orders.send', [$this->project, $phase]), ['instructions' => 'Follow the approved design.']);
    }
    Mail::fake(); // only count the emails sent by #35
});

function psHead(string $position, string $first, ?string $email): Employee
{
    return Employee::create([
        'position_id' => EmployeePosition::where('position_name', $position)->value('position_id'),
        'first_name' => $first,
        'last_name' => 'Cruz',
        'contact_number' => '09170000000',
        'email' => $email,
    ]);
}

function psDone($test, string $phase, int $photos = 2)
{
    $files = array_map(fn ($i) => UploadedFile::fake()->image("done-{$i}.jpg"), $photos > 0 ? range(1, $photos) : []);

    return $test->actingAs($test->pm)->post(route('project-manager.projects.assignments.complete', [$test->project, $phase]), ['photos' => $files, 'note' => 'All set up.']);
}

function psCancel($test, ?string $remarks)
{
    return $test->actingAs($test->pm)->patch(route('project-manager.projects.status', $test->project), ['status' => 'Cancelled', 'remarks' => $remarks]);
}

function psStatus($test): string
{
    return $test->project->fresh()->status->status_name;
}

test('marking fabrication done needs photos, then opens installation and notifies the customer', function () {
    psDone($this, 'fabrication', 0)->assertSessionHasErrors('photos');
    expect(psStatus($this))->toBe(ProjectStatus::FABRICATING);

    psDone($this, 'fabrication')->assertSessionHasNoErrors();

    expect(psStatus($this))->toBe(ProjectStatus::INSTALLING);
    Mail::assertSent(NoticeMail::class, fn (NoticeMail $m) => $m->heading === 'Fabrication is done');
});

test('marking installation done completes the project with the note as remarks', function () {
    psDone($this, 'fabrication');
    psDone($this, 'installation')->assertSessionHasNoErrors();

    $project = $this->project->fresh();
    expect($project->status->status_name)->toBe(ProjectStatus::COMPLETED)
        ->and($project->status_remarks)->toBe('All set up.')
        ->and($project->status_changed_at)->not->toBeNull();

    $this->actingAs($this->pm)->get(route('project-manager.projects.show', $this->project))
        ->assertInertia(fn (Assert $page) => $page->where('project.statusUpdates.0.status', 'Completed'));
    Mail::assertSent(NoticeMail::class, fn (NoticeMail $m) => $m->heading === 'Your project is completed');
});

test('a phase cannot be marked done before its work order is sent', function () {
    $this->project->schedules()->update(['work_order_sent_at' => null]);

    psDone($this, 'fabrication')->assertSessionHasErrors('photos');

    expect(psStatus($this))->toBe(ProjectStatus::FABRICATING);
});

test('cancelling needs remarks, saves them and emails both heads and the customer', function () {
    psCancel($this, '  ')->assertSessionHasErrors('remarks');
    expect(psStatus($this))->toBe(ProjectStatus::FABRICATING);

    psCancel($this, 'The customer cancelled the event.')->assertSessionHasNoErrors();

    $project = $this->project->fresh();
    expect($project->status->status_name)->toBe(ProjectStatus::CANCELLED)
        ->and($project->status_remarks)->toBe('The customer cancelled the event.');

    Mail::assertSent(NoticeMail::class, fn (NoticeMail $m) => $m->hasTo('mark@example.com') && $m->heading === 'Project cancelled');
    Mail::assertSent(NoticeMail::class, fn (NoticeMail $m) => $m->hasTo('jun@example.com') && $m->heading === 'Project cancelled');
    Mail::assertSent(NoticeMail::class, fn (NoticeMail $m) => $m->heading === 'Your project was cancelled');
});

test('Completed cannot be set by hand, and a completed project cannot be cancelled', function () {
    $this->actingAs($this->pm)->patch(route('project-manager.projects.status', $this->project), ['status' => 'Completed', 'remarks' => 'Done'])
        ->assertSessionHasErrors('status');

    $this->project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::COMPLETED)]);
    psCancel($this, 'Too late.')->assertSessionHasErrors('remarks');

    expect(psStatus($this))->toBe(ProjectStatus::COMPLETED);
});