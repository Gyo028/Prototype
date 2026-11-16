import { AlertTriangle, ChevronDown, Info } from 'lucide-react';
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { BaseFee, CatalogAsset, CatalogService, CatalogTheme } from '@/components/customer/request-catalog';
import { defaultThemeFor, isPerGuest, parseBudgetRange, peso, quantityFor, themeFits } from '@/components/customer/request-catalog';
import { cx } from '@/components/dashboard/ui';

/*
 * Services & Assets step of a Standard Event Styling request.
 *
 * Three panels: Selection (add-on services, design theme, design assets),
 * Design Preview, and Quotation. Everything comes from the database through
 * the page props.
 *
 * The Design Preview is text only for now: the theme's name sits in the middle
 * (it is the background), and each selected service and asset is written at
 * its own spot in the area of the room it belongs to. The drawn isometric layout replaces it once the
 * asset artwork and theme slots are ready.
 */

type ZoneId = 'stage' | 'entrance' | 'entertainment' | 'dining' | 'food' | 'photo' | 'lighting';

/** A spot on the canvas, as % of its width (x) and height (y). The label is centred on it. */
type Spot = { x: number; y: number };

// The spots of each area of the room, used in order as items are picked. The
// middle stays free for the theme name.
const ZONE_SPOTS: Record<ZoneId, Spot[]> = {
    stage: [{ x: 50, y: 9 }, { x: 34, y: 14 }, { x: 66, y: 14 }, { x: 50, y: 20 }],
    lighting: [{ x: 12, y: 6 }, { x: 88, y: 6 }, { x: 20, y: 20 }, { x: 80, y: 20 }],
    entertainment: [{ x: 12, y: 34 }, { x: 24, y: 44 }, { x: 10, y: 54 }],
    food: [{ x: 88, y: 34 }, { x: 76, y: 44 }, { x: 90, y: 54 }],
    dining: [{ x: 28, y: 66 }, { x: 48, y: 72 }, { x: 64, y: 62 }, { x: 34, y: 80 }, { x: 54, y: 82 }],
    entrance: [{ x: 50, y: 93 }, { x: 30, y: 92 }, { x: 66, y: 92 }],
    photo: [{ x: 92, y: 64 }, { x: 92, y: 79 }, { x: 92, y: 93 }],
};

/** Labels near the left or right edge grow inward, so they stay on the canvas. */
const spotStyle = ({ x, y }: Spot): CSSProperties => ({
    left: `${x}%`,
    top: `${y}%`,
    maxWidth: '30%',
    transform: `translate(${x <= 20 ? '0' : x >= 80 ? '-100%' : '-50%'}, -50%)`,
    textAlign: x <= 20 ? 'left' : x >= 80 ? 'right' : 'center',
});

// Database items have no spot of their own, so the name decides first (it says the
// most), then the category. Temporary: story 14 places assets into the theme's slots.
const ZONE_KEYWORDS: [RegExp, ZoneId][] = [
    [/photo|video/i, 'photo'],
    [/\b(entrance|arch|welcome|balloons?)\b/i, 'entrance'],
    [/\b(backdrop|stage|host|emcee)\b/i, 'stage'],
    [/\b(chairs?|tables?|centerpieces?|seats?|seating)\b/i, 'dining'],
    [/\b(cater\w*|buffet|food|desserts?|cakes?)\b/i, 'food'],
    [/light|lamps?|neon/i, 'lighting'],
    [/\b(dj|band|sound|music)\b/i, 'entertainment'],
];

const CATEGORY_ZONES: Record<string, ZoneId> = {
    Entertainment: 'entertainment',
    'Photo & Video': 'photo',
    Catering: 'food',
    Host: 'stage',
    Furniture: 'dining',
    Structures: 'stage',
    Decors: 'entrance',
    Lighting: 'lighting',
};

const zoneFor = (name: string, category: string): ZoneId =>
    ZONE_KEYWORDS.find(([pattern]) => pattern.test(name))?.[1] ?? CATEGORY_ZONES[category] ?? 'dining';

type PlacedItem = { key: string; name: string; spot: Spot };

/**
 * Gives every item its own spot in its area, in the order they were picked.
 * When an area runs out of spots, the next round sits a little lower.
 */
function placeItems(items: { key: string; name: string; category: string }[]): PlacedItem[] {
    const used: Partial<Record<ZoneId, number>> = {};

    return items.map((item) => {
        const zone = zoneFor(item.name, item.category);
        const spots = ZONE_SPOTS[zone];
        const index = used[zone] ?? 0;
        used[zone] = index + 1;

        const base = spots[index % spots.length];
        const round = Math.floor(index / spots.length);
        return { key: item.key, name: item.name, spot: { x: base.x, y: Math.min(96, base.y + round * 5) } };
    });
}

/** A colour swatch per theme style, until themes have their own pictures. */
const STYLE_SWATCHES: Record<string, string> = {
    Modern: 'linear-gradient(135deg,#e9e2d3,#cbbfa0)',
    Rustic: 'linear-gradient(135deg,#e6ecd9,#b9c99a)',
    Futuristic: 'linear-gradient(135deg,#dbe7ec,#7fa7b8)',
    Classic: 'linear-gradient(135deg,#f2ece1,#cbb98f)',
    Bohemian: 'linear-gradient(135deg,#fdf1de,#e8c48a)',
};
const DEFAULT_SWATCH = 'linear-gradient(135deg,#efefef,#cfcfcf)';

const VENUE_FILTERS = ['all', 'indoor', 'outdoor'] as const;
type VenueFilter = (typeof VENUE_FILTERS)[number];

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const gridBackground = {
    backgroundImage: 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
    backgroundSize: '24px 24px',
};

type Props = {
    baseFee: BaseFee | null;
    services: CatalogService[];
    themes: CatalogTheme[];
    assets: CatalogAsset[];
    assetCategories: string[];

    /** From Project Details. */
    eventTypeId: number | null;
    guests: number;
    budget: string;

    serviceIds: number[];
    onServiceIdsChange: (ids: number[]) => void;
    serviceError?: string;
    themeId: number | null;
    onThemeIdChange: (id: number | null) => void;
    assetIds: number[];
    onAssetIdsChange: (ids: number[]) => void;
};

function PanelHeader({ title }: { title: string }) {
    return <p className="mb-3 text-xs font-bold tracking-wide text-ink uppercase">{title}</p>;
}

function CollapsibleSection({
    title,
    required,
    meta,
    open,
    onToggle,
    children,
}: {
    title: string;
    required?: boolean;
    meta?: ReactNode;
    open: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    return (
        <div>
            <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-2 py-1 text-left">
                <span className="text-sm font-bold text-ink">
                    {title}
                    {required && <span className="text-red-600"> *</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-ink-soft">
                    {meta}
                    <ChevronDown className={cx('size-4 transition-transform', open && 'rotate-180')} />
                </span>
            </button>
            {open && <div className="mt-1">{children}</div>}
        </div>
    );
}

/**
 * The Design Preview canvas. Nothing but text: the design theme's name in the
 * middle (it is the background), and each selection's name at its own spot.
 */
function LayoutPreview({ themeName, items }: { themeName?: string; items: PlacedItem[] }) {
    return (
        <div aria-label="Layout preview" className="relative min-h-72 flex-1 overflow-hidden rounded-lg border border-black/15 bg-neutral-50" style={gridBackground}>
            {/* The design theme: the whole background */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
                <p className={themeName ? 'text-lg font-bold text-ink-soft' : 'text-sm text-ink-soft'}>{themeName ?? 'No theme selected yet'}</p>
                {items.length === 0 && <p className="text-[11px] text-ink-soft">Pick services or design assets and they appear here.</p>}
            </div>

            {/* Each selection, placed automatically at its own spot */}
            {items.map((item) => (
                <span key={item.key} className="absolute text-xs leading-tight font-bold text-ink" style={spotStyle(item.spot)}>
                    {item.name}
                </span>
            ))}
        </div>
    );
}

export default function ServicesAssetsSelector({
    baseFee,
    services,
    themes,
    assets,
    assetCategories,
    eventTypeId,
    guests,
    budget,
    serviceIds,
    onServiceIdsChange,
    serviceError,
    themeId,
    onThemeIdChange,
    assetIds,
    onAssetIdsChange,
}: Props) {
    const [servicesOpen, setServicesOpen] = useState(true);
    const [themeOpen, setThemeOpen] = useState(false);
    const [assetsOpen, setAssetsOpen] = useState(false);
    const [venueFilter, setVenueFilter] = useState<VenueFilter>('all');

    // Themes made for the chosen event type, then the venue filter.
    const themesForType = eventTypeId === null ? [] : themes.filter((t) => t.eventTypeId === eventTypeId);
    const visibleThemes = themesForType.filter((t) => venueFilter === 'all' || t.venue === venueFilter);
    const selectedTheme = themes.find((t) => t.id === themeId);
    const suggestedTheme = eventTypeId === null ? null : defaultThemeFor(themes, eventTypeId, guests);

    const selectedServices = services.filter((s) => serviceIds.includes(s.id));
    const selectedAssets = assets.filter((a) => assetIds.includes(a.id));

    // The admin's categories first, then any other category an asset uses.
    const categories = Array.from(new Set([...assetCategories, ...assets.map((a) => a.category)])).filter((cat) =>
        assets.some((a) => a.category === cat),
    );

    // The text layout: every selected service and asset at its own spot.
    const placedItems = placeItems([
        ...selectedServices.map((s) => ({ key: `service-${s.id}`, name: s.name, category: s.category })),
        ...selectedAssets.map((a) => ({ key: `asset-${a.id}`, name: a.name, category: a.category })),
    ]);

    const toggleService = (id: number) =>
        onServiceIdsChange(serviceIds.includes(id) ? serviceIds.filter((x) => x !== id) : [...serviceIds, id]);

    const toggleAsset = (id: number) => onAssetIdsChange(assetIds.includes(id) ? assetIds.filter((x) => x !== id) : [...assetIds, id]);

    // Quotation: the same arithmetic the server uses when the request is saved.
    const lineFor = (s: CatalogService) => {
        const qty = quantityFor(s, guests);
        return { qty, total: s.price * qty };
    };
    const estimatedTotal = (baseFee?.price ?? 0) + selectedServices.reduce((sum, s) => sum + lineFor(s).total, 0);

    const budgetRange = budget ? parseBudgetRange(budget) : null;
    const budgetFlag =
        budgetRange && budgetRange.max !== null && estimatedTotal > budgetRange.max
            ? { tone: 'over' as const, icon: AlertTriangle, message: `This is ${peso(estimatedTotal - budgetRange.max)} over your selected budget (${budget}).` }
            : budgetRange && estimatedTotal < budgetRange.min
              ? {
                    tone: 'under' as const,
                    icon: Info,
                    message: `This is ${peso(budgetRange.min - estimatedTotal)} under your selected budget (${budget}). You may have room to add more.`,
                }
              : null;

    return (
        <div className="rounded-2xl border border-black/15 bg-neutral-50 p-4">
            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_220px] lg:items-stretch">
                {/* ---- Selection Panel ---- */}
                <div className="flex h-full flex-col rounded-xl border border-black/15 bg-white p-3" data-error={serviceError ? '' : undefined}>
                    <PanelHeader title="Selection Panel" />

                    <CollapsibleSection
                        title="Services Needed"
                        required
                        meta={`${selectedServices.length} selected`}
                        open={servicesOpen}
                        onToggle={() => setServicesOpen((o) => !o)}
                    >
                        <p className="mb-3 text-[11px] text-ink-soft">
                            {baseFee ? `${baseFee.name} is already included with your request. ` : ''}Add anything else you need for the event.
                        </p>

                        {services.length === 0 ? (
                            <p className="text-[11px] text-ink-soft">No add-on services are available right now.</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {services.map((s) => {
                                    const on = serviceIds.includes(s.id);
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            aria-pressed={on}
                                            title={s.description || undefined}
                                            onClick={() => toggleService(s.id)}
                                            className={cx(
                                                'rounded-lg border p-2 text-left transition',
                                                on ? 'border-gold bg-gold/10' : 'border-black/15 hover:bg-black/[0.02]',
                                            )}
                                        >
                                            <span className="block text-[11px] font-bold text-ink">{s.name}</span>
                                            <span className="block text-[10px] text-ink-soft">
                                                {peso(s.price)}
                                                {s.unitType && `/${s.unitType}`}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </CollapsibleSection>
                    {serviceError && <p className="mt-2 text-xs text-red-600">{serviceError}</p>}

                    <div className="my-4 border-t border-black/10" />

                    <CollapsibleSection
                        title="Design Theme"
                        meta={selectedTheme ? selectedTheme.name : 'None yet'}
                        open={themeOpen}
                        onToggle={() => setThemeOpen((o) => !o)}
                    >
                        {themesForType.length === 0 ? (
                            <p className="text-[11px] text-ink-soft">
                                No design themes for this event type yet. You can still submit your request, and our team will suggest one.
                            </p>
                        ) : (
                            <>
                                <p className="mb-3 text-[11px] text-ink-soft">
                                    We start you with a suggested theme for your event type. Choose another if you like.
                                </p>

                                <div className="mb-1.5 flex flex-wrap gap-1.5">
                                    {VENUE_FILTERS.map((venue) => (
                                        <button
                                            key={venue}
                                            type="button"
                                            onClick={() => setVenueFilter(venue)}
                                            className={cx(
                                                'rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition',
                                                venueFilter === venue ? 'border-gold bg-gold text-white' : 'border-black/15 text-ink-soft hover:bg-black/5',
                                            )}
                                        >
                                            {capitalize(venue)}
                                        </button>
                                    ))}
                                </div>

                                {visibleThemes.length === 0 ? (
                                    <p className="text-[11px] text-ink-soft">No themes match this venue. Try another filter.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {visibleThemes.map((t) => {
                                            const on = themeId === t.id;
                                            const fits = themeFits(t, guests);
                                            return (
                                                <label
                                                    key={t.id}
                                                    className={cx(
                                                        'flex items-center gap-2.5 rounded-lg border p-2 transition',
                                                        on ? 'border-gold bg-gold/10' : 'border-black/15',
                                                        fits ? 'cursor-pointer hover:bg-black/[0.02]' : 'cursor-not-allowed opacity-60',
                                                    )}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="design-theme"
                                                        className="size-3.5 shrink-0 accent-[#c99a2a]"
                                                        checked={on}
                                                        disabled={!fits && !on}
                                                        onChange={() => onThemeIdChange(t.id)}
                                                    />
                                                    <span
                                                        className="size-8 shrink-0 rounded-md border border-black/10"
                                                        style={{ backgroundImage: STYLE_SWATCHES[t.style] ?? DEFAULT_SWATCH }}
                                                        aria-hidden="true"
                                                    />
                                                    <span className="min-w-0">
                                                        <span className="block text-[11px] font-bold text-ink">{t.name}</span>
                                                        <span className="block text-[10px] text-ink-soft">
                                                            {capitalize(t.venue)} · {t.style} · up to {t.maxGuests} guests
                                                        </span>
                                                        {suggestedTheme?.id === t.id && (
                                                            <span className="block text-[10px] font-bold text-gold-dark">Suggested</span>
                                                        )}
                                                        {!fits && (
                                                            <span className="block text-[10px] text-red-600">Not made for {guests} guests</span>
                                                        )}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}

                            </>
                        )}
                    </CollapsibleSection>

                    <div className="my-4 border-t border-black/10" />

                    <CollapsibleSection
                        title="Design Assets"
                        meta={`${selectedAssets.length} selected`}
                        open={assetsOpen}
                        onToggle={() => setAssetsOpen((o) => !o)}
                    >
                        <p className="mb-3 text-[11px] text-ink-soft">
                            Pick what you&apos;d like included. Quantities (like how many chairs) are worked out from your expected guest count
                            when your layout is prepared.
                        </p>

                        {categories.length === 0 && <p className="text-[11px] text-ink-soft">No design assets are available right now.</p>}

                        {categories.map((cat) => (
                            <div key={cat} className="mb-3 last:mb-0">
                                <p className="mb-1.5 text-[10px] font-bold tracking-wide text-ink-soft uppercase">{cat}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {assets
                                        .filter((a) => a.category === cat)
                                        .map((a) => {
                                            const on = assetIds.includes(a.id);
                                            return (
                                                <button
                                                    key={a.id}
                                                    type="button"
                                                    aria-pressed={on}
                                                    onClick={() => toggleAsset(a.id)}
                                                    className={cx(
                                                        'rounded-lg border p-2 text-left text-[11px] font-bold text-ink transition',
                                                        on ? 'border-gold bg-gold/10' : 'border-black/15 hover:bg-black/[0.02]',
                                                    )}
                                                >
                                                    {a.name}
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>
                        ))}
                    </CollapsibleSection>
                </div>

                {/* ---- Design Preview: the canvas, text only ---- */}
                <div className="flex h-full flex-col rounded-xl border border-black/15 bg-white p-3">
                    <PanelHeader title="Design Preview" />
                    <LayoutPreview themeName={selectedTheme?.name} items={placedItems} />
                </div>

                {/* ---- Quotation Panel: running total for styling and the selected services ---- */}
                <div className="flex h-full flex-col rounded-xl border border-black/15 bg-white p-4">
                    <PanelHeader title="Quotation Panel" />

                    <ul className="divide-y divide-black/10">
                        {baseFee && (
                            <li className="py-2.5 first:pt-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-bold text-ink">{baseFee.name}</p>
                                        <p className="text-[11px] text-ink-soft">Included with every request</p>
                                    </div>
                                    <p className="shrink-0 text-xs font-bold text-ink">{peso(baseFee.price)}</p>
                                </div>
                            </li>
                        )}

                        {selectedServices.map((s) => {
                            const { qty, total } = lineFor(s);
                            const perGuest = isPerGuest(s);
                            return (
                                <li key={s.id} className="py-2.5 first:pt-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-bold text-ink">{s.name}</p>
                                            <p className="text-[11px] text-ink-soft">
                                                {peso(s.price)}
                                                {s.unitType && `/${s.unitType}`}
                                                {perGuest && ` × ${qty} pax`}
                                            </p>
                                        </div>
                                        <p className="shrink-0 text-xs font-bold text-ink">{peso(total)}</p>
                                    </div>
                                    {s.pricingType === 'per_unit' && !perGuest && (
                                        <p className="mt-1 text-[10px] text-ink-soft">Counted once here. The Project Manager confirms the quantity.</p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>

                    <div className="mt-auto space-y-3 pt-4">
                        <div className="flex items-center justify-between border-t border-black/10 pt-3">
                            <p className="text-sm font-bold text-ink">Estimated Total</p>
                            <p className="text-lg font-bold text-gold-dark">{peso(estimatedTotal)}</p>
                        </div>

                        {budgetFlag && (
                            <div className={cx('flex items-start gap-2 rounded-lg p-2.5', budgetFlag.tone === 'over' ? 'bg-red-50' : 'bg-sky-50')}>
                                <budgetFlag.icon className={cx('mt-0.5 size-4 shrink-0', budgetFlag.tone === 'over' ? 'text-red-600' : 'text-sky-600')} />
                                <p className={cx('text-[11px] leading-relaxed', budgetFlag.tone === 'over' ? 'text-red-700' : 'text-sky-700')}>
                                    {budgetFlag.message}
                                </p>
                            </div>
                        )}

                        <div className="rounded-lg bg-gold/10 p-2.5">
                            <p className="text-[10px] leading-relaxed text-ink">
                                Initial estimate for styling and the services above only. Design assets, labor and other production costs are not yet
                                included and will be provided separately by the Project Manager.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
