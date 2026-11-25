<?php

use App\Enums\Role;
use App\Models\Customer;
use App\Models\DesignProposal;
use App\Models\DesignProposalFile;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\EventType;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Services\DesignProposals;
use App\Services\ProjectProgress;
use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * The customer reviews the design proposal approved by the Project
 * Manager and the Owner, then approves it or requests revisions.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);

    [$this->user, $this->customer] = dpCustomer();
    $this->project = dpProject($this->customer);
});

/** @return array{0: User, 1: Customer} */
function dpCustomer(): array
{
    $user = User::factory()->create(['role' => Role::Customer]);

    return [$user, Customer::create([
        'user_id' => $user->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => uniqueMobile(),
    ])];
}

/** A project in Designing, with a Design Specialist assigned. */
function dpProject(Customer $customer, string $status = ProjectStatus::DESIGNING): Project
{
    $request = ServiceRequest::create([
        'customer_id' => $customer->customer_id,
        'request_type' => ServiceRequest::TYPE_STANDARD,
        'event_type_id' => EventType::where('event_type_name', 'Wedding')->value('event_type_id'),
        'request_date' => '2026-10-01',
        'start_date' => '2027-01-16',
        'end_date' => '2027-01-16',
        'event_start_time' => '14:00',
        'event_end_time' => '22:00',
        'venue' => 'Garden Pavilion, Tagaytay',
        'guest_count' => 150,
        'budget_min' => 250000,
        'budget_max' => 500000,
        'request_status' => ServiceRequest::STATUS_APPROVED,
    ]);

    $employee = fn (string $position, string $email) => Employee::create([
        'position_id' => EmployeePosition::where('position_name', $position)->value('position_id'),
        'first_name' => 'Staff',
        'last_name' => $position,
        'contact_number' => '09181112222',
        'email' => $email,
    ]);

    $manager = Employee::where('email', 'pm@example.com')->first() ?? $employee('Project Manager', 'pm@example.com');
    $designer = Employee::where('email', 'ds@example.com')->first() ?? $employee('Design Specialist', 'ds@example.com');

    $project = Project::create([
        'service_request_id' => $request->service_request_id,
        'project_manager_id' => $manager->employee_id,
        'design_specialist_id' => $designer->employee_id,
        'design_assigned_at' => '2026-11-01 09:00',
        'current_status_id' => ProjectStatus::idFor($status),
        'customer_proceed_decision' => Project::DECISION_PROCEED,
        'ocular_visit_required' => false,
    ]);

    $project->schedules()->create([
        'schedule_type' => ProjectSchedule::TYPE_EVENT,
        'start_datetime' => '2027-01-16 14:00',
        'end_datetime' => '2027-01-16 22:00',
        'schedule_status' => ProjectSchedule::STATUS_CONFIRMED,
    ]);

    return $project;
}

/** A submitted version; reviewed by the PM and the Owner unless told otherwise. */
function dpProposal(Project $project, int $version = 1, array $overrides = []): DesignProposal
{
    $proposal = DesignProposal::create(array_merge([
        'project_id' => $project->project_id,
        'design_specialist_id' => $project->design_specialist_id,
        'version_number' => $version,
        'quotation_amount' => 380000,
        'status' => DesignProposal::STATUS_SUBMITTED,
        'submitted_at' => '2026-11-10 10:00',
        'pm_review_decision' => DesignProposal::APPROVED,
        'owner_review_decision' => DesignProposal::APPROVED,
    ], $overrides));

    $proposal->items()->createMany([
        ['item_name' => 'Stage backdrop', 'quantity' => 1, 'unit' => 'set', 'unit_price' => 200000, 'subtotal' => 200000, 'sort_order' => 1],
        ['item_name' => 'Floral arrangements', 'quantity' => 12, 'unit' => 'pc', 'unit_price' => 15000, 'subtotal' => 180000, 'sort_order' => 2],
    ]);

    Storage::put("design/v{$version}.pdf", 'sample');
    $proposal->files()->create(['file_category' => DesignProposalFile::CATEGORY_2D, 'file_name' => "design-v{$version}.pdf", 'file_path' => "design/v{$version}.pdf"]);

    return $proposal;
}

function dpPage($test, Project $project)
{
    return $test->actingAs($test->user)->get("/customer/projects/{$project->project_id}");
}

function dpUrl(Project $project, DesignProposal $proposal, string $action): string
{
    return "/customer/projects/{$project->project_id}/design-proposals/{$proposal->design_proposal_id}/{$action}";
}

/* ---------------- What the customer sees ---------------- */

test('before any version is approved by the PM and the Owner, the design is being prepared', function () {
    dpProposal($this->project, 1, ['owner_review_decision' => DesignProposal::PENDING]);
    dpProposal($this->project, 2, ['status' => DesignProposal::STATUS_DRAFT, 'pm_review_decision' => DesignProposal::PENDING]);

    dpPage($this, $this->project)->assertInertia(fn (Assert $page) => $page
        ->where('currentStep', 'design')
        ->where('nextAction.title', 'Waiting for your design proposal')
        ->where('nextAction.actionNeeded', false)
        ->where('design.latest', null)
        ->where('design.canDecide', false)
        ->where('design.designerAssigned', true));
});

test('an approved version is shown with its files and quotation, and reviewing it is the action needed', function () {
    dpProposal($this->project);

    dpPage($this, $this->project)->assertInertia(fn (Assert $page) => $page
        ->where('nextAction.title', 'Review your design proposal')
        ->where('nextAction.actionNeeded', true)
        ->where('design.canDecide', true)
        ->where('design.latest.version', 1)
        ->where('design.latest.quotationAmount', fn ($v) => (float) $v === 380000.0)
        ->has('design.latest.items', 2)
        ->where('design.latest.items.1.name', 'Floral arrangements')
        ->has('design.latest.designFiles', 1)
        ->where('design.latest.decision', 'pending')
        ->has('design.history', 0));
});

test('My Projects flags the proposal waiting for the customer', function () {
    dpProposal($this->project);

    $this->actingAs($this->user)->get('/customer/projects')
        ->assertInertia(fn (Assert $page) => $page
            ->where('items.0.nextAction.title', 'Review your design proposal')
            ->where('items.0.nextAction.actionNeeded', true));
});

/* ---------------- Approving ---------------- */

test('approving saves the decision and moves the project to Contract', function () {
    $proposal = dpProposal($this->project);

    $this->actingAs($this->user)->post(dpUrl($this->project, $proposal, 'approve'))->assertSessionHasNoErrors();

    $proposal->refresh();
    expect($proposal->customer_decision)->toBe(DesignProposal::APPROVED)
        ->and($proposal->decision_date)->not->toBeNull()
        ->and($this->project->refresh()->status->status_name)->toBe(ProjectStatus::CONTRACT);

    $steps = collect(app(ProjectProgress::class)->for($this->project->refresh())['steps'])->keyBy('key');
    expect($steps['design']['state'])->toBe(ProjectProgress::DONE)
        ->and($steps['design']['note'])->toBe('Approved v1')
        ->and(collect($steps['design']['details'])->pluck('value', 'label')->all())->toMatchArray(['Version' => 'Version 1']);
});

test('only the newest pending version can be approved, once', function () {
    $old = dpProposal($this->project, 1, ['customer_decision' => DesignProposal::REVISION_REQUESTED, 'customer_remarks' => 'More flowers please.']);
    $new = dpProposal($this->project, 2);

    $this->actingAs($this->user)->post(dpUrl($this->project, $old, 'approve'))->assertSessionHasErrors('design');

    $this->actingAs($this->user)->post(dpUrl($this->project, $new, 'approve'))->assertSessionHasNoErrors();
    $this->actingAs($this->user)->post(dpUrl($this->project, $new, 'revision'), ['comments' => 'Changed my mind on colours.'])
        ->assertSessionHasErrors('design');

    expect($new->refresh()->customer_decision)->toBe(DesignProposal::APPROVED);
});

test('a version not yet approved by the Owner cannot be answered', function () {
    $proposal = dpProposal($this->project, 1, ['owner_review_decision' => DesignProposal::PENDING]);

    $this->actingAs($this->user)->post(dpUrl($this->project, $proposal, 'approve'))->assertSessionHasErrors('design');

    expect($proposal->refresh()->customer_decision)->toBe(DesignProposal::PENDING)
        ->and($this->project->refresh()->status->status_name)->toBe(ProjectStatus::DESIGNING);
});

/* ---------------- Requesting revisions ---------------- */

test('a revision request needs comments', function (string $comments) {
    $proposal = dpProposal($this->project);

    $this->actingAs($this->user)->post(dpUrl($this->project, $proposal, 'revision'), ['comments' => $comments])
        ->assertSessionHasErrors('comments');

    expect($proposal->refresh()->customer_decision)->toBe(DesignProposal::PENDING);
})->with([
    'empty' => [''],
    'only spaces' => ['     '],
    'too short' => ['Change it'],
    'too long' => [str_repeat('a', 1001)],
]);

test('a revision request is saved, and the step shows the revision in progress', function () {
    $proposal = dpProposal($this->project);

    $this->actingAs($this->user)
        ->post(dpUrl($this->project, $proposal, 'revision'), ['comments' => 'Please change the backdrop to sage green.'])
        ->assertSessionHasNoErrors();

    $proposal->refresh();
    expect($proposal->customer_decision)->toBe(DesignProposal::REVISION_REQUESTED)
        ->and($proposal->customer_remarks)->toBe('Please change the backdrop to sage green.')
        ->and($this->project->refresh()->status->status_name)->toBe(ProjectStatus::DESIGNING);

    dpPage($this, $this->project)->assertInertia(fn (Assert $page) => $page
        ->where('nextAction.title', 'Revision in progress')
        ->where('nextAction.actionNeeded', false)
        ->where('design.canDecide', false)
        ->where('design.revisionInProgress', true));
});

test('the next approved version is shown, with the earlier one and its comments in history', function () {
    dpProposal($this->project, 1, ['customer_decision' => DesignProposal::REVISION_REQUESTED, 'customer_remarks' => 'More flowers please.']);
    dpProposal($this->project, 2);

    dpPage($this, $this->project)->assertInertia(fn (Assert $page) => $page
        ->where('design.latest.version', 2)
        ->where('design.canDecide', true)
        ->where('design.revisionInProgress', false)
        ->has('design.history', 1)
        ->where('design.history.0.version', 1)
        ->where('design.history.0.comments', 'More flowers please.'));
});

test('the PM and Owner review methods make a version visible to the customer', function () {
    $proposal = dpProposal($this->project, 1, ['pm_review_decision' => DesignProposal::PENDING, 'owner_review_decision' => DesignProposal::PENDING]);
    $service = app(DesignProposals::class);

    $service->review($proposal, 'pm', true);
    expect($service->awaitingCustomer($this->project->refresh()))->toBeNull();

    $service->review($proposal->refresh(), 'owner', true);
    expect($service->awaitingCustomer($this->project->refresh())?->design_proposal_id)->toBe($proposal->design_proposal_id);
});

/* ---------------- Access ---------------- */

test('another customer cannot answer or open the proposal', function () {
    $proposal = dpProposal($this->project);
    [$otherUser] = dpCustomer();

    $this->actingAs($otherUser)->post(dpUrl($this->project, $proposal, 'approve'))->assertNotFound();

    $file = $proposal->files()->first();
    $this->actingAs($otherUser)->get("/customer/projects/{$this->project->project_id}/design-files/{$file->proposal_file_id}")->assertNotFound();
});

test('design files open for the owner only once the version is visible to them', function () {
    $visible = dpProposal($this->project, 1);
    $hidden = dpProposal($this->project, 2, ['owner_review_decision' => DesignProposal::PENDING]);
    $base = "/customer/projects/{$this->project->project_id}/design-files/";

    $this->actingAs($this->user)->get($base.$visible->files()->first()->proposal_file_id)->assertOk();
    $this->actingAs($this->user)->get($base.$visible->files()->first()->proposal_file_id.'?download=1')->assertDownload('design-v1.pdf');
    $this->actingAs($this->user)->get($base.$hidden->files()->first()->proposal_file_id)->assertNotFound();

    // A file of this project can't be reached through another project.
    $other = dpProject($this->customer);
    $this->actingAs($this->user)->get("/customer/projects/{$other->project_id}/design-files/{$visible->files()->first()->proposal_file_id}")->assertNotFound();
});
