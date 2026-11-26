<?php

use App\Enums\Role;
use App\Models\Customer;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Customer > My Profile. Registration asks only for the name, email and
 * password; the contact number is added here before the first request.
 */

beforeEach(function () {
    $this->withoutVite();
});

/** A customer straight from registration: a profile with names only. */
function pfNewCustomer(): User
{
    $user = User::factory()->create(['role' => Role::Customer, 'name' => 'Andrea Santos', 'email' => 'andrea@example.com']);
    Customer::create(['user_id' => $user->id, 'first_name' => 'Andrea', 'last_name' => 'Santos']);

    return $user;
}

function pfInput(array $overrides = []): array
{
    return array_merge([
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => '09171230001',
        'company_name' => '',
        'address' => '',
    ], $overrides);
}

test('My Profile shows the details, with the email read-only', function () {
    $this->actingAs(pfNewCustomer())->get(route('customer.profile'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('customer/profile')
            ->where('profile.firstName', 'Andrea')
            ->where('profile.email', 'andrea@example.com')
            ->where('profile.contactNumber', '')
            ->where('complete', false)
            ->where('customerProfileComplete', false));
});

test('saving the contact number completes the profile and returns to the dashboard', function () {
    $user = pfNewCustomer();

    $this->actingAs($user)
        ->patch(route('customer.profile.update'), pfInput(['contact_number' => '+63 917-123-0001', 'company_name' => 'Acme Corp.']))
        ->assertRedirect(route('customer.dashboard'));

    $customer = Customer::where('user_id', $user->id)->firstOrFail();

    expect($customer->contact_number)->toBe('09171230001') // saved as 09…
        ->and($customer->company_name)->toBe('Acme Corp.')
        ->and($customer->address)->toBeNull()
        ->and($customer->isComplete())->toBeTrue();

    $this->actingAs($user)->get(route('customer.new-request'))->assertOk();
});

test('later changes stay on My Profile, and the account name follows', function () {
    $user = pfNewCustomer();
    $this->actingAs($user)->patch(route('customer.profile.update'), pfInput());

    $this->actingAs($user)
        ->patch(route('customer.profile.update'), pfInput(['first_name' => 'Andi', 'address' => 'Quezon City']))
        ->assertRedirect(route('customer.profile'));

    expect($user->fresh()->name)->toBe('Andi Santos')
        ->and(Customer::where('user_id', $user->id)->value('address'))->toBe('Quezon City');
});

test('a contact number belongs to one customer, whichever way it is written', function () {
    $other = User::factory()->create(['role' => Role::Customer]);
    Customer::create(['user_id' => $other->id, 'first_name' => 'Jo', 'last_name' => 'Cruz', 'contact_number' => '09171230001']);

    $this->actingAs(pfNewCustomer())
        ->patch(route('customer.profile.update'), pfInput(['contact_number' => '+639171230001']))
        ->assertSessionHasErrors(['contact_number' => 'This contact number is already registered.']);
});

test('the customer can keep their own number when saving again', function () {
    $user = pfNewCustomer();
    $this->actingAs($user)->patch(route('customer.profile.update'), pfInput());

    $this->actingAs($user)->patch(route('customer.profile.update'), pfInput())->assertSessionHasNoErrors();
});

test('names and a valid mobile number are required', function (string $field, string $value) {
    $this->actingAs(pfNewCustomer())
        ->patch(route('customer.profile.update'), pfInput([$field => $value]))
        ->assertSessionHasErrors($field);
})->with([
    ['first_name', ''],
    ['last_name', ''],
    ['contact_number', ''],
    ['contact_number', '12345'],
    ['contact_number', '0817123456'],
]);

test('an account from before profiles were made at registration gets one when saving', function () {
    $user = User::factory()->create(['role' => Role::Customer, 'name' => 'Old Account']);

    $this->actingAs($user)->get(route('customer.profile'))
        ->assertInertia(fn (Assert $page) => $page->where('profile.firstName', 'Old')->where('profile.lastName', 'Account'));

    $this->actingAs($user)->patch(route('customer.profile.update'), pfInput(['first_name' => 'Old', 'last_name' => 'Account']));

    expect(Customer::where('user_id', $user->id)->value('contact_number'))->toBe('09171230001');
});

test('the dashboard points a new customer to My Profile', function () {
    $this->actingAs(pfNewCustomer())->get(route('customer.dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('profileMissing', true));
});

test('only customers have My Profile', function () {
    $admin = User::factory()->create(['role' => Role::TechnicalAdmin]);

    $this->actingAs($admin)->get(route('customer.profile'))->assertForbidden();
    $this->actingAs($admin)->patch(route('customer.profile.update'), pfInput())->assertForbidden();
});
