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
use App\Mail\NoticeMail;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Backlog #13: the Project Manager reviews service requests.
 *   1. Approving saves the decision and turns the request into a project ("Consultation").
 *   2. Rejecting without remarks is never saved.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);

    $this->pm = User::factory()->create(['role' => Role::ProjectManager]);
    $this->manager = Employee::create([
        'user_id' => $this->pm->id,
        'position_id' => EmployeePosition::where('position_name', 'Project Manager')->value('position_id'),
        'first_name' => 'Paolo',
        'last_name' => 'Reyes',
        'contact_number' => '09181112222',
        'email' => 'pm@example.com',
    ]);

    $customerUser = User::factory()->create(['role' => Role::Customer, 'email' => 'andrea@example.com']);
    $this->customer = Customer::create([
        'user_id' => $customerUser->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => '09171234567',
    ]);
});

function pmRequest(Customer $customer, array $overrides = []): ServiceRequest
{
    return ServiceRequest::create(array_merge([
        'customer_id' => $customer->customer_id,
        'request_type' => ServiceRequest::TYPE_STANDARD,
        'event_type_id' => EventType::where('event_type_name', 'Wedding')->value('event_type_id'),
        'request_date' => now()->toDateString(),
        'start_date' => now()->addMonths(2)->toDateString(),
        'end_date' => now()->addMonths(2)->toDateString(),
        'event_start_time' => '14:00:00',
        'event_end_time' => '22:00:00',
        'venue' => 'Grand Palace Events Hall, Quezon City',
        'guest_count' => 150,
        'budget_min' => 250000,
        'budget_max' => 500000,
        'project_description' => 'Rustic garden wedding.',
    ], $overrides));
}

/** @return array<string, mixed> */
function pmProps(Assert $page): array
{
    $all = $page->toArray();

    return $all['props'] ?? $all;
}

/* ---------- list and page ---------- */

test('the list shows every request, first come, first served', function () {
    $first = pmRequest($this->customer);
    $this->travel(1)->hours();
    $second = pmRequest($this->customer, [
        'request_type' => ServiceRequest::TYPE_CUSTOM,
        'event_type_id' => null,
        'project_title' => 'Christmas mall display',
        'event_start_time' => null,
        'event_end_time' => null,
        'guest_count' => null,
        'budget_min' => 500000,
        'budget_max' => null,
    ]);

    $this->actingAs($this->pm)
        ->get(route('project-manager.service-requests'))
        ->assertOk()
        ->assertInertia(function (Assert $page) use ($first, $second) {
            $requests = pmProps($page)['requests'];

            expect($requests)->toHaveCount(2)
                ->and($requests[0]['id'])->toBe($first->service_request_id)
                ->and($requests[0]['title'])->toBe('Wedding')
                ->and($requests[0]['status'])->toBe('Pending')
                ->and($requests[0]['budget'])->toBe('₱250,000 – ₱500,000')
                ->and($requests[1]['id'])->toBe($second->service_request_id)
                ->and($requests[1]['title'])->toBe('Christmas mall display')   // custom: its own title
                ->and($requests[1]['budget'])->toBe('Above ₱500,000');
        });
});

test('a request opens on its own page', function () {
    $request = pmRequest($this->customer);

    $this->actingAs($this->pm)
        ->get(route('project-manager.service-requests.show', $request))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('project-manager/service-request-show')
            ->where('request.code', $request->fresh()->request_code)
            ->where('request.customer.name', 'Andrea Santos')
            ->where('request.customer.email', 'andrea@example.com')
            ->where('request.startTime', '14:00')
            ->where('request.decision', null));
});

test('other roles cannot open the Project Manager service requests', function () {
    $customerUser = User::query()->where('email', 'andrea@example.com')->first();

    $this->actingAs($customerUser)
        ->get(route('project-manager.service-requests'))
        ->assertForbidden();
});

/* ---------- acceptance criterion 1: approve ---------- */

test('approving saves the decision and creates the project', function () {
    $request = pmRequest($this->customer);

    $this->actingAs($this->pm)
        ->patch(route('project-manager.service-requests.approve', $request), ['remarks' => 'Please book a consultation.'])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $request->refresh();
    expect($request->request_status)->toBe(ServiceRequest::STATUS_APPROVED)
        ->and($request->pm_remarks)->toBe('Please book a consultation.')
        ->and($request->reviewed_at)->not->toBeNull();

    $project = Project::query()->where('service_request_id', $request->service_request_id)->first();
    expect($project)->not->toBeNull()
        ->and($project->project_manager_id)->toBe($this->manager->employee_id)
        ->and($project->status->status_name)->toBe(ProjectStatus::CONSULTATION)
        ->and($project->project_code)->toStartWith('PRJ-');

    $event = $project->eventSchedule;
    expect($event->schedule_status)->toBe(ProjectSchedule::STATUS_TENTATIVE)
        ->and($event->start_datetime->format('H:i'))->toBe('14:00');
});

test('approving without remarks is allowed', function () {
    $request = pmRequest($this->customer);

    $this->actingAs($this->pm)
        ->patch(route('project-manager.service-requests.approve', $request), ['remarks' => ''])
        ->assertSessionHasNoErrors();

    expect($request->fresh()->request_status)->toBe(ServiceRequest::STATUS_APPROVED)
        ->and($request->fresh()->pm_remarks)->toBeNull();
});

/* ---------- acceptance criterion 2: reject ---------- */

test('a rejection without remarks is not saved', function () {
    $request = pmRequest($this->customer);

    $this->actingAs($this->pm)
        ->patch(route('project-manager.service-requests.reject', $request), ['remarks' => '   '])
        ->assertSessionHasErrors('remarks');

    expect($request->fresh()->request_status)->toBe(ServiceRequest::STATUS_PENDING);
});

test('rejecting with remarks saves the decision and creates no project', function () {
    $request = pmRequest($this->customer);

    $this->actingAs($this->pm)
        ->patch(route('project-manager.service-requests.reject', $request), ['remarks' => 'The budget does not cover the services.'])
        ->assertSessionHasNoErrors();

    $request->refresh();
    expect($request->request_status)->toBe(ServiceRequest::STATUS_REJECTED)
        ->and($request->pm_remarks)->toBe('The budget does not cover the services.')
        ->and($request->project)->toBeNull();
});

/* ---------- already decided ---------- */

test('a decided request cannot be decided again', function () {
    $request = pmRequest($this->customer);
    $this->actingAs($this->pm)->patch(route('project-manager.service-requests.approve', $request));

    $this->actingAs($this->pm)
        ->patch(route('project-manager.service-requests.reject', $request), ['remarks' => 'Changed my mind.'])
        ->assertSessionHasErrors('remarks');

    expect($request->fresh()->request_status)->toBe(ServiceRequest::STATUS_APPROVED)
        ->and(Project::query()->where('service_request_id', $request->service_request_id)->count())->toBe(1);
});

/* ---------- fix list (Nov 27): #13 decision email, adviser revision G1 calendar ---------- */

test('the customer is emailed the decision', function () {
    Mail::fake();

    $approved = pmRequest($this->customer);
    $this->actingAs($this->pm)->patch(route('project-manager.service-requests.approve', $approved), ['remarks' => ''])->assertSessionHasNoErrors();
    Mail::assertSent(NoticeMail::class, fn (NoticeMail $m) => $m->hasTo('andrea@example.com') && $m->heading === 'Your service request was approved');

    $rejected = pmRequest($this->customer);
    $this->actingAs($this->pm)->patch(route('project-manager.service-requests.reject', $rejected), ['remarks' => 'Fully booked.'])->assertSessionHasNoErrors();
    Mail::assertSent(NoticeMail::class, fn (NoticeMail $m) => $m->heading === 'Your service request was rejected' && $m->details['Remarks'] === 'Fully booked.');
});

test('the calendar shows the event dates of approved projects and hides cancelled ones', function () {
    $request = pmRequest($this->customer);
    $this->actingAs($this->pm)->patch(route('project-manager.service-requests.approve', $request), ['remarks' => '']);
    $project = Project::query()->where('service_request_id', $request->service_request_id)->first();

    $events = null;
    $this->actingAs($this->pm)->get(route('project-manager.calendar'))->assertOk()
        ->assertInertia(function (Assert $page) use (&$events) {
            $all = $page->toArray();
            $events = ($all['props'] ?? $all)['events'];
        });
    expect($events)->toHaveCount(1)
        ->and($events[0]['code'])->toBe($project->project_code)
        ->and($events[0]['startDate'])->toBe($request->start_date->toDateString())
        ->and($events[0]['statusName'])->toBe('Consultation');

    $project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::CANCELLED)]);
    $this->actingAs($this->pm)->get(route('project-manager.calendar'))
        ->assertInertia(fn (Assert $page) => $page->has('events', 0));
});

/* ---------- Dashboard and Billing and Payments on real data (Nov 28) ---------- */

test('the dashboard shows the real projects and service requests', function () {
    pmRequest($this->customer);
    $approved = pmRequest($this->customer);
    $this->actingAs($this->pm)->patch(route('project-manager.service-requests.approve', $approved), ['remarks' => '']);

    $this->actingAs($this->pm)->get(route('project-manager.dashboard'))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('project-manager/dashboard')
            ->has('projects', 1)
            ->has('requests', 2)
            ->where('requests.0.status', 'Pending'));
});

test('the billing and payments page lists the real projects', function () {
    $approved = pmRequest($this->customer);
    $this->actingAs($this->pm)->patch(route('project-manager.service-requests.approve', $approved), ['remarks' => '']);

    $this->actingAs($this->pm)->get(route('project-manager.billing-payments'))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('project-manager/billing-payments')
            ->has('projects', 1));
});