<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

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
 *              works without logging in, then back to the login page with
 *              "Email verified. You can log in now."
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

    public function verify(Request $request, int $id, string $hash): RedirectResponse
    {
        $user = User::find($id);

        if ($user === null || ! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return to_route('login')->with('status', 'This verification link is not valid. Log in to get a new one.');
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
            event(new Verified($user));
        }

        $request->session()->forget(self::SESSION_KEY);

        return to_route('login')->with('status', 'Email verified. You can log in now.');
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
