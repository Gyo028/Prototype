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
 */
class DashboardController extends Controller
{
    public function __construct(private CustomerDashboard $dashboard) {}

    public function index(Request $request): Response
    {
        $customer = Customer::query()->where('user_id', $request->user()->id)->first();

        return Inertia::render('customer/dashboard', [
            // No contact number yet: the dashboard points to My Profile before the first request.
            'profileMissing' => ! $customer?->isComplete(),
            ...$this->dashboard->for($customer),
        ]);
    }
}
