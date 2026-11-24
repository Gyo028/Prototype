<?php

use App\Http\Controllers\Auth\EmailVerificationController;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Features;

/*
 * Unverified accounts are never logged in. After registering, or logging in
 * before verifying, the login page shows the "Verify your email" modal; the
 * link in the email works without logging in.
 */

beforeEach(function () {
    $this->withoutVite();
    Notification::fake();
});

function vmUser(): User
{
    return User::factory()->unverified()->create(['email' => 'andrea.santos@gmail.com', 'password' => 'secret-pass']);
}

test('after registering: not logged in, the login page shows "Check your email"', function () {
    $this->skipUnlessFortifyHas(Features::registration());

    $this->post(route('register.store'), [
        'name' => 'Andrea Santos',
        'email' => 'andrea.santos@gmail.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'terms' => '1',
    ])->assertRedirect(route('login'));

    $this->assertGuest();

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page
        ->component('auth/login')
        ->where('verification.reason', 'registered')
        ->where('verification.email', 'an***********@gmail.com'));
});

test('logging in before verifying: not logged in, the modal asks to verify first', function () {
    $user = vmUser();

    $this->from(route('login'))->post(route('login.store'), ['email' => $user->email, 'password' => 'secret-pass'])
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors('verification')
        ->assertSessionMissing('errors.email');

    $this->assertGuest();

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->where('verification.reason', 'login'));
});

test('a wrong password still says "Invalid credentials", with no modal', function () {
    $user = vmUser();

    $this->from(route('login'))->post(route('login.store'), ['email' => $user->email, 'password' => 'wrong'])
        ->assertSessionHasErrors('email');

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->where('verification', null));
});

test('verified accounts log in as before', function () {
    $user = User::factory()->create(['password' => 'secret-pass']);

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'secret-pass']);

    $this->assertAuthenticatedAs($user);
});

test('resend sends the email again to that account, at most once a minute', function () {
    $user = vmUser();
    RateLimiter::clear('verification-resend:'.$user->id);

    $this->withSession([EmailVerificationController::SESSION_KEY => $user->id])
        ->post('/email/verification/resend')->assertRedirect(route('login'));

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page
        ->where('verification.reason', 'resent')
        ->where('verification.retryAfter', fn ($s) => $s > 0 && $s <= 60));

    // Again within the minute: no second email.
    $this->withSession([EmailVerificationController::SESSION_KEY => $user->id])->post('/email/verification/resend');

    Notification::assertSentToTimes($user, VerifyEmail::class, 1);
});

test('resend does nothing without an account waiting for verification', function () {
    $this->post('/email/verification/resend')->assertRedirect(route('login'));

    Notification::assertNothingSent();
});

test('the email link verifies the account without logging in', function () {
    $user = vmUser();
    $url = (new VerifyEmail)->toMail($user)->viewData['url'];

    $this->get($url)
        ->assertRedirect(route('login'))
        ->assertSessionHas('status', 'Email verified. You can log in now.');

    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
    $this->assertGuest();
});

test('a link with the wrong email, or not signed, does not verify', function () {
    $user = vmUser();

    $wrong = URL::temporarySignedRoute('verification.verify.guest', now()->addHour(), ['id' => $user->id, 'hash' => sha1('someone@else.com')]);
    $this->get($wrong)->assertRedirect(route('login'));

    $this->get('/email/verify-link/'.$user->id.'/'.sha1($user->email))->assertForbidden();

    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

test('emails are masked in the modal', function () {
    expect(EmailVerificationController::mask('andrea.santos@gmail.com'))->toBe('an***********@gmail.com')
        ->and(EmailVerificationController::mask('jo@yahoo.com'))->toBe('j***@yahoo.com');
});
