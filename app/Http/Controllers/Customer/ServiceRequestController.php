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
use App\Services\PreliminaryLayouts;
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
 * Both need a complete profile (a contact number on My Profile); without one
 * the customer is sent there first.
 *
 * create() sends the form what the Technical Admin has switched on; store()
 * saves a submitted request with its preliminary layout. Prices are read here,
 * on the server, and copied onto the request, so a later price change never
 * alters a saved request.
 */
class ServiceRequestController extends Controller
{
    public function create(Request $request, PreliminaryLayouts $layouts): Response|RedirectResponse
    {
        if (! $this->customerFor($request)?->isComplete()) {
            return $this->toProfile();
        }

        $baseFee = Service::query()->where('service_name', Service::BASE_FEE_NAME)->first();

        return Inertia::render('customer/project-request', [
            // Always false here: create() sends an incomplete profile to My Profile first.
            'profileMissing' => false,

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
                    'slots' => $theme->slots(),
                ]),

            // Switched on and priced only, in the order PreliminaryLayouts uses.
            'assets' => $layouts->offeredAssets()
                ->map(fn (LayoutAsset $asset) => [
                    'id' => $asset->asset_id,
                    'name' => $asset->asset_name,
                    'category' => $asset->asset_category,
                    'placementZone' => $asset->placement_zone,
                    'price' => (float) $asset->price,
                    'pricingType' => $asset->pricing_type,
                    'guestsPerUnit' => $asset->guests_per_unit,
                ])
                ->values(),
            'assetCategories' => LayoutAsset::CATEGORIES,

            'budgetRanges' => [
                'standard' => ServiceRequest::budgetChoices(ServiceRequest::TYPE_STANDARD),
                'custom' => ServiceRequest::budgetChoices(ServiceRequest::TYPE_CUSTOM),
            ],

            'limits' => [
                'minLeadMonths' => ServiceRequestRequest::MIN_LEAD_MONTHS,
                'customLeadMonths' => ServiceRequestRequest::MIN_CUSTOM_LEAD_MONTHS,
                'minEventHours' => ServiceRequestRequest::MIN_EVENT_HOURS,
                'minExactBudget' => ServiceRequest::MIN_EXACT_BUDGET,
                'maxProjectDays' => ServiceRequestRequest::MAX_PROJECT_DAYS,
                'maxFiles' => ServiceRequestRequest::MAX_FILES,
                'maxFileMb' => ServiceRequestRequest::MAX_FILE_MB,
            ],
        ]);
    }

    public function store(ServiceRequestRequest $request, PreliminaryLayouts $layouts): RedirectResponse
    {
        $customer = $this->customerFor($request);

        if (! $customer?->isComplete()) {
            return $this->toProfile();
        }

        $data = $request->validated();
        $custom = $request->isCustom();
        // An exact budget is saved as one amount in both columns.
        [$budgetMin, $budgetMax] = $data['budget'] === ServiceRequest::BUDGET_EXACT
            ? [(float) $data['budgetExact'], (float) $data['budgetExact']]
            : ServiceRequest::BUDGET_RANGES[$data['budget']];

        $storedPaths = [];

        try {
            DB::transaction(function () use ($request, $layouts, $data, $custom, $customer, $budgetMin, $budgetMax, &$storedPaths) {
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
                    $guests = (int) $data['guests'];
                    $servicesTotal = $this->saveServices($serviceRequest, $data['serviceIds'] ?? [], $guests);

                    // The preliminary layout: the ticked assets (none = the theme's default set) and "Other" items.
                    $theme = empty($data['themeId']) ? null : DesignTheme::find($data['themeId']);
                    $items = $layouts->resolve($theme, $data['assetIds'] ?? [], $data['customItems'] ?? [], $guests);
                    $layouts->save($serviceRequest, $theme, $items, $servicesTotal);
                }

                foreach ($request->file('files', []) as $file) {
                    // Like every customer file: customers/{customer}/requests/{request}/…
                    $path = $file->store("customers/{$customer->customer_id}/requests/{$serviceRequest->service_request_id}");
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
     * Returns their total.
     *
     * @param  list<int>  $serviceIds
     */
    private function saveServices(ServiceRequest $serviceRequest, array $serviceIds, int $guests): float
    {
        $total = 0.0;

        $baseFee = Service::query()->where('service_name', Service::BASE_FEE_NAME)->firstOrFail();
        $addOns = Service::query()->whereIn('service_id', $serviceIds)->orderBy('service_id')->get();

        foreach ($addOns->prepend($baseFee) as $service) {
            $perGuest = $service->pricing_type === Service::PRICING_PER_UNIT && $service->unit_type === 'pax';
            $quantity = $perGuest ? $guests : 1;

            $subtotal = round((float) $service->price * $quantity, 2);
            $total += $subtotal;

            $serviceRequest->services()->create([
                'service_id' => $service->service_id,
                'quantity' => $quantity,
                'unit_price' => $service->price,
                'subtotal' => $subtotal,
            ]);
        }

        return $total;
    }

    /** A request needs the customer's contact number: My Profile first. */
    private function toProfile(): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'info', 'message' => 'Add your contact number first, so we can reach you about your request.']);

        return to_route('customer.profile');
    }

    private function customerFor(Request $request): ?Customer
    {
        return Customer::query()->where('user_id', $request->user()->id)->first();
    }
}
