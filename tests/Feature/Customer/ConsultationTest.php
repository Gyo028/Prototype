<?php

use App\Enums\Role;
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
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Customer books, reschedules and cancels a consultation.
 * "Today" is fixed at Monday, Nov 16, 2026 (Manila), so the earliest
 * bookable day is Monday, Nov 23. Nov 29 is a Sunday.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);
    Carbon::setTestNow(Carbon::parse('2026-11-16 10:00', 'Asia/Manila'));

    [$this->user, $this->customer] = csCustomer();
    $this->project = csProject($this->customer);
});

afterEach(fn () => Carbon::setTestNow());

/** @return array{0: User, 1: Customer} */
function csCustomer(): array
{
    $user = User::factory()->create(['role' => Role::Customer]);

    return [$user, Customer::create([
        'user_id' => $user->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => '09171234567',
    ])];
}

function csProjectManager(): Employee
{
    return Employee::query()->first() ?? Employee::create([
        'position_id' => EmployeePosition::where('position_name', 'Project Manager')->value('position_id'),
        'first_name' => 'Paolo',
        'last_name' => 'Reyes',
        'contact_number' => '09181112222',
        'email' => 'pm@example.com',
    ]);
}

/** An approved standard request on Jan 16, 2027, with its project in the given status. */
function csProject(Customer $customer, string $status = ProjectStatus::CONSULTATION, string $eventDate = '2027-01-16'): Project
{
    $request = ServiceRequest::create([
        'customer_id' => $customer->customer_id,
        'request_type' => ServiceRequest::TYPE_STANDARD,
        'event_type_id' => EventType::where('event_type_name', 'Wedding')->value('event_type_id'),
        'request_date' => '2026-11-10',
        'start_date' => $eventDate,
        'end_date' => $eventDate,
        'event_start_time' => '14:00',
        'event_end_time' => '22:00',
        'venue' => 'Garden Pavilion, Tagaytay',
        'guest_count' => 150,
        'budget_min' => 250000,
        'budget_max' => 500000,
        'request_status' => ServiceRequest::STATUS_APPROVED,
    ]);

    $project = Project::create([
        'service_request_id' => $request->service_request_id,
        'project_manager_id' => csProjectManager()->employee_id,
        'current_status_id' => ProjectStatus::idFor($status),
    ]);

    $project->schedules()->create([
        'schedule_type' => ProjectSchedule::TYPE_EVENT,
        'start_datetime' => "{$eventDate} 14:00",
        'end_datetime' => "{$eventDate} 22:00",
        'schedule_status' => ProjectSchedule::STATUS_TENTATIVE,
    ]);

    return $project;
}

function csBook(array $overrides = []): array
{
    return array_merge(['date' => '2026-11-23', 'time' => '09:00', 'meetingMode' => 'online'], $overrides);
}

function csUrl(Project $project, string $action = ''): string
{
    return "/customer/projects/{$project->project_id}/consultation".($action ? "/{$action}" : '');
}

/** The project's consultation rows, oldest first. */
function csConsultations(Project $project)
{
    return $project->schedules()->where('schedule_type', ProjectSchedule::TYPE_CONSULTATION)->orderBy('schedule_id')->get();
}

/* ---------------- My Projects and the folder ---------------- */

test('my projects lists the customer\'s own requests, approved and pending, and nobody else\'s', function () {
    ServiceRequest::create([
        'customer_id' => $this->customer->customer_id,
        'request_type' => ServiceRequest::TYPE_CUSTOM,
        'project_title' => 'Christmas mall center display',
        'request_date' => '2026-11-15',
        'start_date' => '2027-02-01',
        'end_date' => '2027-02-10',
        'venue' => 'SM Megamall Atrium',
        'budget_min' => 100000,
        'budget_max' => 250000,
    ]);
    [, $other] = csCustomer();
    csProject($other);

    $this->actingAs($this->user)
        ->get('/customer/projects')
        ->assertInertia(fn (Assert $page) => $page
            ->component('customer/projects')
            ->has('items', 2)
            ->where('items.0.projectId', null)
            ->where('items.0.requestStatus', 'pending')
            ->where('items.1.projectId', $this->project->project_id)
            ->where('items.1.status.name', 'Consultation')
            ->where('items.1.status.phase', 'Planning'));
});

test('a customer cannot open someone else\'s project', function () {
    [$otherUser] = csCustomer();

    $this->actingAs($otherUser)->get("/customer/projects/{$this->project->project_id}")->assertNotFound();
    $this->actingAs($otherUser)->post(csUrl($this->project), csBook())->assertNotFound();
});

test('the folder offers Monday to Saturday slots from 7 days ahead, without taken ones', function () {
    // Another customer's consultation takes Nov 23, 10:00.
    [, $other] = csCustomer();
    csProject($other)->schedules()->create([
        'schedule_type' => ProjectSchedule::TYPE_CONSULTATION,
        'start_datetime' => '2026-11-23 10:00',
        'end_datetime' => '2026-11-23 11:00',
        'schedule_status' => ProjectSchedule::STATUS_CONFIRMED,
    ]);

    $this->actingAs($this->user)
        ->get("/customer/projects/{$this->project->project_id}")
        ->assertInertia(fn (Assert $page) => $page
            ->component('customer/project-show')
            ->where('consultation.canBook', true)
            ->where('rules.earliestDate', '2026-11-23')
            ->where('rules.latestDate', '2027-01-15')
            ->missing('availableSlots.2026-11-22') // too soon
            ->missing('availableSlots.2026-11-29') // Sunday
            ->where('availableSlots.2026-11-23', ['09:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'])
            ->has('availableSlots.2026-11-24', 8)
            ->missing('availableSlots.2027-01-16')); // event day
});

/* ---------------- Booking ---------------- */

test('a booking is saved as confirmed, with the meeting mode', function () {
    $this->actingAs($this->user)->post(csUrl($this->project), csBook(['meetingMode' => 'face_to_face']))->assertSessionHasNoErrors();

    $booking = csConsultations($this->project)->sole();

    expect($booking->schedule_status)->toBe(ProjectSchedule::STATUS_CONFIRMED)
        ->and($booking->meeting_mode)->toBe(ProjectSchedule::MODE_FACE_TO_FACE)
        ->and($booking->start_datetime->format('Y-m-d H:i'))->toBe('2026-11-23 09:00')
        ->and($booking->end_datetime->format('Y-m-d H:i'))->toBe('2026-11-23 10:00');
});

test('a booking must follow the slot rules', function (array $data, string $field) {
    $this->actingAs($this->user)->post(csUrl($this->project), csBook($data))->assertSessionHasErrors($field);

    expect(csConsultations($this->project))->toHaveCount(0);
})->with([
    'less than 7 days ahead' => [['date' => '2026-11-20'], 'time'],
    'a Sunday' => [['date' => '2026-11-29'], 'time'],
    'before 9 AM' => [['time' => '08:00'], 'time'],
    'at 5 PM' => [['time' => '17:00'], 'time'],
    'on the event date' => [['date' => '2027-01-16'], 'time'],
    'no meeting mode' => [['meetingMode' => ''], 'meetingMode'],
    'an unknown meeting mode' => [['meetingMode' => 'phone'], 'meetingMode'],
    'no date' => [['date' => ''], 'date'],
]);

test('a slot taken by another project\'s ocular visit cannot be booked', function () {
    [, $other] = csCustomer();
    csProject($other)->schedules()->create([
        'schedule_type' => ProjectSchedule::TYPE_OCULAR_VISIT,
        'start_datetime' => '2026-11-23 08:30',
        'end_datetime' => '2026-11-23 10:30',
        'schedule_status' => ProjectSchedule::STATUS_CONFIRMED,
    ]);

    $this->actingAs($this->user)->post(csUrl($this->project), csBook(['time' => '10:00']))->assertSessionHasErrors('time');
    $this->actingAs($this->user)->post(csUrl($this->project), csBook(['time' => '11:00']))->assertSessionHasNoErrors();
});

test('only one consultation can be booked at a time', function () {
    $this->actingAs($this->user)->post(csUrl($this->project), csBook())->assertSessionHasNoErrors();
    $this->actingAs($this->user)->post(csUrl($this->project), csBook(['time' => '13:00']))->assertSessionHasErrors('consultation');

    expect(csConsultations($this->project))->toHaveCount(1);
});

test('a consultation cannot be booked once the project has left the consultation stage', function () {
    $booked = csProject($this->customer, ProjectStatus::BOOKED);

    $this->actingAs($this->user)->post(csUrl($booked), csBook())->assertSessionHasErrors('consultation');
});

/* ---------------- Reschedule and cancel ---------------- */

test('rescheduling needs a reason and keeps the old booking as cancelled', function () {
    $this->actingAs($this->user)->post(csUrl($this->project), csBook());

    $this->actingAs($this->user)
        ->patch(csUrl($this->project, 'reschedule'), csBook(['date' => '2026-11-25', 'time' => '14:00']))
        ->assertSessionHasErrors('reason');

    $this->actingAs($this->user)
        ->patch(csUrl($this->project, 'reschedule'), csBook(['date' => '2026-11-25', 'time' => '14:00', 'reason' => 'Out of town that day.']))
        ->assertSessionHasNoErrors();

    [$old, $new] = csConsultations($this->project)->all();

    expect($old->schedule_status)->toBe(ProjectSchedule::STATUS_CANCELLED)
        ->and($old->remarks)->toBe('Rescheduled: Out of town that day.')
        ->and($old->changed_by)->toBe($this->user->id)
        ->and($new->schedule_status)->toBe(ProjectSchedule::STATUS_CONFIRMED)
        ->and($new->start_datetime->format('Y-m-d H:i'))->toBe('2026-11-25 14:00');
});

test('cancelling needs a reason, and a new consultation can be booked afterwards', function () {
    $this->actingAs($this->user)->post(csUrl($this->project), csBook());

    $this->actingAs($this->user)->patch(csUrl($this->project, 'cancel'), ['reason' => ''])->assertSessionHasErrors('reason');
    $this->actingAs($this->user)->patch(csUrl($this->project, 'cancel'), ['reason' => 'Still deciding on the venue.'])->assertSessionHasNoErrors();

    expect(csConsultations($this->project)->sole())
        ->schedule_status->toBe(ProjectSchedule::STATUS_CANCELLED)
        ->remarks->toBe('Cancelled: Still deciding on the venue.');

    // The cancelled slot is free again.
    $this->actingAs($this->user)->post(csUrl($this->project), csBook())->assertSessionHasNoErrors();
});

test('changes are allowed until the day before the appointment', function () {
    $this->actingAs($this->user)->post(csUrl($this->project), csBook()); // Nov 23, 9:00

    Carbon::setTestNow(Carbon::parse('2026-11-22 20:00', 'Asia/Manila'));
    $this->actingAs($this->user)->get("/customer/projects/{$this->project->project_id}")
        ->assertInertia(fn (Assert $page) => $page->where('consultation.canChange', true));

    Carbon::setTestNow(Carbon::parse('2026-11-23 07:00', 'Asia/Manila'));
    $this->actingAs($this->user)->get("/customer/projects/{$this->project->project_id}")
        ->assertInertia(fn (Assert $page) => $page->where('consultation.canChange', false));
    $this->actingAs($this->user)->patch(csUrl($this->project, 'cancel'), ['reason' => 'Sick.'])->assertSessionHasErrors('consultation');
});

test('nothing to reschedule or cancel without a booking', function () {
    $this->actingAs($this->user)
        ->patch(csUrl($this->project, 'cancel'), ['reason' => 'Changed my mind.'])
        ->assertSessionHasErrors('consultation');
});
