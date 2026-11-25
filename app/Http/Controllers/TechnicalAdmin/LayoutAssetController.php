<?php

namespace App\Http\Controllers\TechnicalAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\TechnicalAdmin\LayoutAssetRequest;
use App\Models\LayoutAsset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Technical Admin > Services & Assets > Assets > Design Assets.
 *
 * Each asset has one price: fixed (counted once on a layout) or per guest
 * (counted from the guest count, e.g. one table per 10 guests). Nothing is
 * deleted: assets are switched off instead, because layouts refer to them.
 * A new price applies to requests sent after it; saved ones keep theirs.
 */
class LayoutAssetController extends Controller
{
    public function store(LayoutAssetRequest $request): RedirectResponse
    {
        LayoutAsset::create($this->attributes($request));

        return to_route('technical-admin.services-assets');
    }

    public function update(LayoutAssetRequest $request, LayoutAsset $asset): RedirectResponse
    {
        $asset->update($this->attributes($request));

        return to_route('technical-admin.services-assets');
    }

    /** The Activate / Deactivate switch on an asset card. */
    public function status(Request $request, LayoutAsset $asset): RedirectResponse
    {
        $active = $request->validate(['active' => ['required', 'boolean']])['active'];

        $asset->update(['status' => $active ? 'active' : 'inactive']);

        return to_route('technical-admin.services-assets');
    }

    /** @return array<string, mixed> */
    private function attributes(LayoutAssetRequest $request): array
    {
        $perGuest = $request->validated('pricingType') === LayoutAsset::PRICING_PER_GUEST;

        return [
            'asset_name' => $request->validated('name'),
            'asset_category' => $request->validated('category'),
            'price' => $request->validated('price'),
            'pricing_type' => $request->validated('pricingType'),
            'guests_per_unit' => $perGuest ? (int) $request->validated('guestsPerUnit') : null,
            'status' => $request->boolean('active', true) ? 'active' : 'inactive',
        ];
    }
}
