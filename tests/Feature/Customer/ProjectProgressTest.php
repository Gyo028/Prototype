<?php

use App\Enums\Role;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Services\ProjectProgress;
use Database\Seeders\DatabaseSeeder;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * The customer's 7-step project timeline (ProjectProgress), checked against
 * the sample projects from ProjectSeeder: one per status, plus one on hold.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(DatabaseSeeder::class);
});

/** The seeded project in a status; $onHold picks between the two Consultation ones. */
function ppProject(string $status, bool $onHold = false): Project
{
    return Project::query()
        ->where('current_status_id', ProjectStatus::idFor($status))
        ->when($status === ProjectStatus::CONSULTATION, fn ($q) => $onHold
            ? $q->where('customer_proceed_decision', Project::DECISION_HOLD)
            : $q->whereNull('customer_proceed_decision'))
        ->firstOrFail();
}

/** ['consultation' => 'done', ...] */
function ppStates(Project $project): array
{
    return collect(app(ProjectProgress::class)->for($project)['steps'])->pluck('state', 'key')->all();
}

test('there are 7 steps in three phases (the reservation fee is a bill, not a step)', function () {
    $steps = app(ProjectProgress::class)->for(ppProject(ProjectStatus::CONSULTATION))['steps'];

    expect(collect($steps)->pluck('key')->all())->toBe([
        'consultation', 'ocular_visit', 'design', 'contract', 'fabrication', 'installation', 'completed',
    ]);
    expect(collect($steps)->countBy('phase')->all())->toBe(['planning' => 4, 'execution' => 2, 'closed' => 1]);
});

test('a new project starts at the consultation, and booking it is the action needed', function () {
    $progress = app(ProjectProgress::class)->for(ppProject(ProjectStatus::CONSULTATION));

    expect($progress['currentStep'])->toBe('consultation')
        ->and($progress['nextAction']['title'])->toBe('Book your consultation')
        ->and($progress['nextAction']['actionNeeded'])->toBeTrue()
        ->and(collect($progress['steps'])->where('state', ProjectProgress::LOCKED))->toHaveCount(6);
});

test('a project on hold stays at the consultation, with nothing to do', function () {
    $progress = app(ProjectProgress::class)->for(ppProject(ProjectStatus::CONSULTATION, onHold: true));

    expect($progress['currentStep'])->toBe('consultation')
        ->and($progress['nextAction']['title'])->toBe('Your project is on hold')
        ->and($progress['nextAction']['actionNeeded'])->toBeFalse();
});

test('each status puts the project on the right step', function (string $status, string $step) {
    expect(app(ProjectProgress::class)->for(ppProject($status))['currentStep'])->toBe($step);
})->with([
    'Booked, ocular visit needed' => [ProjectStatus::BOOKED, 'ocular_visit'],
    'Site Assessment' => [ProjectStatus::SITE_ASSESSMENT, 'ocular_visit'],
    'Designing' => [ProjectStatus::DESIGNING, 'design'],
    'Contract' => [ProjectStatus::CONTRACT, 'contract'],
    'Fabricating' => [ProjectStatus::FABRICATING, 'fabrication'],
    'Installing' => [ProjectStatus::INSTALLING, 'installation'],
    'Completed' => [ProjectStatus::COMPLETED, 'completed'],
]);

test('steps before the current one are done, and the ones after are locked', function () {
    expect(ppStates(ppProject(ProjectStatus::CONTRACT)))->toBe([
        'consultation' => 'done',
        'ocular_visit' => 'done',
        'design' => 'done',
        'contract' => 'current',
        'fabrication' => 'locked',
        'installation' => 'locked',
        'completed' => 'locked',
    ]);
});

test('the ocular visit is skipped when the consultation said it is not needed', function () {
    // The Designing sample has ocular_visit_required = false.
    expect(ppStates(ppProject(ProjectStatus::DESIGNING))['ocular_visit'])->toBe(ProjectProgress::SKIPPED);

    // A Booked project with no visit needed goes straight to design.
    $booked = ppProject(ProjectStatus::BOOKED);
    $booked->update(['ocular_visit_required' => false]);

    $progress = app(ProjectProgress::class)->for($booked->fresh());
    expect($progress['currentStep'])->toBe('design')
        ->and(collect($progress['steps'])->firstWhere('key', 'ocular_visit')['state'])->toBe(ProjectProgress::SKIPPED);
});

test('a completed project has every step done, except a skipped visit', function () {
    $states = ppStates(ppProject(ProjectStatus::COMPLETED));

    expect($states['completed'])->toBe(ProjectProgress::DONE)
        ->and($states['ocular_visit'])->toBe(ProjectProgress::SKIPPED)
        ->and(collect($states)->except('ocular_visit')->unique()->values()->all())->toBe([ProjectProgress::DONE]);
});

test('a cancelled project stops in red at the consultation', function () {
    $progress = app(ProjectProgress::class)->for(ppProject(ProjectStatus::CANCELLED));
    $states = collect($progress['steps'])->pluck('state', 'key');

    expect($states['consultation'])->toBe(ProjectProgress::CANCELLED)
        ->and($states->except('consultation')->unique()->values()->all())->toBe([ProjectProgress::LOCKED])
        ->and($progress['nextAction']['title'])->toBe('This project was cancelled');
});

test('without a layout (custom, or an older request), the reservation fee is 10% of the budget maximum, or of the minimum when there is none', function (int $min, ?int $max, float $fee) {
    expect((new ServiceRequest(['budget_min' => $min, 'budget_max' => $max]))->reservationFee())->toBe($fee);
})->with([
    'Below ₱50,000' => [0, 50000, 5000.0],
    '₱100,000 – ₱250,000' => [100000, 250000, 25000.0],
    'Above ₱500,000' => [500000, null, 50000.0],
    'exact ₱180,000' => [180000, 180000, 18000.0],
]);

test('the pages send the steps, and My Projects flags the project that needs action', function () {
    $customer = User::where('email', Role::Customer->value.'@example.com')->firstOrFail();
    $project = ppProject(ProjectStatus::CONSULTATION);

    $this->actingAs($customer)->get("/customer/projects/{$project->project_id}")
        ->assertInertia(fn (Assert $page) => $page
            ->component('customer/project-show')
            ->has('steps', 7)
            ->where('currentStep', 'consultation')
            ->where('nextAction.actionNeeded', true));

    $this->actingAs($customer)->get('/customer/projects')
        ->assertInertia(fn (Assert $page) => $page
            ->component('customer/projects')
            ->has('items', 13) // 12 projects + 1 pending request
            // Book the consultation, pay the reservation fee, book the ocular visit, review the design, and sign the contract.
            ->where('items', fn ($items) => collect($items)->where('nextAction.actionNeeded', true)->count() === 5
                && collect($items)->firstWhere('projectId', null)['nextAction']['title'] === 'Waiting for review'));
});

test('finished steps keep their details: a summary line and label/value rows', function () {
    $steps = collect(app(ProjectProgress::class)->for(ppProject(ProjectStatus::INSTALLING))['steps'])->keyBy('key');

    // The consultation summary adds the decision.
    expect($steps['consultation']['summary'])->toStartWith('Held ')->toEndWith('You decided to proceed');

    // Done steps show what happened.
    expect(collect($steps['ocular_visit']['details'])->pluck('value', 'label')->all())
        ->toMatchArray(['Status' => 'Visited']);
    expect(collect($steps['fabrication']['details'])->pluck('value', 'label')->all()['Status'])
        ->toStartWith('Done on ');

    // The current step shows its progress; locked steps show nothing yet.
    expect(collect($steps['installation']['details'])->pluck('value', 'label')->all())
        ->toMatchArray(['Status' => 'In progress']);
    expect($steps['completed']['details'])->toBe([])
        ->and($steps['completed']['summary'])->toBeNull();
});
