import type { CatalogAsset, CatalogTheme, ThemeSlot } from '@/components/customer/request-catalog';

/*
 * The preliminary layout of a Standard Event Styling request: the same rules
 * as app/Services/PreliminaryLayouts.php, so the form shows the layout and
 * total the server saves.
 *
 *  - The theme's default set: one asset per slot. The customer can swap a
 *    slot's asset for another of the same category, but not empty the slot.
 *  - Extras: more library assets.
 *  - "Other" items: things not in the library. No price yet ("To be priced").
 *
 * Fixed assets count once. Per-guest assets count guests ÷ guests per unit,
 * rounded up (150 guests, one table per 10 → 15 tables).
 */

/** A customer's own item, described in the "Other" pop-up. */
export type CustomItem = { key: string; category: string; name: string; description: string };

export type LayoutChoice = {
    /** Slot key → the asset the customer swapped in. A slot not listed keeps its default. */
    slotPicks: Record<string, number>;
    extraAssetIds: number[];
    customItems: CustomItem[];
};

export const EMPTY_LAYOUT_CHOICE: LayoutChoice = { slotPicks: {}, extraAssetIds: [], customItems: [] };

export type LayoutLine = {
    key: string;
    assetId: number | null;
    name: string;
    category: string;
    /** The slot this asset fills, if any. */
    slot: ThemeSlot | null;
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

/** The slot's default asset, or, if it can't be offered, the first other asset of its category not used yet. */
function slotDefault(slot: ThemeSlot, assets: CatalogAsset[], used: Set<number>): CatalogAsset | null {
    const fallback = assets.find((a) => a.category === slot.category && !used.has(a.id)) ?? null;
    const asset = slot.defaultAssetId === null ? null : (assets.find((a) => a.id === slot.defaultAssetId) ?? null);
    return asset && asset.category === slot.category && !used.has(asset.id) ? asset : fallback;
}

function assetLine(asset: CatalogAsset, guests: number, slot: ThemeSlot | null): LayoutLine {
    const quantity = assetQuantity(asset, guests);
    return {
        key: slot ? `slot-${slot.key}` : `asset-${asset.id}`,
        assetId: asset.id,
        name: asset.name,
        category: asset.category,
        slot,
        isDefault: slot !== null && asset.id === slot.defaultAssetId,
        quantity,
        unitPrice: asset.price,
        subtotal: Math.round(asset.price * quantity * 100) / 100,
        perGuest: asset.pricingType === 'per_guest',
        guestsPerUnit: asset.guestsPerUnit,
    };
}

/**
 * Every item on the layout, in order: the theme's slots, then extras, then
 * "Other" items. `assets` must be in the server's order (by id), as sent.
 */
export function resolveLayout(theme: CatalogTheme | undefined | null, assets: CatalogAsset[], choice: LayoutChoice, guests: number): LayoutLine[] {
    const lines: LayoutLine[] = [];
    const used = new Set<number>();

    for (const slot of theme?.slots ?? []) {
        const pickedId = choice.slotPicks[slot.key];
        const picked = pickedId === undefined ? null : assets.find((a) => a.id === pickedId && a.category === slot.category && !used.has(a.id));
        const asset = picked ?? slotDefault(slot, assets, used);
        if (!asset) continue;
        used.add(asset.id);
        lines.push(assetLine(asset, guests, slot));
    }

    for (const id of choice.extraAssetIds) {
        const asset = assets.find((a) => a.id === id);
        if (!asset || used.has(id)) continue;
        used.add(id);
        lines.push(assetLine(asset, guests, null));
    }

    for (const item of choice.customItems) {
        lines.push({
            key: item.key,
            assetId: null,
            name: item.name,
            category: item.category,
            slot: null,
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

/** Asset ids already on the layout (slots and extras). */
export const usedAssetIds = (lines: LayoutLine[]) => new Set(lines.flatMap((l) => (l.assetId === null ? [] : [l.assetId])));
