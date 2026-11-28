<?php

use App\Enums\Role;
use App\Models\Billing;
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
use App\Mail\MeetingLinkMail;
use App\Mail\NoticeMail;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * The Projects pages (real data) and backlog #16: Record consultation outcomes.
 *   1. The outcome, notes, event details, ocular visit and decision are saved.
 *   2. Nothing is saved without the outcome, the ocular visit requirement and the decision.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);

    $this->pm = User::factory()->create(['role' => Role::ProjectManager, 'name' => 'Paolo Reyes']);
    $this->manager = Employee::create([
        'user_id' => $this->pm->id,
        'position_id' => EmployeePosition::where('position_name', 'Project Manager')->value('position_id'),
        'first_name' => 'Paolo',
        'last_name' => 'Reyes',
        'contact_number' => '09181112222',
        'email' => 'pm@example.com',
    ]);

    $customerUser = User::factory()->create(['role' => Role::Customer]);
    $this->customer = Customer::create([
        'user_id' => $customerUser->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => '09171234567',
    ]);

    $this->project = pmConsultationProject($this->customer, $this->manager);
    // The customer booked the consultation for tomorrow, 10:00 to 11:00.
    $this->booking = $this->project->schedules()->create([
        'schedule_type' => ProjectSchedule::TYPE_CONSULTATION,
        'start_datetime' => now()->addDay()->toDateString().' 10:00:00',
        'end_datetime' => now()->addDay()->toDateString().' 11:00:00',
        'schedule_status' => ProjectSchedule::STATUS_CONFIRMED,
        'meeting_mode' => 'online',
    ]);
});

/** An approved Wedding request (₱100,000 – ₱250,000) and its project, still at the consultation. */
function pmConsultationProject(Customer $customer, Employee $manager): Project
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
        'current_status_id' => ProjectStatus::idFor(ProjectStatus::CONSULTATION),
    ]);

    $project->schedules()->create([
        'schedule_type' => ProjectSchedule::TYPE_EVENT,
        'start_datetime' => $request->start_date->toDateString().' 14:00:00',
        'end_datetime' => $request->end_date->toDateString().' 22:00:00',
        'schedule_status' => ProjectSchedule::STATUS_TENTATIVE,
    ]);

    return $project;
}

/** A complete "Completed" consultation; override what a test needs. */
function csPayload(array $overrides = []): array
{
    return array_merge([
        'outcome' => 'Completed',
        'summary' => 'Client confirmed the rustic theme and asked for a rain plan.',
        'additionalNotes' => 'Add a tent as backup.',
        'eventDate' => now()->addMonths(3)->addDay()->toDateString(),
        'startTime' => '15:00',
        'endTime' => '23:00',
        'venue' => 'Grand Palace Events Hall, Quezon City',
        'guests' => 180,
        'budget' => '₱250,000 – ₱500,000',
        'ocularVisitRequired' => true,
        'decision' => 'Proceed',
        'decisionReason' => null,
    ], $overrides);
}

function csSave($test, array $payload)
{
    return $test->actingAs($test->pm)->patch(route('project-manager.projects.consultation', $test->project), $payload);
}

/* ---------- the Projects pages ---------- */

test('the projects list and a project page come from the database', function () {
    $this->actingAs($this->pm)
        ->get(route('project-manager.projects'))
        ->assertOk()
        ->assertInertia(function (Assert $page) {
            $all = $page->toArray();
            $projects = ($all['props'] ?? $all)['projects'];

            expect($projects)->toHaveCount(1)
                ->and($projects[0]['code'])->toStartWith('PRJ-')
                ->and($projects[0]['requestCode'])->toStartWith('REQ-')
                ->and($projects[0]['title'])->toBe('Wedding')
                ->and($projects[0]['statusName'])->toBe('Consultation')
                ->and($projects[0]['stage'])->toBe('consultation')
                ->and($projects[0]['consultationAt'])->toBe(now()->addDay()->toDateString().'T10:00')
                ->and($projects[0]['consultation'])->toBeNull();
        });

    $this->actingAs($this->pm)
        ->get(route('project-manager.projects.show', $this->project))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('project-manager/project-show')
            ->where('project.id', $this->project->project_id)
            ->where('project.reservationFee.amount', 25000));
});

/* ---------- acceptance criterion 1 ---------- */

test('a completed consultation saves the notes, the details and the decision, and issues the reservation fee', function () {
    csSave($this, csPayload())->assertSessionHasNoErrors();

    $this->booking->refresh();
    expect($this->booking->schedule_status)->toBe(ProjectSchedule::STATUS_COMPLETED)
        ->and($this->booking->outcome->notes)->toBe("Client confirmed the rustic theme and asked for a rain plan.\n\nAdditional details: Add a tent as backup.")
        ->and($this->booking->outcome->recorded_by)->toBe($this->pm->id);

    $project = $this->project->fresh(['serviceRequest', 'billings']);
    expect($project->customer_proceed_decision)->toBe(Project::DECISION_PROCEED)
        ->and($project->ocular_visit_required)->toBeTrue()
        ->and($project->serviceRequest->guest_count)->toBe(180)
        ->and($project->serviceRequest->event_start_time)->toBe('15:00:00')
        ->and((float) $project->serviceRequest->budget_max)->toBe(500000.0);

    // 10% of ₱500,000, the new budget's maximum.
    $fee = $project->billings->firstWhere('billing_type', Billing::TYPE_RESERVATION_FEE);
    expect((float) $fee->amount)->toBe(50000.0);

    // The event date moved with the agreed details.
    expect($project->eventSchedule->start_datetime->format('H:i'))->toBe('15:00');

    // The page shows it back.
    $this->actingAs($this->pm)
        ->get(route('project-manager.projects.show', $this->project))
        ->assertInertia(fn (Assert $page) => $page
            ->where('project.consultation.decision', 'Proceed')
            ->where('project.consultation.summary', 'Client confirmed the rustic theme and asked for a rain plan.')
            ->where('project.consultation.additionalNotes', 'Add a tent as backup.')
            ->where('project.consultation.recordedBy', 'Paolo Reyes')
            ->where('project.consultationAt', null));
});

test('"On hold" issues no bill and can be updated later to proceed', function () {
    csSave($this, csPayload(['decision' => 'On hold']))->assertSessionHasNoErrors();

    expect($this->project->fresh()->customer_proceed_decision)->toBe(Project::DECISION_HOLD)
        ->and($this->project->billings()->count())->toBe(0);

    csSave($this, csPayload(['decision' => 'Proceed']))->assertSessionHasNoErrors();

    expect($this->project->fresh()->customer_proceed_decision)->toBe(Project::DECISION_PROCEED)
        ->and($this->project->billings()->count())->toBe(1);
});

test('"Do not proceed" needs a reason and cancels the project', function () {
    csSave($this, csPayload(['decision' => 'Do not proceed', 'decisionReason' => '']))
        ->assertSessionHasErrors('decisionReason');

    csSave($this, csPayload(['decision' => 'Do not proceed', 'decisionReason' => 'The venue cannot fit the set-up.']))
        ->assertSessionHasNoErrors();

    $project = $this->project->fresh(['status', 'eventSchedule']);
    expect($project->status->status_name)->toBe(ProjectStatus::CANCELLED)
        ->and($project->customer_proceed_decision)->toBe(Project::DECISION_CANCELLED)
        ->and($project->eventSchedule->schedule_status)->toBe(ProjectSchedule::STATUS_CANCELLED)
        ->and($project->billings()->count())->toBe(0)
        ->and($this->booking->fresh()->outcome->notes)->toContain('Reason for not proceeding: The venue cannot fit the set-up.');
});

test('"Rescheduled" closes the booking so the customer can book again', function () {
    csSave($this, ['outcome' => 'Rescheduled', 'summary' => 'The client asked to move it to next week.'])
        ->assertSessionHasNoErrors();

    $this->booking->refresh();
    expect($this->booking->schedule_status)->toBe(ProjectSchedule::STATUS_CANCELLED)
        ->and($this->booking->remarks)->toBe('Rescheduled: The client asked to move it to next week.')
        ->and($this->project->fresh()->customer_proceed_decision)->toBeNull();

    $this->actingAs($this->pm)
        ->get(route('project-manager.projects.show', $this->project))
        ->assertInertia(fn (Assert $page) => $page
            ->where('project.consultationAt', null)
            ->where('project.consultationNote', 'Rescheduled: The client asked to move it to next week.'));
});

/* ---------- acceptance criterion 2 ---------- */

test('nothing is saved without the outcome, the ocular visit requirement and the decision', function () {
    csSave($this, csPayload(['outcome' => '']))->assertSessionHasErrors('outcome');
    csSave($this, csPayload(['ocularVisitRequired' => null]))->assertSessionHasErrors('ocularVisitRequired');
    csSave($this, csPayload(['decision' => '']))->assertSessionHasErrors('decision');

    expect($this->booking->fresh()->schedule_status)->toBe(ProjectSchedule::STATUS_CONFIRMED)
        ->and($this->project->fresh()->customer_proceed_decision)->toBeNull();
});

/* ---------- other rules ---------- */

test('a consultation cannot be recorded before the customer books it', function () {
    $this->booking->delete();

    csSave($this, csPayload())->assertSessionHasErrors('outcome');
});

test('a proceed decision is final', function () {
    csSave($this, csPayload())->assertSessionHasNoErrors();

    csSave($this, csPayload(['decision' => 'On hold']))->assertSessionHasErrors('outcome');
    expect($this->project->fresh()->customer_proceed_decision)->toBe(Project::DECISION_PROCEED);
});

/* ---------- fix list (Nov 27): #16 email, adviser revision G3 meeting link ---------- */

test('the customer is emailed the consultation outcome with the reservation fee', function () {
    Mail::fake();

    csSave($this, csPayload())->assertSessionHasNoErrors();

    Mail::assertSent(NoticeMail::class, fn (NoticeMail $m) => $m->heading === 'Your consultation outcome' && isset($m->details['Reservation fee']));
});

test('the meeting link of an online consultation is emailed and saved', function () {
    Mail::fake();
    $send = fn (string $link) => $this->actingAs($this->pm)->patch(route('project-manager.projects.consultation.meeting-link', $this->project), ['link' => $link]);

    $send('')->assertSessionHasErrors('link');
    $send('meet.google.com/abc')->assertSessionHasErrors('link');
    Mail::assertNothingSent();

    $send('https://meet.google.com/abc-defg-hij')->assertSessionHasNoErrors();
    Mail::assertSent(MeetingLinkMail::class, fn (MeetingLinkMail $m) => $m->meeting['link'] === 'https://meet.google.com/abc-defg-hij');
    expect($this->booking->fresh()->meeting_link)->toBe('https://meet.google.com/abc-defg-hij');

    $this->actingAs($this->pm)->get(route('project-manager.projects.show', $this->project))
        ->assertInertia(fn (Assert $page) => $page->where('project.consultationMeeting.mode', 'Online')
            ->where('project.consultationMeeting.link', 'https://meet.google.com/abc-defg-hij'));
});

test('a face-to-face consultation gets no meeting link', function () {
    Mail::fake();
    $this->booking->update(['meeting_mode' => 'face_to_face']);

    $this->actingAs($this->pm)
        ->patch(route('project-manager.projects.consultation.meeting-link', $this->project), ['link' => 'https://meet.google.com/abc-defg-hij'])
        ->assertSessionHasErrors('link');

    Mail::assertNothingSent();
});