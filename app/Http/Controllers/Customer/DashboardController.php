<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Services\CustomerDashboard;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Customer > Dashboard: the next event, what needs the customer, what's coming
 * up and what happened lately, across all of their projects (CustomerDashboard).
 *
 * The welcome line comes with the page. The countdown, Action needed and Upcoming
 * read every project's steps, so they are deferred: the browser fetches them in a
 * second request right after the page appears, with skeletons until then.
 */
class DashboardController extends Controller
{
    public function __construct(private CustomerDashboard $dashboard) {}

    public function index(Request $request): Response
    {
        $customer = Customer::query()->where('user_id', $request->user()->id)->first();
        $hasRequests = $customer !== null && $customer->serviceRequests()->exists();

        // Worked out once, on the second request, for all four panels.
        $data = null;
        $dataOf = function () use (&$data, $customer) {
            return $data ??= $this->dashboard->for($customer);
        };

        // A customer with no requests yet gets the getting-started page: nothing to defer.
        $panel = fn (string $key, mixed $empty) => $hasRequests
            ? Inertia::defer(fn () => $dataOf()[$key], 'dashboard')
            : $empty;

        return Inertia::render('customer/dashboard', [
            // No contact number yet: the dashboard points to My Profile before the first request.
            'profileMissing' => ! $customer?->isComplete(),
            'firstName' => $customer?->first_name,
            'hasRequests' => $hasRequests,
            'countdown' => $panel('countdown', null),
            'actions' => $panel('actions', []),
            'pending' => $panel('pending', []),
            'upcoming' => $panel('upcoming', []),
        ]);
    }
}
