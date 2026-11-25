<?php

use App\Enums\Role;
use App\Models\Billing;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\EventType;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Services\Billings;
use App\Services\ReservationFees;
use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Billing & Payments: every bill grouped by project, a
 * bill's own page, and billing disputes.
 *
 * "Today" is Monday, Nov 16, 2026 (Manila). The reservation fee (₱25,000) was
 * issued Nov 15 and is due Nov 22.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);
    $this->travelTo(Carbon::parse('2026-11-16 10:00', 'Asia/Manila'));

    [$this->user, $this->customer] = blCustomer();
    $this->project = blProject($this->customer);
    $this->bill = app(ReservationFees::class)->issue($this->project, Carbon::parse('2026-11-15 10:00', 'Asia/Manila'));
});

/** @return array{0: User, 1: Customer} */
function blCustomer(): array
{
    $user = User::factory()->create(['role' => Role::Customer]);

    return [$user, Customer::create([
        'user_id' => $user->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => uniqueMobile(),
    ])];
}

/** Consultation done, the customer chose to proceed; the reservation fee is next. */
function blProject(Customer $customer, string $eventType = 'Wedding'): Project
{
    $request = ServiceRequest::create([
        'customer_id' => $customer->customer_id,
        'request_type' => ServiceRequest::TYPE_STANDARD,
        'event_type_id' => EventType::where('event_type_name', $eventType)->value('event_type_id'),
        'request_date' => '2026-11-01',
        'start_date' => '2027-01-16',
        'end_date' => '2027-01-16',
        'event_start_time' => '14:00',
        'event_end_time' => '22:00',
        'venue' => 'Garden Pavilion, Tagaytay',
        'guest_count' => 150,
        'budget_min' => 100000,
        'budget_max' => 250000,
        'request_status' => ServiceRequest::STATUS_APPROVED,
    ]);

    $manager = Employee::query()->first() ?? Employee::create([
        'position_id' => EmployeePosition::where('position_name', 'Project Manager')->value('position_id'),
        'first_name' => 'Paolo',
        'last_name' => 'Reyes',
        'contact_number' => '09181112222',
        'email' => 'pm@example.com',
    ]);

    $project = Project::create([
        'service_request_id' => $request->service_request_id,
        'project_manager_id' => $manager->employee_id,
        'current_status_id' => ProjectStatus::idFor(ProjectStatus::CONSULTATION),
        'customer_proceed_decision' => Project::DECISION_PROCEED,
        'ocular_visit_required' => true,
    ]);

    $project->schedules()->createMany([
        ['schedule_type' => ProjectSchedule::TYPE_EVENT, 'start_datetime' => '2027-01-16 14:00', 'end_datetime' => '2027-01-16 22:00', 'schedule_status' => ProjectSchedule::STATUS_TENTATIVE],
        ['schedule_type' => ProjectSchedule::TYPE_CONSULTATION, 'start_datetime' => '2026-11-14 10:00', 'end_datetime' => '2026-11-14 11:00', 'schedule_status' => ProjectSchedule::STATUS_COMPLETED],
    ]);

    return $project;
}

function blPayment(Billing $bill, string $status): Payment
{
    return $bill->payments()->create([
        'amount_paid' => $bill->amount,
        'payment_reference' => '1029384756',
        'payment_date' => '2026-11-16 09:00',
        'submitted_at' => '2026-11-16 09:05',
        'payment_method' => Payment::METHOD_GCASH,
        'status' => $status,
    ]);
}

function blDispute($test, array $data = [])
{
    // Files in datasets are made lazily (closures).
    $data = array_map(fn ($v) => $v instanceof Closure ? $v() : $v, $data);

    return $test->actingAs($test->user)->post("/customer/billing/{$test->bill->billing_id}/dispute", array_merge([
        'details' => 'The fee should be based on my minimum budget of ₱100,000.',
    ], $data));
}

/* ---------------- The list ---------------- */

test('Billing & Payments lists one row per project with bills: paid, remaining and the next bill due', function () {
    // A second project with a paid reservation fee.
    $paidProject = blProject($this->customer, 'Birthday');
    $paidBill = app(ReservationFees::class)->issue($paidProject, Carbon::parse('2026-11-10 10:00', 'Asia/Manila'));
    blPayment($paidBill, Payment::STATUS_VERIFIED);

    // A project without bills is not listed, nor is another customer's.
    blProject($this->customer, 'Debut');
    [, $other] = blCustomer();
    app(ReservationFees::class)->issue(blProject($other));

    $this->actingAs($this->user)->get('/customer/billing')
        ->assertInertia(fn (Assert $page) => $page
            ->component('customer/billing')
            ->has('projects', 2)
            ->where('projects.0.id', $paidProject->project_id) // newest project first
            ->where('projects.0.paid', fn ($v) => (float) $v === 25000.0)
            ->where('projects.0.remaining', fn ($v) => (float) $v === 0.0)
            ->where('projects.0.nextBill', null)
            ->where('projects.0.fullyPaid', false) // only the reservation fee so far: nothing due, not fully paid
            ->where('projects.0.bills.0.state', 'paid')
            ->where('projects.1.id', $this->project->project_id)
            ->where('projects.1.url', "/customer/billing/projects/{$this->project->project_id}")
            ->where('projects.1.contractPrice', null)
            ->where('projects.1.remaining', fn ($v) => (float) $v === 25000.0)
            ->where('projects.1.nextBill.title', 'Reservation fee')
            ->where('projects.1.nextBill.kind', 'reservation_fee')
            ->where('projects.1.nextBill.dueDate', '2026-11-22')
            ->where('projects.1.bills.0.canPay', true)
            ->where('projects.1.bills.0.url', "/customer/billing/{$this->bill->billing_id}"));
});

test('a project billing page shows its totals and bills, for its customer only', function () {
    $url = "/customer/billing/projects/{$this->project->project_id}";

    $this->actingAs($this->user)->get($url)
        ->assertInertia(fn (Assert $page) => $page
            ->component('customer/billing-project')
            ->where('project.title', 'Wedding')
            ->where('project.remaining', fn ($v) => (float) $v === 25000.0)
            ->has('project.bills', 1)
            ->where('project.bills.0.title', 'Reservation fee'));

    // The bill page links back to it.
    $this->actingAs($this->user)->get("/customer/billing/{$this->bill->billing_id}")
        ->assertInertia(fn (Assert $page) => $page->where('project.billingUrl', $url));

    [$otherUser] = blCustomer();
    $this->actingAs($otherUser)->get($url)->assertNotFound();
});

test('a bill page belongs to its customer only', function () {
    [$otherUser] = blCustomer();
    $base = "/customer/billing/{$this->bill->billing_id}";

    $this->actingAs($this->user)->get($base)->assertOk();
    $this->actingAs($otherUser)->get($base)->assertNotFound();
    $this->actingAs($otherUser)->post("{$base}/dispute", ['details' => str_repeat('a', 30)])->assertNotFound();
    $this->actingAs($otherUser)->get("{$base}/dispute-proof")->assertNotFound();
});

/* ---------------- Disputes ---------------- */

test('a dispute puts the bill on hold: it cannot be paid until it is resolved', function () {
    blDispute($this, ['proof' => UploadedFile::fake()->create('budget-form.pdf', 200, 'application/pdf')])->assertSessionHasNoErrors();

    $bill = $this->bill->refresh();
    expect($bill->dispute_status)->toBe(Billing::DISPUTE_PENDING)
        ->and($bill->dispute_details)->toBe('The fee should be based on my minimum budget of ₱100,000.')
        ->and($bill->dispute_proof_file_name)->toBe('budget-form.pdf')
        ->and($bill->dispute_submitted_at)->not->toBeNull();
    Storage::assertExists($bill->dispute_proof_file_path);

    $this->actingAs($this->user)->get("/customer/billing/{$bill->billing_id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('bill.state', 'disputed')
            ->where('payment.canPay', false)
            ->where('payment.payBlockedReason', 'This bill is on hold while your dispute is reviewed.')
            ->where('dispute.status', 'pending')
            ->where('dispute.proof.name', 'budget-form.pdf')
            ->where('dispute.canDispute', false));

    $this->actingAs($this->user)->get("/customer/billing/{$bill->billing_id}/dispute-proof")->assertOk();

    $this->actingAs($this->user)->post("/customer/billing/{$bill->billing_id}/payments", [
        'reference' => '1029384756', 'paymentDate' => '2026-11-16', 'amount' => '25000',
        'receipt' => UploadedFile::fake()->create('receipt.pdf', 100, 'application/pdf'),
    ])->assertSessionHasErrors(['payment' => 'This bill is on hold while your dispute is reviewed.']);

    $this->actingAs($this->user)->get("/customer/projects/{$this->project->project_id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('nextAction.title', 'Your reservation fee is disputed')
            ->where('nextAction.actionNeeded', false)
            ->where('steps.1.note', 'Fee disputed'));
});

test('a dispute needs a reason; the proof is optional but must be a PDF, JPG or PNG up to 5 MB', function (array $data, string $field) {
    blDispute($this, $data)->assertSessionHasErrors($field);

    expect($this->bill->refresh()->dispute_status)->toBeNull();
})->with([
    'no reason' => [['details' => ''], 'details'],
    'too short' => [['details' => 'Wrong amount'], 'details'],
    'too long' => [['details' => str_repeat('a', 1001)], 'details'],
    'a Word file' => [['proof' => fn () => UploadedFile::fake()->create('proof.docx', 100, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')], 'proof'],
    'over 5 MB' => [['proof' => fn () => UploadedFile::fake()->create('proof.pdf', 5 * 1024 + 1, 'application/pdf')], 'proof'],
]);

test('a dispute without proof is fine', function () {
    blDispute($this)->assertSessionHasNoErrors();

    expect($this->bill->refresh()->dispute_status)->toBe(Billing::DISPUTE_PENDING)
        ->and($this->bill->dispute_proof_file_path)->toBeNull();
});

test('a bill can be disputed once, and not when it is paid or a payment is under review', function () {
    blPayment($this->bill, Payment::STATUS_SUBMITTED);
    blDispute($this)->assertSessionHasErrors(['dispute' => 'Your payment for this bill is waiting for verification.']);

    $this->bill->payments()->update(['status' => Payment::STATUS_VERIFIED]);
    blDispute($this)->assertSessionHasErrors(['dispute' => 'A paid bill cannot be disputed.']);

    $this->bill->payments()->delete();
    blDispute($this)->assertSessionHasNoErrors();
    blDispute($this)->assertSessionHasErrors(['dispute' => 'This bill has already been disputed.']);
});

test('an open dispute stops the reservation fee from going overdue', function () {
    blDispute($this);

    $this->travelTo(Carbon::parse('2026-11-25 08:00', 'Asia/Manila'));

    expect(app(ReservationFees::class)->cancelOverdue())->toBe(0)
        ->and($this->project->refresh()->status->status_name)->toBe(ProjectStatus::CONSULTATION)
        ->and($this->bill->refresh()->status)->toBe(Billing::STATUS_ISSUED);
});

/* ---------------- Resolving (Project Manager side, through the service) ---------------- */

test('an adjusted dispute changes the amount and due date, and the bill can be paid again', function () {
    blDispute($this);
    $service = app(Billings::class);

    $service->markDisputeReviewed($this->bill->refresh());
    expect($this->bill->refresh()->dispute_status)->toBe(Billing::DISPUTE_REVIEWED);

    $service->resolveDispute($this->bill, Billing::RESOLUTION_ADJUSTED, 'Recomputed from the confirmed budget.', 20000, Carbon::parse('2026-11-26'));

    $bill = $this->bill->refresh();
    expect($bill->dispute_status)->toBe(Billing::DISPUTE_RESOLVED)
        ->and($bill->dispute_resolution)->toBe(Billing::RESOLUTION_ADJUSTED)
        ->and($bill->dispute_remarks)->toBe('Recomputed from the confirmed budget.')
        ->and((float) $bill->amount)->toBe(20000.0)
        ->and($bill->due_date->toDateString())->toBe('2026-11-26');

    $this->actingAs($this->user)->get("/customer/billing/{$bill->billing_id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('bill.state', 'unpaid')
            ->where('payment.canPay', true)
            ->where('dispute.status', 'resolved')
            ->where('dispute.resolution', 'adjusted')
            ->where('dispute.canDispute', false));
});

test('resolving needs remarks, and a corrected amount unless rejected', function () {
    blDispute($this);
    $service = app(Billings::class);
    $bill = $this->bill->refresh();

    expect(fn () => $service->resolveDispute($bill, Billing::RESOLUTION_UPHELD, 'Corrected.', null, Carbon::parse('2026-11-26')))
        ->toThrow(InvalidArgumentException::class)
        ->and(fn () => $service->resolveDispute($bill, Billing::RESOLUTION_REJECTED, '  ', null, Carbon::parse('2026-11-26')))
        ->toThrow(InvalidArgumentException::class);

    $service->resolveDispute($bill, Billing::RESOLUTION_REJECTED, 'The fee follows the top of your budget range.', null, Carbon::parse('2026-11-24'));
    expect((float) $bill->refresh()->amount)->toBe(25000.0)
        ->and($bill->due_date->toDateString())->toBe('2026-11-24');

    expect(fn () => $service->resolveDispute($bill, Billing::RESOLUTION_REJECTED, 'Again.', null, Carbon::parse('2026-11-24')))
        ->toThrow(LogicException::class);
});

test('billings has the ERD dispute columns plus the agreed remarks and proof file name', function () {
    expect(\Illuminate\Support\Facades\Schema::hasColumns('billings', [
        'dispute_details', 'dispute_proof_file_path', 'dispute_proof_file_name', 'dispute_status',
        'dispute_resolution', 'dispute_remarks', 'dispute_submitted_at', 'dispute_resolved_at',
    ]))->toBeTrue();
});
