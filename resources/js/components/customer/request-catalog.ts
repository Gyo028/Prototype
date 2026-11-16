/**
 * Types and helpers for the customer's "Request New Project" screen.
 * The shapes match what ServiceRequestController@create sends.
 */

export type RequestType = 'standard' | 'custom';

/** The Event Styling fee, added to every standard request. */
export type BaseFee = { id: number; name: string; description: string; price: number };

export type CatalogService = {
    id: number;
    name: string;
    category: string;
    description: string;
    pricingType: 'fixed' | 'per_unit';
    unitType: string; // '' for a flat price, e.g. 'pax' for a per-guest price
    price: number;
};

export type CatalogEventType = { id: number; name: string };

export type CatalogTheme = {
    id: number;
    name: string;
    eventTypeId: number;
    venue: 'indoor' | 'outdoor';
    style: string;
    minGuests: number | null;
    maxGuests: number;
};

export type CatalogAsset = {
    id: number;
    name: string;
    category: string;
    placementZone: 'floor' | 'wall' | 'ceiling' | null;
};

export type RequestLimits = {
    minLeadMonths: number;
    /** A custom project must start at least this many months from today. */
    customLeadMonths: number;
    minEventHours: number;
    maxProjectDays: number;
    maxFiles: number;
    maxFileMb: number;
};

/** Everything the page receives from the controller. */
export type RequestCatalog = {
    profileMissing: boolean;
    baseFee: BaseFee | null;
    services: CatalogService[];
    eventTypes: CatalogEventType[];
    themes: CatalogTheme[];
    assets: CatalogAsset[];
    assetCategories: string[];
    budgetRanges: Record<RequestType, string[]>;
    limits: RequestLimits;
};

export const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

/** "₱50,000 – ₱100,000" → { min: 50000, max: 100000 }. "Above ₱500,000" has no maximum. */
export function parseBudgetRange(budget: string): { min: number; max: number | null } | null {
    if (!budget) return null;
    const num = (text: string) => Number(text.replace(/[^\d]/g, ''));

    if (budget.startsWith('Below')) return { min: 0, max: num(budget) };
    if (budget.startsWith('Above')) return { min: num(budget), max: null };

    const [lo, hi] = budget.split('–').map(num);
    return Number.isFinite(lo) && Number.isFinite(hi) ? { min: lo, max: hi } : null;
}

/** Same rule as the server: per-guest services count the guests, everything else counts once. */
export const isPerGuest = (service: CatalogService) => service.pricingType === 'per_unit' && service.unitType === 'pax';
export const quantityFor = (service: CatalogService, guests: number) => (isPerGuest(service) ? guests : 1);

/** A theme suits the guest count when the count is within the theme's guest range. */
export const themeFits = (theme: CatalogTheme, guests: number) =>
    guests <= theme.maxGuests && (theme.minGuests === null || guests >= theme.minGuests);

/**
 * The theme a standard request starts with: the first theme for the event type
 * that suits the guest count, otherwise the first theme for the event type.
 */
export function defaultThemeFor(themes: CatalogTheme[], eventTypeId: number, guests: number): CatalogTheme | null {
    const forType = themes.filter((t) => t.eventTypeId === eventTypeId);
    return forType.find((t) => themeFits(t, guests)) ?? forType[0] ?? null;
}

/** A local date as 'YYYY-MM-DD'. */
export const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
