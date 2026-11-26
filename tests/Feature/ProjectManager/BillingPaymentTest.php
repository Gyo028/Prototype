<?php

use App\Enums\Role;
use App\Models\Billing;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\EventType;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Backlog #27 (the bills after the contract): the Project Manager verifies or rejects the
 * payments for the down payment, the remaining balance and additional charges.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);
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

    $this->customerUser = User::factory()->create(['role' => Role::Customer]);
    $customer = Customer::create([
        'user_id' => $this->customerUser->id,
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

    // Fabrication: the down payment is paid; the balance and an additional charge are due.
    $this->project = Project::create([
        'service_request_id' => $request->service_request_id,
        'project_manager_id' => $manager->employee_id,
        'current_status_id' => ProjectStatus::idFor(ProjectStatus::FABRICATING),
        'customer_proceed_decision' => Project::DECISION_PROCEED,
        'ocular_visit_required' => false,
    ]);

    $bill = fn (string $type, float $amount, string $description, string $status) => $this->project->billings()->create([
        'amount' => $amount,
        'billing_type' => $type,
        'issued_at' => now()->subDays(10),
        'due_date' => now()->addDays(20)->toDateString(),
        'status' => $status,
        'description' => $description,
    ]);

    $this->down = $bill(Billing::TYPE_FINAL_BILLING, 87500, 'Down payment (50% of the final billing)', Billing::STATUS_PAID);
    $this->balance = $bill(Billing::TYPE_FINAL_BILLING, 87500, 'Remaining balance (50% of the final billing)', Billing::STATUS_ISSUED);
    $this->extra = $bill(Billing::TYPE_ADDITIONAL_CHARGE, 6000, 'Extra lighting', Billing::STATUS_ISSUED);

    bpPayment($this->down, $this->customerUser, Payment::STATUS_VERIFIED);
    $this->payment = bpPayment($this->balance, $this->customerUser, Payment::STATUS_SUBMITTED);
});
function bpPayment(Billing $bill, User $customerUser, string $status): Payment
{
    $path = "receipts/{$bill->billing_id}-".uniqid().'.jpg';
    Storage::put($path, 'receipt');

    return $bill->payments()->create([
        'amount_paid' => $bill->amount,
        'payment_reference' => '7788990011',
        'payment_date' => now()->subDay(),
        'receipt_file_name' => 'gcash.jpg',
        'receipt_file_path' => $path,
        'submitted_at' => now()->subDay(),
        'payment_method' => Payment::METHOD_GCASH,
        'status' => $status,
        'verified_at' => $status === Payment::STATUS_VERIFIED ? now()->subDay() : null,
        'recorded_by' => $customerUser->id,
    ]);
}

function bpPage($test): array
{
    $project = null;
    $test->actingAs($test->pm)
        ->get(route('project-manager.projects.show', $test->project))
        ->assertOk()
        ->assertInertia(function (Assert $page) use (&$project) {
            $all = $page->toArray();
            $project = ($all['props'] ?? $all)['project'];
        });

    return $project;
}

test('the project page lists the bills after the contract and their payments', function () {
    $project = bpPage($this);

    expect(collect($project['billings'])->pluck('type')->all())->toBe(['Down Payment', 'Final Payment', 'Additional Charge'])
        ->and($project['billings'][2]['description'])->toBe('Extra lighting')
        ->and($project['billings'][1]['amount'])->toEqual(87500)
        ->and(collect($project['payments'])->pluck('type')->all())->toBe(['Down Payment', 'Final Payment'])
        ->and($project['payments'][1]['billingId'])->toBe($this->balance->billing_id)
        ->and($project['payments'][1]['status'])->toBe('For Verification');
});

test('verifying the balance payment marks the bill paid', function () {
    $this->actingAs($this->pm)
        ->patch(route('project-manager.projects.payments.verify', [$this->project, $this->payment]))
        ->assertSessionHasNoErrors();

    expect($this->payment->refresh()->status)->toBe(Payment::STATUS_VERIFIED)
        ->and($this->balance->refresh()->status)->toBe(Billing::STATUS_PAID)
        ->and($this->project->refresh()->status->status_name)->toBe(ProjectStatus::FABRICATING);
});

test('a partial payment leaves the bill unpaid until it is covered', function () {
    $partial = bpPayment($this->extra, $this->customerUser, Payment::STATUS_SUBMITTED);
    $partial->update(['amount_paid' => 2000]);

    $this->actingAs($this->pm)->patch(route('project-manager.projects.payments.verify', [$this->project, $partial]));

    expect($this->extra->refresh()->status)->toBe(Billing::STATUS_ISSUED);
});

test('rejecting a bill payment needs remarks', function () {
    $this->actingAs($this->pm)
        ->patch(route('project-manager.projects.payments.reject', [$this->project, $this->payment]), ['remarks' => ''])
        ->assertSessionHasErrors('remarks');

    $this->actingAs($this->pm)
        ->patch(route('project-manager.projects.payments.reject', [$this->project, $this->payment]), ['remarks' => 'The amount does not match.'])
        ->assertSessionHasNoErrors();

    expect($this->payment->refresh()->status)->toBe(Payment::STATUS_REJECTED)
        ->and($this->balance->refresh()->status)->toBe(Billing::STATUS_ISSUED);
});