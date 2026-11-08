<?php

namespace App\Http\Controllers\TechnicalAdmin;

use App\Http\Controllers\Controller;
use App\Models\AssetVariant;
use App\Models\DesignTheme;
use App\Models\EventType;
use App\Models\LayoutAsset;
use App\Models\Service;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Technical Admin > Services & Assets,
 * Services, and Assets (design themes and
 * layout assets with their priced variants).
 */
class ServicesAssetsController extends Controller
{
    public function index(): Response
    {
        $services = Service::query()
            ->orderByRaw('CASE WHEN service_name = ? THEN 0 ELSE 1 END', [Service::BASE_FEE_NAME])
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
                'active' => $service->isActive(),
                'isBaseFee' => $service->isBaseFee(),
            ]);

        $themes = DesignTheme::query()
            ->orderBy('theme_id')
            ->get()
            ->map(fn (DesignTheme $theme) => [
                'id' => $theme->theme_id,
                'name' => $theme->theme_name,
                'eventTypeId' => $theme->event_type_id,
                'venue' => $theme->venue,
                'style' => $theme->style,
                'maxGuests' => $theme->max_guests,
                'active' => $theme->status === 'active',
            ]);

        $assets = LayoutAsset::query()
            ->with(['variants' => fn ($q) => $q->orderBy('asset_variant_id')])
            ->orderBy('asset_id')
            ->get()
            ->map(fn (LayoutAsset $asset) => [
                'id' => $asset->asset_id,
                'name' => $asset->asset_name,
                'category' => $asset->asset_category,
                'active' => $asset->status === 'active',
                'variants' => $asset->variants->map(fn (AssetVariant $variant) => [
                    'id' => $variant->asset_variant_id,
                    'name' => $variant->variant_name,
                    'description' => (string) $variant->description,
                    'price' => (float) $variant->price,
                    'active' => $variant->status === 'active',
                ])->values(),
            ]);

        return Inertia::render('technical-admin/services-assets', [
            'services' => $services,
            'categories' => Service::CATEGORIES,
            'unitTypes' => Service::UNIT_TYPES,
            'themes' => $themes,
            'eventTypes' => EventType::query()
                ->orderBy('event_type_id')
                ->get()
                ->map(fn (EventType $type) => [
                    'id' => $type->event_type_id,
                    'name' => $type->event_type_name,
                    'active' => $type->status === 'active',
                ]),
            'styles' => DesignTheme::STYLES,
            'assets' => $assets,
            'assetCategories' => LayoutAsset::CATEGORIES,
        ]);
    }
}