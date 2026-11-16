<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ServiceRequestRequest;
use App\Models\Customer;
use App\Models\DesignTheme;
use App\Models\EventType;
use App\Models\LayoutAsset;
use App\Models\Service;
use App\Models\ServiceRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Customer > Request New Project.
 *
 * create() sends the form what the Technical Admin has switched on; store()
 * saves a submitted request. Prices are read here, on the server, and copied
 * onto the request, so a later price change never alters a saved request.
 */
class ServiceRequestController extends Controller
{
    public function create(Request $request): Response
    {
        $baseFee = Service::query()->where('service_name', Service::BASE_FEE_NAME)->first();

        return Inertia::render('customer/project-request', [
            // The customer profile is created at registration. Without it a request cannot be saved.
            'profileMissing' => $this->customerFor($request) === null,

            // The flat fee added to every standard request.
            'baseFee' => $baseFee === null ? null : [
                'id' => $baseFee->service_id,
                'name' => $baseFee->service_name,
                'description' => (string) $baseFee->description,
                'price' => (float) $baseFee->price,
            ],

            'services' => Service::query()
                ->where('status', 'active')
                ->where('service_name', '!=', Service::BASE_FEE_NAME)
                ->orderBy('service_id')
                ->get()
                ->map(fn (Service $service) => [
                    'id' => $service->service_id,
                    'name' => $service->service_name,
                    'category' => $service->service_category,
                    'description' => (string) $service->description,
                    'pricingType' => $service->pricing_type,
                    'unitType' => (string) $service->unit_type,
                    'price' => (float) $service->price,
                ]),

            'eventTypes' => EventType::query()
                ->where('status', 'active')
                ->orderBy('event_type_id')
                ->get()
                ->map(fn (EventType $type) => [
                    'id' => $type->event_type_id,
                    'name' => $type->event_type_name,
                ]),

            // A theme is offered only when it and its event type are both switched on.
            'themes' => DesignTheme::query()
                ->where('status', 'active')
                ->whereHas('eventType', fn ($query) => $query->where('status', 'active'))
                ->orderBy('theme_id')
                ->get()
                ->map(fn (DesignTheme $theme) => [
                    'id' => $theme->theme_id,
                    'name' => $theme->theme_name,
                    'eventTypeId' => $theme->event_type_id,
                    'venue' => $theme->venue,
                    'style' => $theme->style,
                    'minGuests' => $theme->min_guests,
                    'maxGuests' => $theme->max_guests,
                ]),

            // Assets are a checklist for the customer: no prices.
            'assets' => LayoutAsset::query()
                ->where('status', 'active')
                ->orderBy('asset_id')
                ->get()
                ->map(fn (LayoutAsset $asset) => [
                    'id' => $asset->asset_id,
                    'name' => $asset->asset_name,
                    'category' => $asset->asset_category,
                    'placementZone' => $asset->placement_zone,
                ]),
            'assetCategories' => LayoutAsset::CATEGORIES,

            'budgetRanges' => [
                'standard' => ServiceRequest::budgetChoices(ServiceRequest::TYPE_STANDARD),
                'custom' => ServiceRequest::budgetChoices(ServiceRequest::TYPE_CUSTOM),
            ],

            'limits' => [
                'minLeadMonths' => ServiceRequestRequest::MIN_LEAD_MONTHS,
                'customLeadMonths' => ServiceRequestRequest::MIN_CUSTOM_LEAD_MONTHS,
                'minEventHours' => ServiceRequestRequest::MIN_EVENT_HOURS,
                'maxProjectDays' => ServiceRequestRequest::MAX_PROJECT_DAYS,
                'maxFiles' => ServiceRequestRequest::MAX_FILES,
                'maxFileMb' => ServiceRequestRequest::MAX_FILE_MB,
            ],
        ]);
    }

    public function store(ServiceRequestRequest $request): RedirectResponse
    {
        $customer = $this->customerFor($request);

        if ($customer === null) {
            return back()->withErrors(['profile' => 'Complete your customer profile before submitting a request.']);
        }

        $data = $request->validated();
        $custom = $request->isCustom();
        [$budgetMin, $budgetMax] = ServiceRequest::BUDGET_RANGES[$data['budget']];

        $storedPaths = [];

        try {
            DB::transaction(function () use ($request, $data, $custom, $customer, $budgetMin, $budgetMax, &$storedPaths) {
                $serviceRequest = ServiceRequest::create([
                    'customer_id' => $customer->customer_id,
                    'request_type' => $custom ? ServiceRequest::TYPE_CUSTOM : ServiceRequest::TYPE_STANDARD,
                    'event_type_id' => $custom ? null : $data['eventTypeId'],
                    'project_title' => $custom ? $data['projectTitle'] : null,
                    'request_date' => Carbon::today()->toDateString(),
                    // Standard: one event date. Custom: the date range of the project.
                    'start_date' => $custom ? $data['startDate'] : $data['eventDate'],
                    'end_date' => $custom ? $data['endDate'] : $data['eventDate'],
                    'event_start_time' => $custom ? null : $data['eventStartTime'],
                    'event_end_time' => $custom ? null : $data['eventEndTime'],
                    'venue' => $data['venue'],
                    'guest_count' => $custom ? null : $data['guests'],
                    'budget_min' => $budgetMin,
                    'budget_max' => $budgetMax,
                    'project_description' => $data['description'] ?? null,
                ]);

                if (! $custom) {
                    $this->saveServices($serviceRequest, $data['serviceIds'], (int) $data['guests']);
                }

                foreach ($request->file('files', []) as $file) {
                    $path = $file->store("service-requests/{$serviceRequest->service_request_id}");
                    $storedPaths[] = $path;

                    $serviceRequest->files()->create([
                        'file_name' => Str::limit($file->getClientOriginalName(), 255, ''),
                        'file_path' => $path,
                    ]);
                }
            });
        } catch (Throwable $e) {
            // Do not leave uploaded files behind for a request that was not saved.
            Storage::delete($storedPaths);

            throw $e;
        }

        return to_route('customer.new-request');
    }

    /**
     * The Event Styling fee plus the chosen add-ons, each with the price it has
     * today. Per-guest services (catering) are multiplied by the guest count.
     *
     * @param  list<int>  $serviceIds
     */
    private function saveServices(ServiceRequest $serviceRequest, array $serviceIds, int $guests): void
    {
        $baseFee = Service::query()->where('service_name', Service::BASE_FEE_NAME)->firstOrFail();
        $addOns = Service::query()->whereIn('service_id', $serviceIds)->orderBy('service_id')->get();

        foreach ($addOns->prepend($baseFee) as $service) {
            $perGuest = $service->pricing_type === Service::PRICING_PER_UNIT && $service->unit_type === 'pax';
            $quantity = $perGuest ? $guests : 1;

            $serviceRequest->services()->create([
                'service_id' => $service->service_id,
                'quantity' => $quantity,
                'unit_price' => $service->price,
                'subtotal' => round((float) $service->price * $quantity, 2),
            ]);
        }
    }

    private function customerFor(Request $request): ?Customer
    {
        return Customer::query()->where('user_id', $request->user()->id)->first();
    }
}
