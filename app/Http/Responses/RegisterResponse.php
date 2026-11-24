<?php

namespace App\Http\Responses;

use App\Http\Controllers\Auth\EmailVerificationController;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Laravel\Fortify\Contracts\RegisterResponse as RegisterResponseContract;

/**
 * After registering: the verification email is already on its way (Laravel
 * sends it on the Registered event). Fortify logs the new account in; we log
 * it out again and go to the login page with the "Check your email" modal,
 * since an account can only be used once its email is verified.
 */
class RegisterResponse implements RegisterResponseContract
{
    public function toResponse($request): RedirectResponse
    {
        $user = $request->user();

        Auth::guard('web')->logout();
        $request->session()->regenerate();
        $request->session()->regenerateToken();

        if ($user !== null && ! $user->hasVerifiedEmail()) {
            EmailVerificationController::remember($request, $user, 'registered');
        }

        return to_route('login');
    }
}
