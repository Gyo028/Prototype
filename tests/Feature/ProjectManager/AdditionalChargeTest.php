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
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Backlog #29: Add additional charges.
 *   1. The details, amount and reason are saved, a bill is issued and the balance is updated.
 *   2. Nothing is saved when the amount or the reason is missing.
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

    // Fabrication, with a verified contract.
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
});

function acAdd($test, array $data)
{
    return $test->actingAs($test->pm)->post(route('project-manager.projects.additional-charges', $test->project), $data);
}

function acCharges($test)
{
    return $test->project->billings()->where('billing_type', Billing::TYPE_ADDITIONAL_CHARGE)->get();
}
test('adding a charge issues a bill due in 7 days with the details and the reason', function () {
    acAdd($this, ['description' => 'Extra lighting', 'amount' => 6000, 'reason' => 'The client added 4 uplights.'])
        ->assertSessionHasNoErrors();

    $bill = acCharges($this)->first();
    expect((float) $bill->amount)->toBe(6000.0)
        ->and($bill->status)->toBe(Billing::STATUS_ISSUED)
        ->and($bill->description)->toBe('Extra lighting — Reason: The client added 4 uplights.')
        ->and($bill->due_date->toDateString())->toBe(Carbon::now('Asia/Manila')->addDays(7)->toDateString());

    $this->actingAs($this->pm)
        ->get(route('project-manager.projects.show', $this->project))
        ->assertInertia(function (Assert $page) {
            $all = $page->toArray();
            $billing = ($all['props'] ?? $all)['project']['billings'][0];

            expect($billing['type'])->toBe('Additional Charge')
                ->and($billing['description'])->toBe('Extra lighting')
                ->and($billing['reason'])->toBe('The client added 4 uplights.');
        });
});

test('the details are optional', function () {
    acAdd($this, ['amount' => 1500, 'reason' => 'Rush delivery fee.'])->assertSessionHasNoErrors();

    expect(acCharges($this)->first()->description)->toBe('Reason: Rush delivery fee.');
});

test('nothing is saved without an amount or a reason', function () {
    acAdd($this, ['description' => 'Extra lighting', 'amount' => '', 'reason' => 'Added uplights.'])->assertSessionHasErrors('amount');
    acAdd($this, ['description' => 'Extra lighting', 'amount' => 0, 'reason' => 'Added uplights.'])->assertSessionHasErrors('amount');
    acAdd($this, ['description' => 'Extra lighting', 'amount' => 6000, 'reason' => '  '])->assertSessionHasErrors('reason');

    expect(acCharges($this))->toHaveCount(0);
});

test('a charge cannot be added before the contract is verified or after the project is completed', function () {
    $this->project->contracts()->update(['status' => Contract::STATUS_SIGNED]);
    acAdd($this, ['amount' => 1000, 'reason' => 'Extra chairs.'])->assertSessionHasErrors('amount');

    $this->project->contracts()->update(['status' => Contract::STATUS_VERIFIED]);
    $this->project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::COMPLETED)]);
    acAdd($this, ['amount' => 1000, 'reason' => 'Extra chairs.'])->assertSessionHasErrors('amount');

    expect(acCharges($this))->toHaveCount(0);
});