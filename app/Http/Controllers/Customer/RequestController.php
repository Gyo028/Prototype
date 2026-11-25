<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\PreliminaryLayoutItem;
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
 * Everything the customer submitted with a request: the event, venue and
 * budget, the preliminary layout with its initial quotation, the design
 * theme and assets, the description and the reference files. Before approval
 * the page is "Request Details"; once approved it is "Project Details" and
 * links to the project's progress page.
 */
class RequestController extends Controller
{
    private const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

    public function show(Request $request, ServiceRequest $serviceRequest): Response
    {
        self::ensureOwned($request, $serviceRequest);

        $serviceRequest->load(['eventType', 'services.service', 'files', 'project.status', 'preliminaryLayout.theme', 'preliminaryLayout.items.asset']);
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
            'layout' => $this->layoutOf($r),
            'project' => $project ? [
                'id' => $project->project_id,
                'code' => ProjectController::projectCode($project),
                'status' => ProjectController::statusOf($project),
            ] : null,
        ]);
    }

    /**
     * The preliminary layout and the asset part of the initial quotation, with
     * the prices saved when the request was sent. Null for custom projects and
     * for requests sent before layouts were saved.
     *
     * @return array<string, mixed>|null
     */
    private function layoutOf(ServiceRequest $r): ?array
    {
        $layout = $r->preliminaryLayout;

        if ($layout === null) {
            return null;
        }

        $theme = $layout->theme;
        $items = $layout->items->sortBy('layout_item_id')->map(fn (PreliminaryLayoutItem $item) => [
            'id' => $item->layout_item_id,
            'name' => $item->isCustom() ? (string) $item->custom_item_name : ($item->asset?->asset_name ?? 'Design asset'),
            'category' => $item->isCustom() ? (string) $item->custom_item_category : ($item->asset?->asset_category ?? ''),
            'description' => $item->custom_item_description,
            'isCustom' => $item->isCustom(),
            'isDefault' => $item->is_default,
            'quantity' => $item->quantity,
            // How it was counted, from the asset as it is now (the price itself is the saved one).
            'perGuest' => $item->asset?->isPerGuest() ?? false,
            'guestsPerUnit' => $item->asset?->guests_per_unit,
            'unitPrice' => $item->unit_price === null ? null : (float) $item->unit_price,
            'subtotal' => $item->subtotal === null ? null : (float) $item->subtotal,
        ])->values();

        return [
            'theme' => $theme ? [
                'name' => $theme->theme_name,
                'venue' => $theme->venue,
                'style' => $theme->style,
                'minGuests' => $theme->min_guests,
                'maxGuests' => $theme->max_guests,
            ] : null,
            'items' => $items,
            'assetsTotal' => round($items->sum(fn ($i) => $i['subtotal'] ?? 0), 2),
            'toBePriced' => $items->filter(fn ($i) => $i['unitPrice'] === null)->count(),
            'total' => (float) $layout->total_initial_cost,
        ];
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
