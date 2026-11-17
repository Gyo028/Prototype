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
use App\Services\ReservationFees;
use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Story 26 (customer side): paying the reservation fee, Plan Project step 2.
 * "Today" is Monday, Nov 16, 2026 (Manila). The bill was issued Nov 15, so
 * it is due Nov 22. Budget ₱100,000 – ₱250,000 → fee ₱25,000.
 */

beforeEach(function () {
    $this->withoutVite();
    Storage::fake();
    $this->seed(ServiceAssetSeeder::class);
    Carbon::setTestNow(Carbon::parse('2026-11-16 10:00', 'Asia/Manila'));

    [$this->user, $this->customer] = rfCustomer();
    $this->project = rfProject($this->customer);
    $this->bill = app(ReservationFees::class)->issue($this->project, Carbon::parse('2026-11-15 10:00', 'Asia/Manila'));
});

afterEach(fn () => Carbon::setTestNow());

/** @return array{0: User, 1: Customer} */
function rfCustomer(): array
{
    $user = User::factory()->create(['role' => Role::Customer]);

    return [$user, Customer::create([
        'user_id' => $user->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => '09171234567',
    ])];
}

/** A project whose consultation is done and the customer chose to proceed. */
function rfProject(Customer $customer): Project
{
    $request = ServiceRequest::create([
        'customer_id' => $customer->customer_id,
        'request_type' => ServiceRequest::TYPE_STANDARD,
        'event_type_id' => EventType::where('event_type_name', 'Wedding')->value('event_type_id'),
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

function rfPayment(array $overrides = []): array
{
    return array_merge([
        'reference' => '1029 384 756123',
        'paymentDate' => '2026-11-16',
        'amount' => '25000.00',
        'receipt' => UploadedFile::fake()->create('gcash-receipt.png', 300, 'image/png'),
    ], $overrides);
}

function rfPayUrl(Project $project): string
{
    return "/customer/projects/{$project->project_id}/reservation-fee/payments";
}

function rfPage($test, Project $project)
{
    return $test->actingAs($test->user)->get("/customer/projects/{$project->project_id}");
}

/* ---------------- The bill ---------------- */

test('the bill is 10% of the budget maximum, due 7 days after it is issued, and issued once', function () {
    expect((float) $this->bill->amount)->toBe(25000.0)
        ->and($this->bill->due_date->toDateString())->toBe('2026-11-22')
        ->and($this->bill->status)->toBe(Billing::STATUS_ISSUED);

    app(ReservationFees::class)->issue($this->project);
    expect($this->project->billings()->count())->toBe(1);
});

test('the project page shows the bill, and paying it is the action needed', function () {
    rfPage($this, $this->project)->assertInertia(fn (Assert $page) => $page
        ->where('currentStep', 'reservation_fee')
        ->where('nextAction.title', 'Pay your reservation fee')
        ->where('nextAction.actionNeeded', true)
        ->where('reservationFee.billing.amount', fn ($v) => (float) $v === 25000.0) // JSON may send 25000 without ".0"
        ->where('reservationFee.billing.dueDate', '2026-11-22')
        ->where('reservationFee.canPay', true));
});

/* ---------------- Paying ---------------- */

test('a GCash payment is saved with its receipt and waits for verification', function () {
    $this->actingAs($this->user)->post(rfPayUrl($this->project), rfPayment())->assertSessionHasNoErrors();

    $payment = $this->bill->payments()->sole();

    expect($payment->status)->toBe(Payment::STATUS_SUBMITTED)
        ->and($payment->payment_method)->toBe(Payment::METHOD_GCASH)
        ->and($payment->payment_reference)->toBe('1029384756123') // spaces removed
        ->and((float) $payment->amount_paid)->toBe(25000.0)
        ->and($payment->recorded_by)->toBe($this->user->id)
        ->and($payment->receipt_file_name)->toBe('gcash-receipt.png');
    Storage::assertExists($payment->receipt_file_path);

    rfPage($this, $this->project)->assertInertia(fn (Assert $page) => $page
        ->where('reservationFee.canPay', false)
        ->where('nextAction.title', 'Waiting for payment verification')
        ->where('nextAction.actionNeeded', false));
});

test('a payment must follow the rules', function (array $data, string $field) {
    $this->actingAs($this->user)->post(rfPayUrl($this->project), rfPayment($data))->assertSessionHasErrors($field);

    expect($this->bill->payments()->count())->toBe(0);
})->with([
    'no reference number' => [['reference' => ''], 'reference'],
    'a reference with symbols' => [['reference' => '1029#384!'], 'reference'],
    'a future payment date' => [['paymentDate' => '2026-11-17'], 'paymentDate'],
    'paid before the bill was issued' => [['paymentDate' => '2026-11-14'], 'paymentDate'],
    'not the full amount' => [['amount' => '24000'], 'amount'],
    'no receipt' => [['receipt' => null], 'receipt'],
    'a GIF receipt' => [['receipt' => UploadedFile::fake()->create('r.gif', 10, 'image/gif')], 'receipt'],
    'a receipt over 5 MB' => [['receipt' => UploadedFile::fake()->create('r.pdf', 5121, 'application/pdf')], 'receipt'],
]);

test('only one payment can wait for verification at a time', function () {
    $this->actingAs($this->user)->post(rfPayUrl($this->project), rfPayment());
    $this->actingAs($this->user)->post(rfPayUrl($this->project), rfPayment())->assertSessionHasErrors('payment');

    expect($this->bill->payments()->count())->toBe(1);
});

test('after a rejected payment the customer pays again', function () {
    $this->bill->payments()->create([
        'amount_paid' => 25000, 'payment_reference' => '1111111111', 'payment_date' => '2026-11-15 12:00',
        'submitted_at' => '2026-11-15 12:05', 'payment_method' => Payment::METHOD_GCASH,
        'status' => Payment::STATUS_REJECTED, 'remarks' => 'Receipt is blurry',
    ]);

    rfPage($this, $this->project)->assertInertia(fn (Assert $page) => $page
        ->where('reservationFee.canPay', true)
        ->where('nextAction.title', 'Your payment was not accepted')
        ->where('nextAction.actionNeeded', true));

    $this->actingAs($this->user)->post(rfPayUrl($this->project), rfPayment())->assertSessionHasNoErrors();
    expect($this->bill->payments()->count())->toBe(2);
});

/* ---------------- Due date ---------------- */

test('the bill can still be paid on its due date', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-22 21:00', 'Asia/Manila'));

    $this->actingAs($this->user)->post(rfPayUrl($this->project), rfPayment(['paymentDate' => '2026-11-22']))->assertSessionHasNoErrors();
});

test('an unpaid bill past its due date cancels the project', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-23 08:00', 'Asia/Manila'));

    rfPage($this, $this->project)->assertInertia(fn (Assert $page) => $page
        ->where('project.status.name', 'Cancelled')
        ->where('currentStep', 'reservation_fee')
        ->where('steps.1.state', 'cancelled')
        ->where('nextAction.title', 'This project was cancelled')
        ->where('reservationFee.canPay', false));

    expect($this->bill->fresh()->status)->toBe(Billing::STATUS_OVERDUE)
        ->and($this->project->eventSchedule()->first()->schedule_status)->toBe(ProjectSchedule::STATUS_CANCELLED);

    $this->actingAs($this->user)->post(rfPayUrl($this->project), rfPayment(['paymentDate' => '2026-11-23']))->assertSessionHasErrors('payment');
});

test('a payment sent before the due date keeps the project, even if it is verified later', function () {
    $this->actingAs($this->user)->post(rfPayUrl($this->project), rfPayment());

    Carbon::setTestNow(Carbon::parse('2026-11-25 08:00', 'Asia/Manila'));
    expect(app(ReservationFees::class)->cancelOverdue())->toBe(0)
        ->and($this->project->fresh()->status->status_name)->toBe(ProjectStatus::CONSULTATION);
});

test('the daily command cancels overdue projects', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-23 00:10', 'Asia/Manila'));

    $this->artisan('billings:cancel-overdue')->assertSuccessful();
    expect($this->project->fresh()->status->status_name)->toBe(ProjectStatus::CANCELLED);
});

/* ---------------- Receipts ---------------- */

test('only the customer can open their receipt', function () {
    $this->actingAs($this->user)->post(rfPayUrl($this->project), rfPayment());
    $payment = $this->bill->payments()->sole();
    $url = "/customer/payments/{$payment->payment_id}/receipt";

    $this->actingAs($this->user)->get($url)->assertOk();

    [$other] = rfCustomer();
    $this->actingAs($other)->get($url)->assertNotFound();
    $this->actingAs($other)->post(rfPayUrl($this->project), rfPayment())->assertNotFound();
});
