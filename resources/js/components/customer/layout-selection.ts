import type { CatalogAsset, CatalogTheme } from '@/components/customer/request-catalog';

/*
 * The preliminary layout of a Standard Event Styling request: the same rules
 * as app/Services/PreliminaryLayouts.php, so the form shows the layout and
 * total the server saves.
 *
 *  - The theme's default set (one asset per slot) starts ticked.
 *  - The customer ticks and unticks library assets freely. Nothing ticked =
 *    the theme's default set again.
 *  - "Other" items: things not in the library. No price yet ("To be priced").
 *
 * Fixed assets count once. Per-guest assets count guests ÷ guests per unit,
 * rounded up (150 guests, one table per 10 → 15 tables).
 */

/** A customer's own item, described in the "Other" pop-up. */
export type CustomItem = { key: string; category: string; name: string; description: string };

export type LayoutChoice = {
    /** The ticked library assets, or null while the customer hasn't changed the theme's default set. */
    assetIds: number[] | null;
    customItems: CustomItem[];
};

export const EMPTY_LAYOUT_CHOICE: LayoutChoice = { assetIds: null, customItems: [] };

export type LayoutLine = {
    key: string;
    assetId: number | null;
    name: string;
    category: string;
    /** Part of the theme's default set. */
    isDefault: boolean;
    quantity: number;
    /** null for "Other" items: to be priced. */
    unitPrice: number | null;
    subtotal: number | null;
    perGuest: boolean;
    guestsPerUnit: number | null;
    description?: string;
};

export const assetQuantity = (asset: Pick<CatalogAsset, 'pricingType' | 'guestsPerUnit'>, guests: number) =>
    asset.pricingType === 'per_guest' ? Math.max(1, Math.ceil(Math.max(1, guests) / Math.max(1, asset.guestsPerUnit ?? 1))) : 1;

/** "₱45 per guest", "₱350 each · 1 per 10 guests", "₱8,000" */
export const assetPriceLabel = (asset: Pick<CatalogAsset, 'price' | 'pricingType' | 'guestsPerUnit'>, peso: (n: number) => string) => {
    if (asset.pricingType !== 'per_guest') return peso(asset.price);
    const per = asset.guestsPerUnit ?? 1;
    return per === 1 ? `${peso(asset.price)} per guest` : `${peso(asset.price)} each · 1 per ${per} guests`;
};

/**
 * The theme's default set: each slot's default asset, or, when that one can't
 * be offered right now, the first other asset of the slot's category not used yet.
 * `assets` must be in the server's order (by id), as sent.
 */
export function defaultAssetIds(theme: CatalogTheme | undefined | null, assets: CatalogAsset[]): number[] {
    const used = new Set<number>();

    for (const slot of theme?.slots ?? []) {
        const preferred = slot.defaultAssetId === null ? undefined : assets.find((a) => a.id === slot.defaultAssetId);
        const asset =
            preferred && preferred.category === slot.category && !used.has(preferred.id)
                ? preferred
                : assets.find((a) => a.category === slot.category && !used.has(a.id));
        if (asset) used.add(asset.id);
    }

    return [...used];
}

/** The ticked assets: the customer's, or the default set when nothing is ticked. */
export function tickedAssetIds(theme: CatalogTheme | undefined | null, assets: CatalogAsset[], choice: LayoutChoice): number[] {
    const offered = new Set(assets.map((a) => a.id));
    const picked = (choice.assetIds ?? []).filter((id) => offered.has(id));
    return picked.length > 0 ? picked : defaultAssetIds(theme, assets);
}

/** Every item on the layout, in order: the ticked assets, then "Other" items. */
export function resolveLayout(theme: CatalogTheme | undefined | null, assets: CatalogAsset[], choice: LayoutChoice, guests: number): LayoutLine[] {
    const defaults = new Set(defaultAssetIds(theme, assets));

    const lines: LayoutLine[] = tickedAssetIds(theme, assets, choice).flatMap((id) => {
        const asset = assets.find((a) => a.id === id);
        if (!asset) return [];
        const quantity = assetQuantity(asset, guests);
        return [
            {
                key: `asset-${asset.id}`,
                assetId: asset.id,
                name: asset.name,
                category: asset.category,
                isDefault: defaults.has(asset.id),
                quantity,
                unitPrice: asset.price,
                subtotal: Math.round(asset.price * quantity * 100) / 100,
                perGuest: asset.pricingType === 'per_guest',
                guestsPerUnit: asset.guestsPerUnit,
            },
        ];
    });

    for (const item of choice.customItems) {
        lines.push({
            key: item.key,
            assetId: null,
            name: item.name,
            category: item.category,
            isDefault: false,
            quantity: 1,
            unitPrice: null,
            subtotal: null,
            perGuest: false,
            guestsPerUnit: null,
            description: item.description,
        });
    }

    return lines;
}
