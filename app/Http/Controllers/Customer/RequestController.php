<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\ServiceRequest;
use App\Models\ServiceRequestFile;
use App\Models\ServiceRequestService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Customer > My Projects > Request Details / Project Details.
 *
 * Everything the customer submitted with a request. Before approval the page
 * is "Request Details"; once approved it is "Project Details" and links to
 * the project's progress page.
 */
class RequestController extends Controller
{
    private const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

    public function show(Request $request, ServiceRequest $serviceRequest): Response
    {
        self::ensureOwned($request, $serviceRequest);

        $serviceRequest->load(['eventType', 'services.service', 'files', 'project.status']);
        $r = $serviceRequest;
        $project = $r->project;

        $services = $r->services->map(fn (ServiceRequestService $line) => [
            'name' => $line->service?->service_name ?? 'Service',
            'category' => $line->service?->service_category,
            'quantity' => (int) $line->quantity,
            'unit' => $line->service?->pricing_type === 'per_unit' ? $line->service?->unit_type : null,
            'unitPrice' => (float) $line->unit_price,
            'subtotal' => (float) $line->subtotal,
        ])->values();

        return Inertia::render('customer/request-show', [
            'request' => [
                'id' => $r->service_request_id,
                'code' => ProjectController::requestCode($r),
                'title' => ProjectController::titleOf($r),
                'requestType' => $r->request_type,
                'requestDate' => $r->request_date->toDateString(),
                'requestStatus' => $r->request_status,
                'pmRemarks' => $r->request_status === ServiceRequest::STATUS_REJECTED ? $r->pm_remarks : null,
                'eventType' => $r->eventType?->event_type_name,
                'projectTitle' => $r->project_title,
                'startDate' => $r->start_date->toDateString(),
                'endDate' => $r->end_date->toDateString(),
                'startTime' => $r->event_start_time ? substr($r->event_start_time, 0, 5) : null,
                'endTime' => $r->event_end_time ? substr($r->event_end_time, 0, 5) : null,
                'venue' => $r->venue,
                'guests' => $r->guest_count,
                'budgetMin' => (float) $r->budget_min,
                'budgetMax' => $r->budget_max === null ? null : (float) $r->budget_max,
                'reservationFee' => $r->reservationFee(),
                'description' => $r->project_description,
                'services' => $services,
                'servicesTotal' => round($services->sum('subtotal'), 2),
                'files' => $r->files->map(fn (ServiceRequestFile $f) => [
                    'id' => $f->request_file_id,
                    'name' => $f->file_name,
                    'isImage' => in_array(strtolower(pathinfo($f->file_name, PATHINFO_EXTENSION)), self::IMAGE_EXTENSIONS, true),
                    'url' => "/customer/requests/{$r->service_request_id}/files/{$f->request_file_id}",
                ])->values(),
            ],
            'project' => $project ? [
                'id' => $project->project_id,
                'code' => ProjectController::projectCode($project),
                'status' => ProjectController::statusOf($project),
            ] : null,
        ]);
    }

    /** Shows a reference file in the browser, or downloads it with ?download=1. */
    public function file(Request $request, ServiceRequest $serviceRequest, ServiceRequestFile $file): StreamedResponse
    {
        self::ensureOwned($request, $serviceRequest);

        abort_unless((int) $file->service_request_id === (int) $serviceRequest->service_request_id, 404);
        abort_unless(Storage::exists($file->file_path), 404);

        return $request->boolean('download')
            ? Storage::download($file->file_path, $file->file_name)
            : Storage::response($file->file_path, $file->file_name);
    }

    /** Requests belong to the customer who sent them; anyone else gets a 404. */
    public static function ensureOwned(Request $request, ServiceRequest $serviceRequest): void
    {
        $ownerUserId = Customer::query()->whereKey($serviceRequest->customer_id)->value('user_id');

        abort_unless($ownerUserId !== null && (int) $ownerUserId === (int) $request->user()->id, 404);
    }
}
