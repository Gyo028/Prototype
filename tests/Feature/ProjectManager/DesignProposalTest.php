<?php

use App\Enums\Role;
use App\Models\Customer;
use App\Models\DesignProposal;
use App\Models\DesignProposalFile;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\EventType;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Backlog #24: Review the design proposal.
 *   1. The proposal, the finalized quotation and the decision are saved.
 *   2. Returning for revision needs remarks.
 *   3. It cannot be approved while the quotation is incomplete or has missing prices.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);
    Storage::fake();

    $this->pm = User::factory()->create(['role' => Role::ProjectManager, 'name' => 'Paolo Reyes']);
    $manager = dpEmployee($this->pm, 'Project Manager', 'Paolo', 'Reyes');
    $this->designer = dpEmployee(User::factory()->create(['role' => Role::DesignSpecialist]), 'Design Specialist', 'Bianca', 'Cruz');

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

    $this->project = Project::create([
        'service_request_id' => $request->service_request_id,
        'project_manager_id' => $manager->employee_id,
        'design_specialist_id' => $this->designer->employee_id,
        'design_assigned_at' => now()->subDays(5),
        'current_status_id' => ProjectStatus::idFor(ProjectStatus::DESIGNING),
        'customer_proceed_decision' => Project::DECISION_PROCEED,
        'ocular_visit_required' => false,
    ]);

    $this->proposal = dpProposal($this->project, $this->designer, 1);
});

function dpEmployee(User $user, string $position, string $first, string $last): Employee
{
    return Employee::create([
        'user_id' => $user->id,
        'position_id' => EmployeePosition::where('position_name', $position)->value('position_id'),
        'first_name' => $first,
        'last_name' => $last,
        'contact_number' => '0918'.random_int(1000000, 9999999),
        'email' => strtolower($first).'@example.com',
        'employee_status' => Employee::STATUS_ACTIVE,
    ]);
}

/** A submitted version with two quotation lines (₱150,000) and a 2D design file. */
function dpProposal(Project $project, Employee $designer, int $version, array $attributes = []): DesignProposal
{
    $proposal = DesignProposal::create([
        'project_id' => $project->project_id,
        'design_specialist_id' => $designer->employee_id,
        'version_number' => $version,
        'quotation_amount' => 150000,
        'status' => DesignProposal::STATUS_SUBMITTED,
        'submitted_at' => now()->subDay(),
    ] + $attributes);

    $proposal->items()->createMany([
        ['item_name' => 'Stage backdrop', 'description' => 'Fabric draping', 'quantity' => 1, 'unit' => 'set', 'unit_price' => 90000, 'subtotal' => 90000, 'sort_order' => 1],
        ['item_name' => 'Flower arch', 'description' => 'Fresh flowers', 'quantity' => 2, 'unit' => 'pc', 'unit_price' => 30000, 'subtotal' => 60000, 'sort_order' => 2],
    ]);

    Storage::put("design/v{$version}.pdf", 'pdf');
    $proposal->files()->create(['file_category' => DesignProposalFile::CATEGORY_2D, 'file_name' => "design-v{$version}.pdf", 'file_path' => "design/v{$version}.pdf", 'is_current' => true]);

    return $proposal;
}

function dpPage($test): array
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

function dpLines(DesignProposal $proposal): array
{
    return $proposal->items()->get()->map(fn ($i) => ['id' => 'item-'.$i->item_id, 'description' => $i->item_name, 'quantity' => $i->quantity, 'unitPrice' => (float) $i->unit_price])->all();
}

function dpDecide($test, string $decision, array $data)
{
    return $test->actingAs($test->pm)->patch(route("project-manager.projects.design-proposal.{$decision}", $test->project), $data);
}
test('the project page shows the submitted proposal with the designer\'s quotation lines', function () {
    $proposal = dpPage($this)['designProposal'];

    expect($proposal['version'])->toBe(1)
        ->and($proposal['status'])->toBe('Submitted')
        ->and($proposal['submittedBy'])->toBe('Bianca Cruz')
        ->and($proposal['files'][0]['category'])->toBe('2D design')
        ->and($proposal['quotation']['items'])->toHaveCount(2)
        ->and($proposal['quotation']['items'][1]['description'])->toBe('Flower arch')
        ->and($proposal['quotation']['discount'])->toBe(0)
        ->and($proposal['review'])->toBeNull();
});

test('approving saves the finalized quotation and the decision; the Owner reviews next', function () {
    $lines = dpLines($this->proposal);
    $lines[0]['unitPrice'] = 95000;                                                       // price changed
    unset($lines[1]);                                                                     // line removed
    $lines[] = ['id' => 'item-new-1', 'description' => 'Entrance signage', 'quantity' => 1, 'unitPrice' => 8500]; // line added

    dpDecide($this, 'approve', ['remarks' => 'Looks good.', 'quotation' => ['items' => array_values($lines), 'discount' => 0]])
        ->assertSessionHasNoErrors();

    $this->proposal->refresh()->load('items');
    expect($this->proposal->pm_review_decision)->toBe(DesignProposal::APPROVED)
        ->and($this->proposal->pm_remarks)->toBe('Looks good.')
        ->and($this->proposal->pm_reviewed_at)->not->toBeNull()
        ->and((float) $this->proposal->quotation_amount)->toBe(103500.0)
        ->and($this->proposal->items->pluck('item_name')->all())->toBe(['Stage backdrop', 'Entrance signage'])
        ->and($this->proposal->items[0]->description)->toBe('Fabric draping'); // the designer's details are kept

    $page = dpPage($this)['designProposal'];
    expect($page['status'])->toBe('Awaiting Owner')
        ->and($page['review']['reviewedBy'])->toBe('Paolo Reyes');
});

test('a proposal cannot be approved while a price is missing', function () {
    $lines = dpLines($this->proposal);
    $lines[1]['unitPrice'] = 0;

    dpDecide($this, 'approve', ['quotation' => ['items' => $lines, 'discount' => 0]])->assertSessionHasErrors('quotation');

    expect($this->proposal->refresh()->pm_review_decision)->toBe(DesignProposal::PENDING)
        ->and((float) $this->proposal->quotation_amount)->toBe(150000.0);
});

test('a proposal cannot be approved with an empty quotation or a line without a description', function () {
    dpDecide($this, 'approve', ['quotation' => ['items' => [], 'discount' => 0]])->assertSessionHasErrors('quotation');

    $lines = dpLines($this->proposal);
    $lines[0]['description'] = '   ';
    dpDecide($this, 'approve', ['quotation' => ['items' => $lines, 'discount' => 0]])->assertSessionHasErrors('quotation');

    expect($this->proposal->refresh()->pm_review_decision)->toBe(DesignProposal::PENDING);
});

test('returning for revision needs remarks', function () {
    dpDecide($this, 'return', ['remarks' => ''])->assertSessionHasErrors('remarks');
    expect($this->proposal->refresh()->pm_review_decision)->toBe(DesignProposal::PENDING);

    dpDecide($this, 'return', ['remarks' => 'Move the stage to the north wall.'])->assertSessionHasNoErrors();

    $this->proposal->refresh();
    expect($this->proposal->pm_review_decision)->toBe(DesignProposal::REVISION_REQUESTED)
        ->and($this->proposal->pm_remarks)->toBe('Move the stage to the north wall.')
        ->and(dpPage($this)['designProposal']['status'])->toBe('Returned for Revision');
});

test('a reviewed version cannot be reviewed again; the next version can', function () {
    dpDecide($this, 'return', ['remarks' => 'Change the colors.']);
    dpDecide($this, 'approve', ['quotation' => ['items' => dpLines($this->proposal), 'discount' => 0]])->assertSessionHasErrors('remarks');

    $next = dpProposal($this->project, $this->designer, 2);
    expect(dpPage($this)['designProposal']['version'])->toBe(2);

    dpDecide($this, 'approve', ['quotation' => ['items' => dpLines($next), 'discount' => 0]])->assertSessionHasNoErrors();
    expect($next->refresh()->pm_review_decision)->toBe(DesignProposal::APPROVED)
        ->and($this->proposal->refresh()->pm_review_decision)->toBe(DesignProposal::REVISION_REQUESTED);
});

test('the page shows who sent a version back and when the customer approved', function () {
    $this->proposal->update([
        'pm_review_decision' => DesignProposal::APPROVED, 'pm_reviewed_at' => now(),
        'owner_review_decision' => DesignProposal::REVISION_REQUESTED, 'owner_remarks' => 'Use the brand colors.', 'owner_reviewed_at' => now(),
    ]);
    $page = dpPage($this)['designProposal'];
    expect($page['status'])->toBe('Returned for Revision')
        ->and($page['review']['reviewedBy'])->toBe('Owner')
        ->and($page['review']['remarks'])->toBe('Use the brand colors.');

    $this->proposal->update(['owner_review_decision' => DesignProposal::APPROVED]);
    expect(dpPage($this)['designProposal']['status'])->toBe('Awaiting Customer');

    $this->proposal->update(['customer_decision' => DesignProposal::APPROVED, 'decision_date' => now()]);
    expect(dpPage($this)['designProposal']['status'])->toBe('Approved');
});

test('nothing can be reviewed once the project has left Designing', function () {
    $this->project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::CONTRACT)]);

    dpDecide($this, 'return', ['remarks' => 'Too late.'])->assertSessionHasErrors('remarks');

    expect($this->proposal->refresh()->pm_review_decision)
    ->toBe(DesignProposal::PENDING);
});

test('the project manager can open a proposal file; other roles cannot', function () {
    $file = $this->proposal->files()->first();

    $this->actingAs($this->pm)->get(route('project-manager.projects.design-proposal.file', [$this->project, $file]))->assertOk();
    $this->actingAs(User::factory()->create(['role' => Role::Customer]))
        ->get(route('project-manager.projects.design-proposal.file', [$this->project, $file]))
        ->assertForbidden();
});