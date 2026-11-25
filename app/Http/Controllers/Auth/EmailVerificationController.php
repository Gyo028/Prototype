<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Inertia;

/**
 * Email verification for people who are not logged in.
 *
 * An unverified customer is never logged in: after registering, or when
 * logging in before verifying, they stay on the login page with the
 * "Verify your email" modal (EmailVerificationController::remember() keeps
 * who they are in the session). From there:
 *
 *  - resend()  sends the email again, to that account only, once a minute
 *  - verify()  is the link in the email: signed, expires after 60 minutes,
 *              works once. It verifies the account, logs it in and opens
 *              its home page (a customer's dashboard).
 */
class EmailVerificationController extends Controller
{
    /** The account waiting for verification, kept in the session. */
    public const SESSION_KEY = 'verification.user_id';

    /** Shows the modal on the next page (the login page): "registered" or "login". */
    public const FLASH_KEY = 'verification.modal';

    /** Seconds between two emails to the same account. */
    public const RESEND_EVERY = 60;

    /** Remembers the unverified account and opens the modal on the login page. */
    public static function remember(Request $request, User $user, string $reason): void
    {
        $request->session()->put(self::SESSION_KEY, $user->id);
        $request->session()->flash(self::FLASH_KEY, $reason);
    }

    /** What the login page's modal shows, or null when it is closed. */
    public static function modal(Request $request): ?array
    {
        $reason = $request->session()->get(self::FLASH_KEY);
        $user = $reason ? User::find($request->session()->get(self::SESSION_KEY)) : null;

        if ($user === null || $user->hasVerifiedEmail()) {
            return null;
        }

        return [
            'reason' => $reason, // registered | login | resent
            'email' => self::mask($user->email),
            'retryAfter' => RateLimiter::availableIn(self::limiterKey($user)),
        ];
    }

    public function resend(Request $request): RedirectResponse
    {
        $user = User::find($request->session()->get(self::SESSION_KEY));

        if ($user === null) {
            return to_route('login');
        }

        if ($user->hasVerifiedEmail()) {
            $request->session()->forget(self::SESSION_KEY);

            return to_route('login')->with('status', 'Your email is already verified. You can log in now.');
        }

        $key = self::limiterKey($user);

        if (! RateLimiter::tooManyAttempts($key, 1)) {
            $user->sendEmailVerificationNotification();
            RateLimiter::hit($key, self::RESEND_EVERY);
        }

        $request->session()->flash(self::FLASH_KEY, 'resent');

        return to_route('login');
    }

    /**
     * The link in the email. Valid and not used yet: verifies the account, logs
     * it in and opens its home page (a customer's dashboard). The link works once:
     * after that, or when it has expired, it goes to the login page with a message.
     */
    public function verify(Request $request, int $id, string $hash): RedirectResponse
    {
        if (! $request->hasValidSignature()) {
            return to_route('login')->with('status', 'This verification link has expired. Log in to get a new one.');
        }

        $user = User::find($id);

        if ($user === null || ! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return to_route('login')->with('status', 'This verification link is not valid. Log in to get a new one.');
        }

        if ($user->hasVerifiedEmail()) {
            return to_route('login')->with('status', 'Your email is already verified. Log in to continue.');
        }

        $user->markEmailAsVerified();
        event(new Verified($user));

        // Someone else logged in on this browser: log them out first.
        if (Auth::check() && Auth::id() !== $user->id) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
        }

        $request->session()->forget(self::SESSION_KEY);

        if (! $user->isActive()) {
            return to_route('login')->with('status', 'Email verified. You can log in now.');
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Email verified. Welcome to GR3AT A\'s!']);

        return to_route($user->role?->homeRoute() ?? 'dashboard');
    }

    /** "an****@gmail.com": enough to recognise it, not to read it over a shoulder. */
    public static function mask(string $email): string
    {
        [$name, $domain] = array_pad(explode('@', $email, 2), 2, '');
        $shown = mb_substr($name, 0, min(2, max(1, mb_strlen($name) - 1)));

        return $shown.str_repeat('*', max(3, mb_strlen($name) - mb_strlen($shown))).'@'.$domain;
    }

    private static function limiterKey(User $user): string
    {
        return 'verification-resend:'.$user->id;
    }
}
