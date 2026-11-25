<?php

use App\Enums\Role;
use App\Models\Customer;
use App\Models\User;
use Laravel\Fortify\Features;

beforeEach(function () {
    $this->skipUnlessFortifyHas(Features::registration());
});

function regInput(array $overrides = []): array
{
    return array_merge([
        'first_name' => 'Test',
        'last_name' => 'User',
        'email' => 'test@example.com',
        'contact_number' => '09171230001',
        'company_name' => '',
        'address' => '',
        'password' => 'password',
        'password_confirmation' => 'password',
        'terms' => '1',
    ], $overrides);
}

test('registration screen can be rendered', function () {
    $response = $this->get(route('register'));

    $response->assertOk();
});

test('new users can register, then verify their email before logging in', function () {
    $response = $this->post(route('register.store'), regInput());

    // Not logged in: back to the login page with the "Check your email" modal.
    $this->assertGuest();
    $response->assertRedirect(route('login', absolute: false));
    expect(User::where('email', 'test@example.com')->exists())->toBeTrue();
});

test('registering makes a customer account and its full profile', function () {
    $this->post(route('register.store'), regInput([
        'first_name' => '  Andrea ',
        'last_name' => 'Santos',
        'email' => 'andrea@example.com',
        'contact_number' => '+63 917-123-0002',
        'company_name' => 'Acme Corp.',
    ]));

    $user = User::where('email', 'andrea@example.com')->firstOrFail();
    $customer = Customer::where('user_id', $user->id)->firstOrFail();

    expect($user->role)->toBe(Role::Customer)
        ->and($user->name)->toBe('Andrea Santos')
        ->and($customer->first_name)->toBe('Andrea')
        ->and($customer->contact_number)->toBe('09171230002') // saved as 09…
        ->and($customer->company_name)->toBe('Acme Corp.')
        ->and($customer->address)->toBeNull()
        ->and($customer->isComplete())->toBeTrue();
});

test('an empty required field says "Please fill out this field."', function () {
    $this->from(route('register'))
        ->post(route('register.store'), regInput(['first_name' => '', 'last_name' => ' ', 'email' => '', 'contact_number' => '', 'password' => '', 'password_confirmation' => '']))
        ->assertRedirect(route('register'))
        ->assertSessionHasErrors([
            'first_name' => 'Please fill out this field.',
            'last_name' => 'Please fill out this field.',
            'email' => 'Please fill out this field.',
            'contact_number' => 'Please fill out this field.',
            'password' => 'Please fill out this field.',
        ]);

    expect(User::count())->toBe(0)->and(Customer::count())->toBe(0);
});

test('each field shows one message, the most basic problem first', function () {
    $this->from(route('register'))
        ->post(route('register.store'), regInput(['contact_number' => '12345']))
        ->assertSessionHasErrors(['contact_number' => 'Enter a valid mobile number (09XXXXXXXXX or +639XXXXXXXXX).']);

    expect(session('errors')->get('contact_number'))->toHaveCount(1);
});

test('an email or contact number that is already registered is refused', function () {
    $other = User::factory()->create(['email' => 'taken@example.com']);
    Customer::create(['user_id' => $other->id, 'first_name' => 'Jo', 'last_name' => 'Cruz', 'contact_number' => '09171230001']);

    $this->from(route('register'))
        ->post(route('register.store'), regInput(['email' => 'taken@example.com', 'contact_number' => '+639171230001']))
        ->assertSessionHasErrors([
            'email' => 'This email is already registered.',
            'contact_number' => 'This contact number is already registered.',
        ]);

    expect(Customer::count())->toBe(1);
});
