<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectStatus;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Adviser revision G1 (Nov 27): the Project Manager's Calendar.
 * A month calendar of the event date of every project (every approved service request
 * becomes a project); cancelled projects are hidden. Clicking one opens the project page.
 *
 * Decided with the user (Nov 27): Calendar sidebar item, event dates only, cancelled hidden,
 * month view only. A custom request with a start and end date covers every day in between.
 */
class CalendarController extends Controller
{
    public function index(): Response
    {
        $events = Project::query()
            ->with(['status', 'serviceRequest.eventType'])
            ->whereHas('status', fn ($q) => $q->where('status_name', '!=', ProjectStatus::CANCELLED))
            ->get()
            ->map(function (Project $p) {
                $r = $p->serviceRequest;
                $status = $p->status->status_name;

                return [
                    'id' => $p->project_id,
                    'code' => (string) $p->project_code,
                    // The PM side's title rule: custom = the typed title, standard = the event type.
                    'title' => $r->isCustom() ? (string) $r->project_title : ($r->eventType?->event_type_name ?? 'Event'),
                    'startDate' => $r->start_date->toDateString(),
                    'endDate' => $r->end_date->toDateString(),
                    'statusName' => ProjectController::STATUS_NAMES[$status] ?? $status,
                ];
            })
            ->sortBy('startDate')
            ->values();

        return Inertia::render('project-manager/calendar', ['events' => $events]);
    }
}