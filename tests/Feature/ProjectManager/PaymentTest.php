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
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Backlog #27: Verify online payments (the reservation fee, step 2 of the project page).
 *   1. The decision and the payment status are saved, and the payment record is updated.
 *   2. A payment with a missing or invalid receipt cannot be verified.
 *   3. A payment cannot be rejected without remarks.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);
    Storage::fake();

    $this->pm = User::factory()->create(['role' => Role::ProjectManager, 'name' => 'Paolo Reyes']);
    $this->manager = Employee::create([
        'user_id' => $this->pm->id,
        'position_id' => EmployeePosition::where('position_name', 'Project Manager')->value('position_id'),
        'first_name' => 'Paolo',
        'last_name' => 'Reyes',
        'contact_number' => '09181112222',
        'email' => 'pm@example.com',
    ]);

    $this->customerUser = User::factory()->create(['role' => Role::Customer]);
    $this->customer = Customer::create([
        'user_id' => $this->customerUser->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => '09171234567',
    ]);

    $this->project = pvProject($this->customer, $this->manager);
    // ₱100,000 – ₱250,000 budget → a ₱25,000 reservation fee.
    $this->bill = app(ReservationFees::class)->issue($this->project);
    $this->payment = pvPayment($this->bill, $this->customerUser);
});

/** An approved Wedding request whose consultation is done and the customer chose to proceed. */
function pvProject(Customer $customer, Employee $manager): Project
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
        'customer_proceed_decision' => Project::DECISION_PROCEED,
        'ocular_visit_required' => true,
    ]);

    $project->schedules()->createMany([
        [
            'schedule_type' => ProjectSchedule::TYPE_EVENT,
            'start_datetime' => $request->start_date->toDateString().' 14:00:00',
            'end_datetime' => $request->end_date->toDateString().' 22:00:00',
            'schedule_status' => ProjectSchedule::STATUS_TENTATIVE,
        ],
        [
            'schedule_type' => ProjectSchedule::TYPE_CONSULTATION,
            'start_datetime' => now()->subDay()->toDateString().' 10:00:00',
            'end_datetime' => now()->subDay()->toDateString().' 11:00:00',
            'schedule_status' => ProjectSchedule::STATUS_COMPLETED,
            'meeting_mode' => 'online',
        ],
    ]);

    return $project;
}

/** A GCash payment waiting for verification; pass $receipt = null for one without a receipt. */
function pvPayment(Billing $bill, User $customerUser, ?string $receipt = 'gcash-receipt.jpg'): Payment
{
    $path = null;
    if ($receipt !== null) {
        $path = "customers/1/billings/{$bill->billing_id}/receipts/{$receipt}";
        Storage::put($path, 'receipt');
    }

    return $bill->payments()->create([
        'amount_paid' => $bill->amount,
        'payment_reference' => '1029384756123',
        'payment_date' => now()->subHours(3),
        'receipt_file_name' => $receipt,
        'receipt_file_path' => $path,
        'submitted_at' => now()->subHours(2),
        'payment_method' => Payment::METHOD_GCASH,
        'status' => Payment::STATUS_SUBMITTED,
        'recorded_by' => $customerUser->id,
    ]);
}

function pvDecide($test, string $decision, ?string $remarks = null, ?Payment $payment = null)
{
    return $test->actingAs($test->pm)->patch(
        route("project-manager.projects.payments.{$decision}", [$test->project, $payment ?? $test->payment]),
        ['remarks' => $remarks],
    );
}
test('the project page lists the reservation fee payment waiting for verification', function () {
    $this->actingAs($this->pm)
        ->get(route('project-manager.projects.show', $this->project))
        ->assertOk()
        ->assertInertia(function (Assert $page) {
            $all = $page->toArray();
            $project = ($all['props'] ?? $all)['project'];

            expect($project['reservationFee'])->toEqual(['amount' => 25000, 'paid' => false])
                ->and($project['payments'])->toHaveCount(1)
                ->and($project['payments'][0]['type'])->toBe('Reservation Fee')
                ->and($project['payments'][0]['billingId'])->toBeNull()
                ->and($project['payments'][0]['method'])->toBe('GCash')
                ->and($project['payments'][0]['status'])->toBe('For Verification')
                ->and($project['payments'][0]['receipt']['url'])->toBe("/project-manager/payments/{$this->payment->payment_id}/receipt")
                ->and($project['payments'][0]['review'])->toBeNull();
        });
});

test('verifying the reservation fee marks the bill paid and books the project', function () {
    pvDecide($this, 'verify', 'Payment received in full.')->assertSessionHasNoErrors();

    $this->payment->refresh();
    expect($this->payment->status)->toBe(Payment::STATUS_VERIFIED)
        ->and($this->payment->verified_at)->not->toBeNull()
        ->and($this->payment->remarks)->toBe('Payment received in full.')
        ->and($this->bill->refresh()->status)->toBe(Billing::STATUS_PAID)
        ->and($this->project->refresh()->status->status_name)->toBe(ProjectStatus::BOOKED);
});

test('a payment without a receipt cannot be verified', function () {
    $noReceipt = pvPayment($this->bill, $this->customerUser, null);
    $this->payment->update(['status' => Payment::STATUS_REJECTED, 'remarks' => 'Wrong amount.']);

    pvDecide($this, 'verify', null, $noReceipt)->assertSessionHasErrors('receipt');

    expect($noReceipt->refresh()->status)->toBe(Payment::STATUS_SUBMITTED)
        ->and($this->bill->refresh()->status)->toBe(Billing::STATUS_ISSUED)
        ->and($this->project->refresh()->status->status_name)->toBe(ProjectStatus::CONSULTATION);
});

test('a payment with an invalid receipt file cannot be verified', function () {
    $this->payment->update(['status' => Payment::STATUS_REJECTED, 'remarks' => 'Wrong amount.']);
    $wrongFile = pvPayment($this->bill, $this->customerUser, 'receipt.docx');

    pvDecide($this, 'verify', null, $wrongFile)->assertSessionHasErrors('receipt');

    expect($wrongFile->refresh()->status)->toBe(Payment::STATUS_SUBMITTED);
});

test('a payment cannot be rejected without remarks', function () {
    pvDecide($this, 'reject', '   ')->assertSessionHasErrors('remarks');

    expect($this->payment->refresh()->status)->toBe(Payment::STATUS_SUBMITTED);
});

test('rejecting saves the remarks and leaves the bill unpaid', function () {
    pvDecide($this, 'reject', 'The receipt shows a different amount.')->assertSessionHasNoErrors();

    $this->payment->refresh();
    expect($this->payment->status)->toBe(Payment::STATUS_REJECTED)
        ->and($this->payment->remarks)->toBe('The receipt shows a different amount.')
        ->and($this->bill->refresh()->status)->toBe(Billing::STATUS_ISSUED)
        ->and($this->project->refresh()->status->status_name)->toBe(ProjectStatus::CONSULTATION);
});

test('a decided payment cannot be decided again', function () {
    pvDecide($this, 'reject', 'The receipt is blurry.');

    pvDecide($this, 'verify')->assertSessionHasErrors('remarks');

    expect($this->payment->refresh()->status)->toBe(Payment::STATUS_REJECTED);
});

test('a payment of another project cannot be decided from this project', function () {
    $other = pvProject($this->customer, $this->manager);

    $this->actingAs($this->pm)
        ->patch(route('project-manager.projects.payments.verify', [$other, $this->payment]))
        ->assertNotFound();
});

test('the project manager can open the receipt; other roles cannot', function () {
    $this->actingAs($this->pm)
        ->get(route('project-manager.payments.receipt', $this->payment))
        ->assertOk();

    $this->actingAs($this->customerUser)
        ->get(route('project-manager.payments.receipt', $this->payment))
        ->assertForbidden();
});