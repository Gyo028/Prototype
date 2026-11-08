<?php

namespace App\Http\Controllers\TechnicalAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\TechnicalAdmin\LayoutAssetRequest;
use App\Models\AssetVariant;
use App\Models\LayoutAsset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Technical Admin > Services & Assets > Assets > Design Assets.
 *
 * One Save stores the asset and its variants together. Variants that already
 * exist are updated (by id), new ones are created. Nothing is deleted:
 * assets and variants are switched off instead, because layouts refer to them.
 */
class LayoutAssetController extends Controller
{
    public function store(LayoutAssetRequest $request): RedirectResponse
    {
        DB::transaction(function () use ($request) {
            $asset = LayoutAsset::create($this->attributes($request));
            $this->saveVariants($asset, $request->validated('variants', []));
        });

        return to_route('technical-admin.services-assets');
    }

    public function update(LayoutAssetRequest $request, LayoutAsset $asset): RedirectResponse
    {
        DB::transaction(function () use ($request, $asset) {
            $asset->update($this->attributes($request));
            $this->saveVariants($asset, $request->validated('variants', []));
        });

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
        return [
            'asset_name' => $request->validated('name'),
            'asset_category' => $request->validated('category'),
            'status' => $request->boolean('active', true) ? 'active' : 'inactive',
        ];
    }

    /** @param array<int, array<string, mixed>> $variants */
    private function saveVariants(LayoutAsset $asset, array $variants): void
    {
        foreach ($variants as $variant) {
            $attributes = [
                'variant_name' => $variant['name'],
                'description' => $variant['description'] ?? null,
                'price' => $variant['price'],
                'status' => ($variant['active'] ?? true) ? 'active' : 'inactive',
            ];

            if (! empty($variant['id'])) {
                AssetVariant::where('asset_variant_id', $variant['id'])
                    ->where('asset_id', $asset->asset_id)
                    ->firstOrFail()
                    ->update($attributes);
            } else {
                $asset->variants()->create($attributes);
            }
        }
    }
}