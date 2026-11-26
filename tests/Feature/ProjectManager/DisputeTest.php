<?php

use App\Enums\Role;
use App\Models\Billing;
use App\Models\Contract;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\EventType;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Backlog #31: Review and resolve billing disputes.
 *   1. The status becomes Reviewed, then the decision and resolved date are recorded and the bill is updated.
 *   2. The customer sees the resolution (remarks) on their billing page.
 *   3. Without a decision, the dispute is not marked as resolved.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);

    $this->pm = User::factory()->create(['role' => Role::ProjectManager, 'name' => 'Paolo Reyes']);
    $manager = Employee::create([
        'user_id' => $this->pm->id,
        'position_id' => EmployeePosition::where('position_name', 'Project Manager')->value('position_id'),
        'first_name' => 'Paolo',
        'last_name' => 'Reyes',
        'contact_number' => '09181112222',
        'email' => 'pm@example.com',
    ]);

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

    // Fabrication, with a verified contract and an additional charge the customer disputed.
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
    $this->bill = dspBill($this->project, Billing::TYPE_ADDITIONAL_CHARGE, 6000, 'Extra lighting — Reason: The client added 4 uplights.');
});
function dspBill(Project $project, string $type, float $amount, ?string $description = null): Billing
{
    return $project->billings()->create([
        'amount' => $amount,
        'billing_type' => $type,
        'issued_at' => now()->subDays(3),
        'due_date' => now()->addDays(4)->toDateString(),
        'status' => Billing::STATUS_ISSUED,
        'description' => $description,
        'dispute_details' => 'We only asked for 2 uplights, not 4. Please correct the charge.',
        'dispute_status' => Billing::DISPUTE_PENDING,
        'dispute_submitted_at' => now()->subDay(),
    ]);
}

function dspPage($test): array
{
    $result = null;
    $test->actingAs($test->pm)
        ->get(route('project-manager.projects.show', $test->project))
        ->assertInertia(function (Assert $page) use (&$result) {
            $all = $page->toArray();
            $result = ($all['props'] ?? $all)['project']['disputes'];
        });

    return $result;
}

function dspResolve($test, array $data)
{
    return $test->actingAs($test->pm)->patch(route('project-manager.projects.disputes.resolve', [$test->project, $test->bill]), $data);
}

function dspReview($test)
{
    return $test->actingAs($test->pm)->patch(route('project-manager.projects.disputes.review', [$test->project, $test->bill]));
}
test('the project page shows the customer\'s dispute', function () {
    $dispute = dspPage($this)[0];

    expect($dispute['code'])->toBe(sprintf('DSP-%04d', $this->bill->billing_id))
        ->and($dispute['billingType'])->toBe('Additional Charge')
        ->and($dispute['status'])->toBe('Submitted')
        ->and($dispute['reason'])->toContain('2 uplights')
        ->and($dispute['currentAmount'])->toEqual(6000)
        ->and($dispute['resolution'])->toBeNull();
});

test('start review sets the status to reviewed', function () {
    dspReview($this)->assertSessionHasNoErrors();

    expect($this->bill->fresh()->dispute_status)->toBe(Billing::DISPUTE_REVIEWED)
        ->and(dspPage($this)[0]['status'])->toBe('Reviewed');

    dspReview($this)->assertSessionHasErrors('decision');
});

test('adjusting records the decision, the resolved date, the new amount and due date', function () {
    dspReview($this);
    $due = Carbon::today('Asia/Manila')->addDays(7)->toDateString();

    dspResolve($this, ['decision' => 'Adjusted', 'newAmount' => 3000, 'remarks' => 'Corrected to 2 uplights.', 'dueDate' => $due])
        ->assertSessionHasNoErrors();

    $bill = $this->bill->fresh();
    expect($bill->dispute_status)->toBe(Billing::DISPUTE_RESOLVED)
        ->and($bill->dispute_resolution)->toBe(Billing::RESOLUTION_ADJUSTED)
        ->and($bill->dispute_remarks)->toBe('Corrected to 2 uplights.')
        ->and($bill->dispute_resolved_at)->not->toBeNull()
        ->and((float) $bill->amount)->toBe(3000.0)
        ->and($bill->due_date->toDateString())->toBe($due)
        ->and($bill->status)->toBe(Billing::STATUS_ISSUED);

    $resolution = dspPage($this)[0]['resolution'];
    expect($resolution['decision'])->toBe('Adjusted')
        ->and($resolution['newAmount'])->toEqual(3000)
        ->and($resolution['dueDate'])->toBe($due);
});

test('rejected keeps the amount; upheld needs the corrected amount', function () {
    dspReview($this);
    $due = Carbon::today('Asia/Manila')->addDays(7)->toDateString();

    dspResolve($this, ['decision' => 'Upheld', 'remarks' => 'You are right.', 'dueDate' => $due])->assertSessionHasErrors('newAmount');

    dspResolve($this, ['decision' => 'Rejected', 'newAmount' => 1, 'remarks' => 'The 4 uplights were in the signed request.', 'dueDate' => $due])
        ->assertSessionHasNoErrors();

    expect((float) $this->bill->fresh()->amount)->toBe(6000.0)
        ->and($this->bill->fresh()->dispute_resolution)->toBe(Billing::RESOLUTION_REJECTED);
});

test('nothing is resolved without a decision, remarks or a due date, or before the review', function () {
    $due = Carbon::today('Asia/Manila')->addDays(7)->toDateString();
    dspResolve($this, ['decision' => 'Rejected', 'remarks' => 'No.', 'dueDate' => $due])->assertSessionHasErrors('decision');

    dspReview($this);
    dspResolve($this, ['remarks' => 'No.', 'dueDate' => $due])->assertSessionHasErrors('decision');
    dspResolve($this, ['decision' => 'Rejected', 'remarks' => '', 'dueDate' => $due])->assertSessionHasErrors('remarks');
    dspResolve($this, ['decision' => 'Rejected', 'remarks' => 'No.'])->assertSessionHasErrors('dueDate');
    dspResolve($this, ['decision' => 'Rejected', 'remarks' => 'No.', 'dueDate' => now()->subDays(2)->toDateString()])->assertSessionHasErrors('dueDate');

    expect($this->bill->fresh()->dispute_status)->toBe(Billing::DISPUTE_REVIEWED);
});

test('a bill corrected to zero is marked paid', function () {
    dspReview($this);

    dspResolve($this, ['decision' => 'Upheld', 'newAmount' => 0, 'remarks' => 'Waived.', 'dueDate' => Carbon::today('Asia/Manila')->toDateString()])
        ->assertSessionHasNoErrors();

    expect($this->bill->fresh()->status)->toBe(Billing::STATUS_PAID);
});

test('a reservation fee dispute is labelled for the reservation fee part', function () {
    $fee = dspBill($this->project, Billing::TYPE_RESERVATION_FEE, 25000);

    $dispute = collect(dspPage($this))->firstWhere('billingId', $fee->billing_id);

    expect($dispute['billingType'])->toBe('Reservation Fee');
});

test('the project manager can open the customer\'s proof file', function () {
    Storage::fake();
    Storage::put('customers/1/billings/1/dispute/proof.pdf', 'pdf');
    $this->bill->update(['dispute_proof_file_path' => 'customers/1/billings/1/dispute/proof.pdf', 'dispute_proof_file_name' => 'proof.pdf']);

    expect(dspPage($this)[0]['proof']['name'])->toBe('proof.pdf');

    $this->actingAs($this->pm)
        ->get(route('project-manager.projects.disputes.proof', [$this->project, $this->bill]))
        ->assertOk();
});