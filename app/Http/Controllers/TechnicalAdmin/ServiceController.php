<?php

namespace App\Http\Controllers\TechnicalAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\TechnicalAdmin\ServiceRequest;
use App\Models\Service;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Technical Admin > Services & Assets > Services.
 *
 * Services are switched on or off, never deleted, because service requests
 * and quotations refer to them. The Event Styling fee is protected: only its
 * description and price can change.
 */
class ServiceController extends Controller
{
    public function store(ServiceRequest $request): RedirectResponse
    {
        Service::create($this->attributes($request));

        return to_route('technical-admin.services-assets');
    }

    public function update(ServiceRequest $request, Service $service): RedirectResponse
    {
        if ($service->isBaseFee()) {
            // Locked fields are ignored, whatever the form sends.
            $service->update([
                'description' => $request->validated('description'),
                'price' => $request->validated('price'),
            ]);
        } else {
            $service->update($this->attributes($request));
        }

        return to_route('technical-admin.services-assets');
    }

    /** The Activate / Deactivate switch on a service card. */
    public function status(Request $request, Service $service): RedirectResponse
    {
        abort_if($service->isBaseFee(), 403, 'The Event Styling fee is always included.');

        $active = $request->validate(['active' => ['required', 'boolean']])['active'];

        $service->update(['status' => $active ? Service::STATUS_ACTIVE : Service::STATUS_INACTIVE]);

        return to_route('technical-admin.services-assets');
    }

    /** @return array<string, mixed> */
    private function attributes(ServiceRequest $request): array
    {
        $perUnit = $request->validated('pricingType') === Service::PRICING_PER_UNIT;

        return [
            'service_name' => $request->validated('name'),
            'service_category' => $request->validated('category'),
            'description' => $request->validated('description'),
            'pricing_type' => $request->validated('pricingType'),
            'unit_type' => $perUnit ? $request->validated('unitType') : null,
            'price' => $request->validated('price'),
            'status' => $request->boolean('active', true) ? Service::STATUS_ACTIVE : Service::STATUS_INACTIVE,
        ];
    }
}