<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ProfileRequest;
use App\Models\Customer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Customer > My Profile: name, contact number, company and address.
 *
 * Registration asks only for the name, email and password, so a new customer
 * lands here (from the dashboard or the service request page) to add the
 * contact number before sending their first request. The email is shown but
 * cannot be changed here.
 */
class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();
        $customer = Customer::query()->where('user_id', $user->id)->first();

        // Accounts made before the profile was created at registration have no row yet.
        [$first, $last] = $customer
            ? [$customer->first_name, $customer->last_name]
            : array_pad(explode(' ', (string) $user->name, 2), 2, '');

        return Inertia::render('customer/profile', [
            'profile' => [
                'firstName' => $first,
                'lastName' => $last,
                'email' => $user->email,
                'contactNumber' => (string) $customer?->contact_number,
                'companyName' => (string) $customer?->company_name,
                'address' => (string) $customer?->address,
            ],
            'complete' => (bool) $customer?->isComplete(),
        ]);
    }

    public function update(ProfileRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();
        $wasComplete = (bool) Customer::query()->where('user_id', $user->id)->first()?->isComplete();

        DB::transaction(function () use ($user, $data) {
            Customer::query()->updateOrCreate(['user_id' => $user->id], $data);

            // The account name (emails, staff screens) follows the profile.
            $user->forceFill(['name' => $data['first_name'].' '.$data['last_name']])->save();
        });

        if (! $wasComplete) {
            Inertia::flash('toast', ['type' => 'success', 'message' => 'Profile saved. You can now send a service request.']);

            return to_route('customer.dashboard');
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Profile updated.']);

        return to_route('customer.profile');
    }
}
