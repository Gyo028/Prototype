<?php

use App\Enums\Role;
use App\Models\Billing;
use App\Models\Contract;
use App\Models\Customer;
use App\Models\DesignProposal;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\SampleCustomersSeeder;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * SampleCustomersSeeder: three more customer accounts, each in a different
 * situation (new; one pending request and one Booked project; busy).
 */

beforeEach(function () {
    $this->withoutVite();
    DatabaseSeeder::$withSampleCustomers = true;
    $this->seed(DatabaseSeeder::class);
});

afterEach(function () {
    DatabaseSeeder::$withSampleCustomers = null;
});

function scCustomer(string $email): Customer
{
    return Customer::query()->whereHas('user', fn ($q) => $q->where('email', $email))->firstOrFail();
}

/** @return array<string, Project> status name => project */
function scProjects(string $email): array
{
    return Project::query()
        ->with(['status', 'designProposals', 'contracts', 'billings', 'schedules.outcome'])
        ->whereHas('serviceRequest', fn ($q) => $q->where('customer_id', scCustomer($email)->customer_id))
        ->get()
        ->keyBy(fn (Project $p) => $p->status->status_name)
        ->all();
}

test('the three accounts can log in as customers and have a profile', function () {
    foreach (['steph.curry@example.com' => 'Steph', 'kevin.durant@example.com' => 'Kevin', 'lebron.james@example.com' => 'LeBron'] as $email => $first) {
        $user = User::where('email', $email)->firstOrFail();

        expect($user->role)->toBe(Role::Customer)
            ->and(scCustomer($email)->first_name)->toBe($first);
    }
});

test('Steph Curry is new: no requests yet', function () {
    expect(scCustomer('steph.curry@example.com')->serviceRequests()->count())->toBe(0);

    inertiaPage($this->actingAs(User::where('email', 'steph.curry@example.com')->first()), '/customer')
        ->assertInertia(fn (Assert $page) => $page->where('hasRequests', false));
});

test('Kevin Durant has a request waiting for review and a Booked project with its fee paid', function () {
    $requests = scCustomer('kevin.durant@example.com')->serviceRequests()->get();
    $projects = scProjects('kevin.durant@example.com');

    expect($requests)->toHaveCount(2)
        ->and($requests->where('request_status', ServiceRequest::STATUS_PENDING))->toHaveCount(1)
        ->and(array_keys($projects))->toBe([ProjectStatus::BOOKED])
        ->and($projects[ProjectStatus::BOOKED]->billings->first()->status)->toBe(Billing::STATUS_PAID);

    // Next: book the ocular visit; the pending request shows as being reviewed only when nothing needs him.
    inertiaPage($this->actingAs(User::where('email', 'kevin.durant@example.com')->first()), '/customer')
        ->assertInertia(fn (Assert $page) => $page
            ->has('actions', 1)
            ->where('actions.0.title', 'Book your ocular visit')
            ->has('pending', 1));
});

test('LeBron James has projects at Designing, Contract, Completed and Cancelled, filled in by the later seeders', function () {
    $projects = scProjects('lebron.james@example.com');

    expect(array_keys($projects))->toEqualCanonicalizing([ProjectStatus::DESIGNING, ProjectStatus::CONTRACT, ProjectStatus::COMPLETED, ProjectStatus::CANCELLED]);

    // Designing: version 2 waiting for him.
    expect($projects[ProjectStatus::DESIGNING]->designProposals->firstWhere('version_number', 2)?->customer_decision)->toBe(DesignProposal::PENDING);

    // Contract: issued, not signed yet.
    expect($projects[ProjectStatus::CONTRACT]->contracts)->toHaveCount(1)
        ->and($projects[ProjectStatus::CONTRACT]->contracts->first()->signed_at)->toBeNull();

    // Completed: contract verified, every bill paid, completion photos.
    $completed = $projects[ProjectStatus::COMPLETED];
    expect($completed->contracts->first()->status)->toBe(Contract::STATUS_VERIFIED)
        ->and($completed->billings->every(fn (Billing $b) => $b->status === Billing::STATUS_PAID))->toBeTrue()
        ->and($completed->schedules->whereIn('schedule_type', [ProjectSchedule::TYPE_FABRICATION, ProjectSchedule::TYPE_INSTALLATION])->every(fn ($s) => $s->outcome !== null))->toBeTrue();

    // Review the design and sign the contract.
    inertiaPage($this->actingAs(User::where('email', 'lebron.james@example.com')->first()), '/customer')
        ->assertInertia(fn (Assert $page) => $page->has('actions', 2));
});

test('customer@example.com keeps the same sample data', function () {
    $customer = scCustomer(Role::Customer->value.'@example.com');

    expect(Project::query()->whereHas('serviceRequest', fn ($q) => $q->where('customer_id', $customer->customer_id))->count())->toBe(12);
});

test('running it again adds nothing', function () {
    $projects = Project::count();
    $users = User::count();

    $this->seed(SampleCustomersSeeder::class);

    expect(Project::count())->toBe($projects)
        ->and(User::count())->toBe($users);
});
