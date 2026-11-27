<?php

use App\Enums\Role;
use App\Models\Customer;
use App\Models\Project;
use App\Models\User;
use App\Services\AppointmentScheduler;
use App\Services\ProjectProgress;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Customer > Dashboard (CustomerDashboard): the next event, what needs the
 * customer and the next consultations and ocular visits, across all their
 * projects. Checked against the sample data (one project per status).
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(DatabaseSeeder::class);
});

function dbCustomer(): User
{
    return User::where('email', Role::Customer->value.'@example.com')->firstOrFail();
}

test('the dashboard lists what needs the customer, the same actions as My Projects', function () {
    inertiaPage($this->actingAs(dbCustomer()), '/customer')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('customer/dashboard')
            ->where('hasRequests', true)
            ->where('firstName', 'Sample')
            // Book the consultation, pay the reservation fee, book the ocular visit, review the design, sign the contract.
            ->has('actions', 5)
            ->where('actions', fn ($actions) => collect($actions)->every(fn ($a) => $a['button'] !== '' && $a['note'] !== '' && str_starts_with($a['url'], '/customer/'))
                // A payment's line under the project is its amount and due date.
                && collect($actions)->where('payment', true)->every(fn ($a) => preg_match('/^₱[\d,.]+ · Due [A-Z][a-z]{2} \d{1,2}, \d{4}$/u', $a['note']) === 1)
                // A payment opens its bill; the rest open the project.
                && collect($actions)->where('payment', true)->every(fn ($a) => str_starts_with($a['url'], '/customer/billing/'))
                && collect($actions)->where('payment', false)->every(fn ($a) => str_starts_with($a['url'], '/customer/projects/')))
            // The pending sample request is waiting for review.
            ->has('pending', 1));
});

test('payment actions name their bill and a button; other actions have no bill', function () {
    $progress = app(ProjectProgress::class);
    $actions = Project::query()->get()->mapWithKeys(fn (Project $p) => [$p->project_id => $progress->for($p)['nextAction']]);

    // The sample project waiting for its reservation fee.
    $payId = $actions->search(fn ($a) => $a['title'] === 'Pay your reservation fee');
    expect($payId)->not->toBeFalse();
    $pay = $actions[$payId];
    expect($pay['button'])->toBe('Pay now')
        ->and($pay['billId'])->toBe(Project::find($payId)->reservationFee->billing_id);

    $book = $actions->first(fn ($a) => $a['title'] === 'Book your consultation');
    expect($book['button'])->toBe('Book now')->and($book['billId'])->toBeNull();

    // Nothing to do: no button.
    $actions->where('actionNeeded', false)->each(fn ($a) => expect($a['button'])->toBeNull());
});

test('upcoming shows the next 3 consultations and ocular visits in the next 30 days, soonest first', function () {
    $today = Carbon::now(AppointmentScheduler::TIMEZONE)->toDateString();
    $until = Carbon::now(AppointmentScheduler::TIMEZONE)->addDays(30)->toDateString();

    inertiaPage($this->actingAs(dbCustomer()), '/customer')
        ->assertInertia(fn (Assert $page) => $page
            ->where('upcoming', function ($items) use ($today, $until) {
                $items = collect($items);
                $dates = $items->map(fn ($u) => $u['date'].' '.$u['startTime'])->all();
                $sorted = $dates;
                sort($sorted);

                return $items->count() <= 3
                    // No event days: the countdown shows the next event.
                    && $items->every(fn ($u) => in_array($u['type'], ['consultation', 'ocular_visit'], true) && $u['date'] >= $today && $u['date'] <= $until)
                    && $dates === $sorted;
            }));
});

test('the countdown is the next event of a project still in progress', function () {
    inertiaPage($this->actingAs(dbCustomer()), '/customer')
        ->assertInertia(fn (Assert $page) => $page
            ->where('countdown', fn ($c) => $c === null || ($c['daysLeft'] >= 0 && count($c['steps']) === 7 && $c['currentNumber'] >= 1)));
});

test('the welcome line comes with the page; the countdown and both cards are deferred', function () {
    $this->actingAs(dbCustomer())->get('/customer')
        ->assertInertia(fn (Assert $page) => $page
            ->component('customer/dashboard')
            ->where('hasRequests', true)
            ->where('firstName', 'Sample')
            ->missing('countdown')
            ->missing('actions')
            ->missing('pending')
            ->missing('upcoming')
            ->loadDeferredProps('dashboard', fn (Assert $deferred) => $deferred
                ->has('countdown')
                ->has('actions', 5)
                ->has('pending', 1)
                ->has('upcoming')));
});

test('a new customer with no requests gets the getting-started dashboard', function () {
    $user = User::factory()->create(['role' => Role::Customer]);
    Customer::create(['user_id' => $user->id, 'first_name' => 'Andrea', 'last_name' => 'Santos', 'contact_number' => uniqueMobile()]);

    inertiaPage($this->actingAs($user), '/customer')
        ->assertInertia(fn (Assert $page) => $page
            ->component('customer/dashboard')
            ->where('hasRequests', false)
            ->where('firstName', 'Andrea')
            ->where('countdown', null)
            ->has('actions', 0)
            ->has('upcoming', 0)
            ->missing('updates'));
});

test('only customers can open it', function () {
    // Guest first: once actingAs runs, later requests in this test stay signed in.
    $this->get('/customer')->assertRedirect('/login');

    $staff = User::where('email', Role::ProjectManager->value.'@example.com')->first();

    if ($staff !== null) {
        inertiaPage($this->actingAs($staff), '/customer')->assertForbidden();
    }
});
