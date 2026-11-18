<?php

use App\Enums\Role;
use App\Models\AppointmentOutcomeFile;
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
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Fabrication and installation:
 * the Project Manager schedules, reschedules (with a reason) and marks the
 * work done with photo proof; the customer sees it on the project page.
 *
 * "Today" is Friday, Nov 20, 2026 (Manila). The event is on Jan 16, 2027.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);
    $this->travelTo(Carbon::parse('2026-11-20 10:00', 'Asia/Manila'));

    [$this->user, $this->customer] = exCustomer();
    $this->project = exProject($this->customer);
    $this->manager = User::factory()->create(['role' => Role::ProjectManager]);
    $this->service = app(ExecutionSchedules::class);
});

/** @return array{0: User, 1: Customer} */
function exCustomer(): array
{
    $user = User::factory()->create(['role' => Role::Customer]);

    return [$user, Customer::create([
        'user_id' => $user->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => '09171234567',
    ])];
}

/** A project in Fabricating (contract and down payment done). */
function exProject(Customer $customer): Project
{
    $request = ServiceRequest::create([
        'customer_id' => $customer->customer_id,
        'request_type' => ServiceRequest::TYPE_STANDARD,
        'event_type_id' => EventType::where('event_type_name', 'Wedding')->value('event_type_id'),
        'request_date' => '2026-09-01',
        'start_date' => '2027-01-16',
        'end_date' => '2027-01-16',
        'event_start_time' => '14:00',
        'event_end_time' => '22:00',
        'venue' => 'Garden Pavilion, Tagaytay',
        'guest_count' => 150,
        'budget_min' => 250000,
        'budget_max' => 500000,
        'request_status' => ServiceRequest::STATUS_APPROVED,
    ]);

    $manager = Employee::query()->first() ?? Employee::create([
        'position_id' => EmployeePosition::where('position_name', 'Project Manager')->value('position_id'),
        'first_name' => 'Paolo',
        'last_name' => 'Reyes',
        'contact_number' => '09181112222',
        'email' => 'pm@example.com',
    ]);

    return Project::create([
        'service_request_id' => $request->service_request_id,
        'project_manager_id' => $manager->employee_id,
        'current_status_id' => ProjectStatus::idFor(ProjectStatus::FABRICATING),
        'customer_proceed_decision' => Project::DECISION_PROCEED,
        'ocular_visit_required' => false,
    ]);
}

/** @return list<UploadedFile> */
function exPhotos(int $count = 2): array
{
    return array_map(fn ($i) => UploadedFile::fake()->create("finished-{$i}.jpg", 300, 'image/jpeg'), range(1, $count));
}

function exPage($test)
{
    return $test->actingAs($test->user)->get("/customer/projects/{$test->project->project_id}");
}

function exDay(string $date): Carbon
{
    return Carbon::parse($date, 'Asia/Manila');
}

/* ---------------- Scheduling ---------------- */

test('before the dates are set, the step says they will follow', function () {
    exPage($this)->assertInertia(fn (Assert $page) => $page
        ->where('currentStep', 'fabrication')
        ->where('steps.4.note', 'Dates to follow')
        ->where('nextAction.title', 'Nothing needed from you')
        ->where('nextAction.detail', 'Our Project Manager will set the fabrication dates soon.')
        ->where('execution.fabrication.state', 'not_scheduled')
        ->where('execution.fabrication.schedule', null)
        ->where('execution.installation.event.venue', 'Garden Pavilion, Tagaytay'));
});

test('the customer sees the dates, and whether the work has started', function () {
    $this->service->schedule($this->project, ProjectSchedule::TYPE_FABRICATION, exDay('2026-11-23'), exDay('2026-12-05'), $this->manager);

    exPage($this)->assertInertia(fn (Assert $page) => $page
        ->where('execution.fabrication.state', 'scheduled')
        ->where('execution.fabrication.schedule.start', '2026-11-23')
        ->where('execution.fabrication.schedule.end', '2026-12-05')
        ->where('steps.4.note', 'Nov 23 – Dec 5')
        ->where('nextAction.detail', "We're making the pieces for your event: Mon, Nov 23, 2026 – Sat, Dec 5, 2026. You will see photos here once it is done."));

    $this->travelTo(Carbon::parse('2026-11-24 09:00', 'Asia/Manila'));

    exPage($this)->assertInertia(fn (Assert $page) => $page->where('execution.fabrication.state', 'in_progress'));
});

test('the dates must make sense, and a stage is scheduled once (then rescheduled)', function () {
    expect(fn () => $this->service->schedule($this->project, ProjectSchedule::TYPE_FABRICATION, exDay('2026-12-05'), exDay('2026-11-23')))
        ->toThrow(InvalidArgumentException::class)
        ->and(fn () => $this->service->schedule($this->project, ProjectSchedule::TYPE_EVENT, exDay('2026-11-23'), exDay('2026-11-24')))
        ->toThrow(InvalidArgumentException::class);

    $this->service->schedule($this->project, ProjectSchedule::TYPE_FABRICATION, exDay('2026-11-23'), exDay('2026-12-05'));

    expect(fn () => $this->service->schedule($this->project, ProjectSchedule::TYPE_FABRICATION, exDay('2026-11-25'), exDay('2026-12-07')))
        ->toThrow(LogicException::class);
});

test('a reschedule needs a reason, and the customer sees the old and new dates with it', function () {
    $first = $this->service->schedule($this->project, ProjectSchedule::TYPE_FABRICATION, exDay('2026-11-23'), exDay('2026-12-05'));

    expect(fn () => $this->service->reschedule($first, exDay('2026-11-26'), exDay('2026-12-08'), '  '))->toThrow(InvalidArgumentException::class);

    $new = $this->service->reschedule($first, exDay('2026-11-26'), exDay('2026-12-08'), 'Materials delayed by the supplier.', $this->manager);

    expect($first->refresh()->schedule_status)->toBe(ProjectSchedule::STATUS_CANCELLED)
        ->and($first->remarks)->toBe('Materials delayed by the supplier.')
        ->and($first->changed_by)->toBe($this->manager->id)
        ->and($new->schedule_status)->toBe(ProjectSchedule::STATUS_CONFIRMED);

    exPage($this)->assertInertia(fn (Assert $page) => $page
        ->where('execution.fabrication.schedule.start', '2026-11-26')
        ->has('execution.fabrication.changes', 1)
        ->where('execution.fabrication.changes.0.start', '2026-11-23')
        ->where('execution.fabrication.changes.0.reason', 'Materials delayed by the supplier.')
        ->where('steps.4.note', 'Nov 26 – Dec 8'));
});

/* ---------------- Done, with photos ---------------- */

test('fabrication marked done with photos moves the project to Installation; the customer sees the photos', function () {
    $fab = $this->service->schedule($this->project, ProjectSchedule::TYPE_FABRICATION, exDay('2026-11-10'), exDay('2026-11-19'));

    $this->service->markDone($fab, exPhotos(3), 'All pieces are built.', $this->manager);

    $fab->refresh();
    expect($fab->schedule_status)->toBe(ProjectSchedule::STATUS_COMPLETED)
        ->and($fab->completed_at->toDateString())->toBe('2026-11-20')
        ->and($fab->outcome->notes)->toBe('All pieces are built.')
        ->and($fab->outcome->recorded_by)->toBe($this->manager->id)
        ->and($fab->outcome->files)->toHaveCount(3)
        ->and($fab->outcome->files->pluck('file_type')->unique()->all())->toBe([AppointmentOutcomeFile::TYPE_PHOTO])
        ->and($this->project->refresh()->status->status_name)->toBe(ProjectStatus::INSTALLING);

    foreach ($fab->outcome->files as $file) {
        Storage::assertExists($file->file_path);
    }

    $photo = $fab->outcome->files->first();

    exPage($this)->assertInertia(fn (Assert $page) => $page
        ->where('currentStep', 'installation')
        ->where('steps.4.state', 'done')
        ->where('steps.4.note', 'Done Nov 20')
        ->where('execution.fabrication.state', 'done')
        ->where('execution.fabrication.schedule.completedAt', '2026-11-20')
        ->where('execution.fabrication.completion.note', 'All pieces are built.')
        ->has('execution.fabrication.completion.photos', 3)
        ->where('execution.fabrication.completion.photos.0.url', "/customer/projects/{$this->project->project_id}/work-photos/{$photo->outcome_file_id}"));

    $this->actingAs($this->user)->get("/customer/projects/{$this->project->project_id}/work-photos/{$photo->outcome_file_id}")->assertOk();

    [$otherUser] = exCustomer();
    $this->actingAs($otherUser)->get("/customer/projects/{$this->project->project_id}/work-photos/{$photo->outcome_file_id}")->assertNotFound();
});

test('installation marked done completes the project', function () {
    $this->project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::INSTALLING)]);
    $install = $this->service->schedule($this->project, ProjectSchedule::TYPE_INSTALLATION, exDay('2026-11-19'), exDay('2026-11-20'));

    $this->service->markDone($install, exPhotos(1));

    expect($this->project->refresh()->status->status_name)->toBe(ProjectStatus::COMPLETED)
        ->and($install->refresh()->outcome->notes)->toBeNull();
});

test('marking done needs 1 to 10 photos, and happens once', function () {
    $fab = $this->service->schedule($this->project, ProjectSchedule::TYPE_FABRICATION, exDay('2026-11-10'), exDay('2026-11-19'));

    expect(fn () => $this->service->markDone($fab, []))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $this->service->markDone($fab, exPhotos(11)))->toThrow(InvalidArgumentException::class)
        ->and($fab->refresh()->schedule_status)->toBe(ProjectSchedule::STATUS_CONFIRMED);

    $this->service->markDone($fab, exPhotos(1));

    expect(fn () => $this->service->markDone($fab->refresh(), exPhotos(1)))->toThrow(LogicException::class);
});

test("the PM's completion form accepts JPG, PNG or WEBP photos up to 5 MB", function (Closure $photo, bool $ok) {
    $validator = Validator::make(['photos' => [$photo()]], ExecutionSchedules::completionRules());

    expect($validator->passes())->toBe($ok);
})->with([
    'jpg' => [fn () => UploadedFile::fake()->create('a.jpg', 300, 'image/jpeg'), true],
    'png' => [fn () => UploadedFile::fake()->create('a.png', 300, 'image/png'), true],
    'pdf' => [fn () => UploadedFile::fake()->create('a.pdf', 300, 'application/pdf'), false],
    'over 5 MB' => [fn () => UploadedFile::fake()->create('a.jpg', 5 * 1024 + 1, 'image/jpeg'), false],
]);
