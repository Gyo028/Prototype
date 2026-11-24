<?php

use Laravel\Fortify\Features;

beforeEach(function () {
    $this->skipUnlessFortifyHas(Features::registration());
});

test('registration screen can be rendered', function () {
    $response = $this->get(route('register'));

    $response->assertOk();
});

test('new users can register, then verify their email before logging in', function () {
    $response = $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'terms' => '1',
    ]);

    // Not logged in: back to the login page with the "Check your email" modal.
    $this->assertGuest();
    $response->assertRedirect(route('login', absolute: false));
    expect(\App\Models\User::where('email', 'test@example.com')->exists())->toBeTrue();
});
