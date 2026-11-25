<?php

use App\Enums\Role;
use App\Mail\TestMail;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Laravel\Fortify\Features;

/*
 * The verification email after registering, branded with the GR3AT A's logo,
 * and php artisan mail:test. Tests use the "array" mailer (phpunit.xml): no
 * email is really sent.
 */

test('users must verify their email', function () {
    expect(new User)->toBeInstanceOf(MustVerifyEmail::class);
});

test('registering sends the verification email', function () {
    $this->skipUnlessFortifyHas(Features::registration());
    Notification::fake();

    $this->post(route('register.store'), [
        'first_name' => 'Test',
        'last_name' => 'User',
        'contact_number' => uniqueMobile(),
        'email' => 'new.customer@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'terms' => '1',
    ]);

    Notification::assertSentTo(User::where('email', 'new.customer@example.com')->firstOrFail(), VerifyEmail::class);
});

test('the verification email is branded and has the verify link', function () {
    $user = User::factory()->unverified()->create(['name' => 'Andrea Santos']);
    $mail = (new VerifyEmail)->toMail($user);
    $html = (string) $mail->render();

    expect($mail->subject)->toContain('Verify your email')
        // e(): an app name like "Gr3at A's …" is written as "Gr3at A&#039;s …" in the HTML.
        ->and($html)->toContain(e(config('app.name')))
        ->toContain('Hi Andrea Santos')
        // The logo: attached to the email (a data: image when rendered here) or its URL.
        ->toMatch('/<img src="(data:image\/jpeg;base64,|[^"]*images\/contract-logo\.jpg)/')
        ->toContain('/email/verify-link/'.$user->id.'/'); // works without logging in
});

test('an unverified customer is sent to the verification page', function () {
    $user = User::factory()->unverified()->create(['role' => Role::Customer]);

    $this->actingAs($user)->get('/customer')->assertRedirect(route('verification.notice'));
});

test('mail:test sends the branded test email', function () {
    Mail::fake();

    $this->artisan('mail:test you@example.com')->assertSuccessful();

    Mail::assertSent(TestMail::class, fn (TestMail $mail) => $mail->hasTo('you@example.com'));
});

test('mail:test refuses something that is not an email address', function () {
    Mail::fake();

    $this->artisan('mail:test not-an-email')->assertFailed();

    Mail::assertNothingSent();
});
