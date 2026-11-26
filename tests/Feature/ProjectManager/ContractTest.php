<?php

use App\Enums\Role;
use App\Models\Billing;
use App\Models\Contract;
use App\Models\Customer;
use App\Models\DesignProposal;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\EventType;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Services\Contracts;
use App\Services\ReservationFees;
use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;


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

    // Contract step: reservation fee paid (₱25,000), design approved (₱200,000).
    $this->project = Project::create([
        'service_request_id' => $request->service_request_id,
        'project_manager_id' => $manager->employee_id,
        'current_status_id' => ProjectStatus::idFor(ProjectStatus::CONTRACT),
        'customer_proceed_decision' => Project::DECISION_PROCEED,
        'ocular_visit_required' => false,
    ]);
    app(ReservationFees::class)->issue($this->project)->update(['status' => Billing::STATUS_PAID]);

    $proposal = DesignProposal::create([
        'project_id' => $this->project->project_id,
        'version_number' => 1,
        'quotation_amount' => 200000,
        'status' => DesignProposal::STATUS_SUBMITTED,
        'submitted_at' => now()->subDays(5),
        'pm_review_decision' => DesignProposal::APPROVED,
        'owner_review_decision' => DesignProposal::APPROVED,
        'customer_decision' => DesignProposal::APPROVED,
        'decision_date' => now()->subDays(2),
    ]);
    $proposal->items()->create(['item_name' => 'Full styling', 'quantity' => 1, 'unit_price' => 200000, 'subtotal' => 200000, 'sort_order' => 1]);

    $this->contracts = app(Contracts::class);
    $this->contract = $this->contracts->issue($this->project, $proposal);
});
/** The customer uploads a signed copy. */
function pmCtSign($test): Contract
{
    $test->contracts->upload($test->contract, UploadedFile::fake()->create('signed-contract.pdf', 300, 'application/pdf'));

    return $test->contract->refresh();
}

function ctDecide($test, string $decision, array $data)
{
    return $test->actingAs($test->pm)->patch(route("project-manager.projects.contract.{$decision}", $test->project), $data);
}

function pmCtPage($test): array
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

test('the page waits for the signature, then shows the signed contract for review', function () {
    expect(pmCtPage($this)['contract'])->toBeNull();

    pmCtSign($this);
    $contract = pmCtPage($this)['contract'];

    expect($contract['code'])->toBe($this->contract->code())
        ->and($contract['version'])->toBe(1)
        ->and($contract['amount'])->toEqual(200000)
        ->and($contract['status'])->toBe('For Review')
        ->and($contract['file']['name'])->toBe('signed-contract.pdf')
        ->and($contract['file']['url'])->toBe("/project-manager/projects/{$this->project->project_id}/contracts/{$this->contract->contract_id}/file")
        ->and($contract['review'])->toBeNull();
});

test('approving needs every checklist item', function () {
    pmCtSign($this);

    ctDecide($this, 'approve', ['checklist' => ['signed', 'details']])->assertSessionHasErrors('checklist');

    expect($this->contract->refresh()->status)->toBe(Contract::STATUS_SIGNED);
});

test('approving verifies the contract and issues the down payment and balance', function () {
    pmCtSign($this);

    ctDecide($this, 'approve', ['checklist' => Contracts::CHECKLIST])->assertSessionHasNoErrors();

    $this->contract->refresh();
    expect($this->contract->status)->toBe(Contract::STATUS_VERIFIED)
        ->and($this->contract->reviewed_by)->toBe($this->pm->id)
        ->and($this->contract->checklist)->toBe(Contracts::CHECKLIST)
        ->and($this->contract->executed_contract_path)->not->toBeNull()
        ->and($this->project->billings()->where('billing_type', Billing::TYPE_FINAL_BILLING)->pluck('amount')->map(fn ($a) => (float) $a)->all())
        ->toBe([87500.0, 87500.0]) // (₱200,000 − ₱25,000) split 50 / 50
        ->and($this->project->refresh()->status->status_name)->toBe(ProjectStatus::CONTRACT); // fabrication waits for the down payment

    $page = pmCtPage($this)['contract'];
    expect($page['status'])->toBe('Approved')
        ->and($page['review']['reviewedBy'])->toBe('Paolo Reyes')
        ->and($page['review']['checklist'])->toBe(Contracts::CHECKLIST);
});

test('a contract cannot be rejected without remarks', function () {
    pmCtSign($this);

    ctDecide($this, 'reject', ['remarks' => '  '])->assertSessionHasErrors('remarks');

    expect($this->contract->refresh()->status)->toBe(Contract::STATUS_SIGNED);
});

test('rejecting saves the remarks and issues the next version to sign', function () {
    pmCtSign($this);

    ctDecide($this, 'reject', ['remarks' => 'Page 2 is not signed.', 'checklist' => ['details']])->assertSessionHasNoErrors();

    expect($this->contract->refresh()->status)->toBe(Contract::STATUS_REJECTED)
        ->and($this->contract->rejection_reason)->toBe('Page 2 is not signed.')
        ->and($this->project->contracts()->where('version_number', 2)->value('status'))->toBe(Contract::STATUS_ISSUED);

    // Until version 2 is signed, the page shows the rejection.
    $page = pmCtPage($this)['contract'];
    expect($page['version'])->toBe(1)
        ->and($page['status'])->toBe('Rejected')
        ->and($page['review']['remarks'])->toBe('Page 2 is not signed.');
});

test('an unsigned or already reviewed contract cannot be reviewed', function () {
    ctDecide($this, 'approve', ['checklist' => Contracts::CHECKLIST])->assertSessionHasErrors('remarks'); // not signed yet

    pmCtSign($this);
    ctDecide($this, 'approve', ['checklist' => Contracts::CHECKLIST]);
    ctDecide($this, 'reject', ['remarks' => 'Too late.'])->assertSessionHasErrors('remarks');

    expect($this->contract->refresh()->status)->toBe(Contract::STATUS_VERIFIED);
});

test('verifying the down payment after the contract starts fabrication', function () {
    pmCtSign($this);
    ctDecide($this, 'approve', ['checklist' => Contracts::CHECKLIST]);

    $down = $this->project->billings()->where('billing_type', Billing::TYPE_FINAL_BILLING)->orderBy('billing_id')->first();
    Storage::put('receipts/down.jpg', 'receipt');
    $payment = $down->payments()->create([
        'amount_paid' => $down->amount,
        'payment_reference' => '5566778899',
        'payment_date' => now(),
        'receipt_file_name' => 'down.jpg',
        'receipt_file_path' => 'receipts/down.jpg',
        'submitted_at' => now(),
        'payment_method' => Payment::METHOD_GCASH,
        'status' => Payment::STATUS_SUBMITTED,
        'recorded_by' => $this->customerUser->id,
    ]);

    $this->actingAs($this->pm)
        ->patch(route('project-manager.projects.payments.verify', [$this->project, $payment]))
        ->assertSessionHasNoErrors();

    expect($this->project->refresh()->status->status_name)->toBe(ProjectStatus::FABRICATING);
});

test('the project manager can open the signed contract; other roles cannot', function () {
    pmCtSign($this);

    $this->actingAs($this->pm)->get(route('project-manager.projects.contract.file', [$this->project, $this->contract]))->assertOk();
    $this->actingAs($this->customerUser)->get(route('project-manager.projects.contract.file', [$this->project, $this->contract]))->assertForbidden();
});