<?php

use App\Enums\Role;
use App\Models\User;

test('the six roles exist in the roles table', function () {
    $this->assertDatabaseCount('roles', 6);

    foreach (Role::cases() as $role) {
        $this->assertDatabaseHas('roles', ['name' => $role->value]);
    }
});

test('new accounts get the customer role by default', function () {
    $user = User::factory()->create();

    expect($user->fresh()->role)->toBe(Role::Customer);
});

test('each role lands on its own dashboard after login', function (Role $role) {
    $this->withoutVite();

    $user = User::factory()->create(['role' => $role]);

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect(route('dashboard', absolute: false));

    $this->get(route('dashboard'))->assertRedirect(route($role->homeRoute()));
    $this->get(route($role->homeRoute()))->assertOk();
})->with(Role::cases());

test('a wrong password shows "Invalid credentials."', function () {
    $user = User::factory()->create();

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'wrong-password',
    ])->assertSessionHasErrors(['email' => 'Invalid credentials.']);

    $this->assertGuest();
});

test('an unknown email shows "Invalid credentials."', function () {
    $this->post(route('login.store'), [
        'email' => 'nobody@example.com',
        'password' => 'password',
    ])->assertSessionHasErrors(['email' => 'Invalid credentials.']);

    $this->assertGuest();
});

test('disabled accounts cannot log in', function () {
    $user = User::factory()->create(['account_status' => User::STATUS_DISABLED]);

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ])->assertSessionHasErrors(['email' => 'Invalid credentials.']);

    $this->assertGuest();
});

test('users cannot open another role\'s dashboard', function () {
    $customer = User::factory()->create(['role' => Role::Customer]);

    $this->actingAs($customer)
        ->get(route('technical-admin.dashboard'))
        ->assertForbidden();
});