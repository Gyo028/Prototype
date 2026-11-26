<?php

namespace App\Services;

use App\Models\DesignTheme;
use App\Models\LayoutAsset;
use App\Models\PreliminaryLayout;
use App\Models\ServiceRequest;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * The preliminary 2D layout of a Standard Event Styling request, and the
 * asset part of its initial quotation.
 *
 * A layout is made of:
 *  - the library assets the customer ticked. The theme's default set (one
 *    asset per slot) starts ticked; the customer ticks and unticks freely.
 *    Nothing ticked = the theme's default set.
 *  - "Other" items: things not in the library, described by the customer.
 *    They have no price yet ("To be priced").
 *
 * Quantities: fixed assets count once; per-guest assets count the guests
 * divided by guests_per_unit, rounded up. Prices are copied onto the items
 * when the request is sent, so later price changes don't alter it.
 *
 * resources/js/components/customer/layout-selection.ts follows the same rules
 * so the form shows the same layout and total the server saves.
 */
class PreliminaryLayouts
{
    /**
     * Assets customers can pick (switched on and priced), in a fixed order.
     *
     * @return Collection<int, LayoutAsset>
     */
    public function offeredAssets(): Collection
    {
        return LayoutAsset::query()->offered()->orderBy('asset_id')->get();
    }

    /**
     * Works out the layout's items from the customer's choices. An asset that
     * can't be offered is reported on its own field.
     *
     * @param  array<int, mixed>  $assetIds  the ticked library assets; none = the theme's default set
     * @param  array<int, array{category: string, name: string, description?: string|null}>  $customItems
     * @return list<array<string, mixed>> preliminary_layout_items rows, without the layout id
     *
     * @throws ValidationException
     */
    public function resolve(?DesignTheme $theme, array $assetIds, array $customItems, int $guests): array
    {
        $offered = $this->offeredAssets()->keyBy('asset_id');
        $defaults = $this->defaultAssets($theme, $offered);
        $errors = [];
        $picked = [];

        foreach (array_values($assetIds) as $i => $id) {
            $asset = $offered->get((int) $id);

            if ($asset === null) {
                $errors["assetIds.{$i}"] = 'Choose only design assets from the list.';
            } else {
                $picked[$asset->asset_id] = $asset;
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        // Nothing ticked: the theme's default set.
        $chosen = $picked !== [] ? $picked : $defaults;
        $items = [];

        foreach ($chosen as $asset) {
            $items[] = $this->assetItem($asset, $guests, isset($defaults[$asset->asset_id]));
        }

        foreach ($customItems as $custom) {
            $description = trim((string) ($custom['description'] ?? ''));

            $items[] = [
                'asset_id' => null,
                'is_default' => false,
                'quantity' => 1,
                'custom_item_category' => $custom['category'],
                'custom_item_name' => trim($custom['name']),
                'custom_item_description' => $description === '' ? null : $description,
                'unit_price' => null,
                'subtotal' => null,
            ];
        }

        return $items;
    }

    /**
     * Saves the layout and its items. The total is the request's services
     * (with the Event Styling fee) plus the priced assets.
     *
     * @param  list<array<string, mixed>>  $items  from resolve()
     */
    public function save(ServiceRequest $request, ?DesignTheme $theme, array $items, float $servicesTotal): PreliminaryLayout
    {
        $assetsTotal = array_sum(array_map(fn (array $item) => (float) ($item['subtotal'] ?? 0), $items));

        $layout = $request->preliminaryLayout()->create([
            'theme_id' => $theme?->theme_id,
            'total_initial_cost' => round($servicesTotal + $assetsTotal, 2),
            'layout_status' => PreliminaryLayout::STATUS_SUBMITTED,
            'generated_at' => now(),
        ]);

        $layout->items()->createMany($items);

        return $layout;
    }

    /**
     * For sample data: the suggested theme for the request's event type with
     * its full default set, as if the customer changed nothing.
     */
    public function saveDefault(ServiceRequest $request): ?PreliminaryLayout
    {
        if ($request->isCustom() || $request->event_type_id === null || $request->preliminaryLayout()->exists()) {
            return null;
        }

        $guests = (int) $request->guest_count;
        $theme = self::suggestedTheme((int) $request->event_type_id, $guests);
        $items = $this->resolve($theme, [], [], $guests);

        return $this->save($request, $theme, $items, (float) $request->services()->sum('subtotal'));
    }

    /**
     * The theme a request starts with: the first active theme for the event
     * type that suits the guest count, otherwise the first one for the type.
     * Same rule as defaultThemeFor() in request-catalog.ts.
     */
    public static function suggestedTheme(int $eventTypeId, int $guests): ?DesignTheme
    {
        $themes = DesignTheme::query()
            ->where('status', 'active')
            ->where('event_type_id', $eventTypeId)
            ->orderBy('theme_id')
            ->get();

        return $themes->first(fn (DesignTheme $t) => $guests <= $t->max_guests && ($t->min_guests === null || $guests >= $t->min_guests))
            ?? $themes->first();
    }

    /**
     * The theme's default set, keyed by asset id: each slot's default asset,
     * or, when that one can't be offered right now, the first other asset of
     * the slot's category not used yet. Same rule as defaultAssetIds() in
     * layout-selection.ts.
     *
     * @param  Collection<int, LayoutAsset>  $offered  keyed by asset id
     * @return array<int, LayoutAsset>
     */
    public function defaultAssets(?DesignTheme $theme, Collection $offered): array
    {
        $set = [];

        foreach ($theme?->slots() ?? [] as $slot) {
            $preferred = $slot['defaultAssetId'] === null ? null : $offered->get($slot['defaultAssetId']);

            $asset = $preferred !== null && $preferred->asset_category === $slot['category'] && ! isset($set[$preferred->asset_id])
                ? $preferred
                : $offered->first(fn (LayoutAsset $a) => $a->asset_category === $slot['category'] && ! isset($set[$a->asset_id]));

            if ($asset !== null) {
                $set[$asset->asset_id] = $asset;
            }
        }

        return $set;
    }

    /** @return array<string, mixed> */
    private function assetItem(LayoutAsset $asset, int $guests, bool $isDefault): array
    {
        $quantity = $asset->quantityFor($guests);

        return [
            'asset_id' => $asset->asset_id,
            'is_default' => $isDefault,
            'quantity' => $quantity,
            'custom_item_category' => null,
            'custom_item_name' => null,
            'custom_item_description' => null,
            'unit_price' => $asset->price,
            'subtotal' => round((float) $asset->price * $quantity, 2),
        ];
    }
}
