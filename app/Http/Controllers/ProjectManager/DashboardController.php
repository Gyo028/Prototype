<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ServiceRequest;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Project Manager dashboard on real data (revision R5, Nov 22; connected Nov 28).
 * Sends the same projects and service requests as the Projects and Service Requests pages,
 * so the "Needs your attention" cards and the project overview count the real records:
 *   - pending service requests,
 *   - projects whose current step is waiting for the Project Manager,
 *   - payments waiting for verification.
 * The page itself (dashboard-overview.tsx) already works out the counts from these.
 */
class DashboardController extends Controller
{
    public function index(): Response
    {
        $projects = Project::query()
            ->with(ProjectController::RELATIONS)
            ->get()
            ->map(fn (Project $p) => ProjectController::toArray($p))
            ->values();

        $requests = ServiceRequest::query()
            ->with(ServiceRequestController::RELATIONS)
            ->orderBy('created_at')
            ->orderBy('service_request_id')
            ->get()
            ->map(fn (ServiceRequest $r) => ServiceRequestController::toArray($r))
            ->values();

        return Inertia::render('project-manager/dashboard', [
            'projects' => $projects,
            'requests' => $requests,
        ]);
    }

        /**
     * The Billing and Payments page on real data (revision R4, Nov 22; connected Nov 28).
     * Lists every project's bills and payments (read only; the actions stay in the steps).
     */
    public function billing(): Response
    {
        $projects = Project::query()
            ->with(ProjectController::RELATIONS)
            ->get()
            ->map(fn (Project $p) => ProjectController::toArray($p))
            ->values();

        return Inertia::render('project-manager/billing-payments', ['projects' => $projects]);
    }
}