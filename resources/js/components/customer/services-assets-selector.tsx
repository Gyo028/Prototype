import { AlertTriangle, ChevronDown, Info, Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import LayoutPreview, { PreviewLegend } from '@/components/customer/layout-preview';
import type { CustomItem, LayoutChoice, LayoutLine } from '@/components/customer/layout-selection';
import { assetPriceLabel, resolveLayout, usedAssetIds } from '@/components/customer/layout-selection';
import type { BaseFee, CatalogAsset, CatalogService, CatalogTheme } from '@/components/customer/request-catalog';
import { defaultThemeFor, isPerGuest, parseBudgetRange, peso, quantityFor, themeFits } from '@/components/customer/request-catalog';
import { Field, GoldButton, OutlineButton, cx, inputClass, textareaClass } from '@/components/dashboard/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/*
 * Services & Assets step of a Standard Event Styling request.
 *
 * Three panels: Selection (add-on services, design theme, design assets),
 * Design Preview, and Quotation. Everything comes from the database through
 * the page props.
 *
 * Design assets: the theme starts the layout with its default set (one asset
 * per slot). Each slot can be swapped for another asset of the same category,
 * but not emptied. The customer can add more assets, and "Other" items that
 * aren't in the library (priced later). Nothing picked = the default set.
 * The layout rules live in layout-selection.ts, shared with the server's.
 */

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
    themeId: number | null;
    onThemeIdChange: (id: number | null) => void;
    layoutChoice: LayoutChoice;
    onLayoutChoiceChange: (choice: LayoutChoice) => void;
    /** Server messages about the layout (a swap or extra that is no longer offered). */
    layoutError?: string;
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

let customCounter = 0;

/** The "Other" pop-up: what the item is and a description. */
function OtherItemDialog({
    category,
    onClose,
    onAdd,
}: {
    category: string | null;
    onClose: () => void;
    onAdd: (item: CustomItem) => void;
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const close = () => {
        setName('');
        setDescription('');
        setErrors({});
        onClose();
    };

    const add = () => {
        const e: Record<string, string> = {};
        if (!name.trim()) e.name = 'Tell us what the item is.';
        if (!description.trim()) e.description = 'Describe the item, e.g. size, color or material.';
        setErrors(e);
        if (Object.keys(e).length || !category) return;

        onAdd({ key: `custom-${Date.now()}-${++customCounter}`, category, name: name.trim(), description: description.trim() });
        close();
    };

    return (
        <Dialog open={category !== null} onOpenChange={(open) => !open && close()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Other {category?.toLowerCase()} item</DialogTitle>
                    <DialogDescription>
                        Can&apos;t find it in the list? Describe it here. It is placed on your layout and priced later by our Project Manager.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <Field label="What is it?" htmlFor="other-name" required error={errors.name}>
                        <input
                            id="other-name"
                            className={inputClass}
                            maxLength={50}
                            placeholder="e.g. Neon name sign"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </Field>
                    <Field label="Description" htmlFor="other-description" required error={errors.description}>
                        <textarea
                            id="other-description"
                            className={textareaClass}
                            maxLength={200}
                            rows={3}
                            placeholder="Size, color, material or a reference"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        <span className="text-right text-[11px] text-ink-soft">{description.length}/200</span>
                    </Field>
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                    <OutlineButton className="px-5 py-2" onClick={close}>
                        Cancel
                    </OutlineButton>
                    <GoldButton className="px-6 py-2" onClick={add}>
                        Add to layout
                    </GoldButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** "₱45 per guest × 150" / "₱8,000" / "To be priced" */
function lineDetail(line: LayoutLine) {
    if (line.unitPrice === null) return 'To be priced';
    const unit = assetPriceLabel({ price: line.unitPrice, pricingType: line.perGuest ? 'per_guest' : 'fixed', guestsPerUnit: line.guestsPerUnit }, peso);
    return line.perGuest ? `${unit} × ${line.quantity}` : unit;
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
    themeId,
    onThemeIdChange,
    layoutChoice,
    onLayoutChoiceChange,
    layoutError,
}: Props) {
    const [servicesOpen, setServicesOpen] = useState(true);
    const [themeOpen, setThemeOpen] = useState(false);
    const [assetsOpen, setAssetsOpen] = useState(true);
    const [venueFilter, setVenueFilter] = useState<VenueFilter>('all');
    const [otherCategory, setOtherCategory] = useState<string | null>(null);

    // Themes made for the chosen event type, then the venue filter.
    const themesForType = eventTypeId === null ? [] : themes.filter((t) => t.eventTypeId === eventTypeId);
    const visibleThemes = themesForType.filter((t) => venueFilter === 'all' || t.venue === venueFilter);
    const selectedTheme = themes.find((t) => t.id === themeId);
    const suggestedTheme = eventTypeId === null ? null : defaultThemeFor(themes, eventTypeId, guests);

    const selectedServices = services.filter((s) => serviceIds.includes(s.id));

    // The layout: the theme's slots (default or swapped), extras, then "Other" items.
    const lines = resolveLayout(selectedTheme, assets, layoutChoice, guests);
    const slotLines = lines.filter((l) => l.slot !== null);
    const used = usedAssetIds(lines);
    const slotAssetIds = new Set(slotLines.map((l) => l.assetId));

    // The admin's categories first, then any other category an asset uses.
    const categories = Array.from(new Set([...assetCategories, ...assets.map((a) => a.category)]));

    const previewItems = [
        ...selectedServices.map((s) => ({ key: `service-${s.id}`, name: s.name, category: s.category, kind: 'service' as const })),
        ...lines.map((l) => ({ key: l.key, name: l.name, category: l.category, kind: 'asset' as const })),
    ];

    const toggleService = (id: number) =>
        onServiceIdsChange(serviceIds.includes(id) ? serviceIds.filter((x) => x !== id) : [...serviceIds, id]);

    const swapSlot = (slotKey: string, assetId: number) =>
        onLayoutChoiceChange({ ...layoutChoice, slotPicks: { ...layoutChoice.slotPicks, [slotKey]: assetId } });

    const toggleExtra = (id: number) =>
        onLayoutChoiceChange({
            ...layoutChoice,
            extraAssetIds: layoutChoice.extraAssetIds.includes(id) ? layoutChoice.extraAssetIds.filter((x) => x !== id) : [...layoutChoice.extraAssetIds, id],
        });

    const addCustom = (item: CustomItem) => onLayoutChoiceChange({ ...layoutChoice, customItems: [...layoutChoice.customItems, item] });
    const removeCustom = (key: string) =>
        onLayoutChoiceChange({ ...layoutChoice, customItems: layoutChoice.customItems.filter((c) => c.key !== key) });

    // Quotation: the same arithmetic the server uses when the request is saved.
    const lineFor = (s: CatalogService) => {
        const qty = quantityFor(s, guests);
        return { qty, total: s.price * qty };
    };
    const assetsTotal = lines.reduce((sum, l) => sum + (l.subtotal ?? 0), 0);
    const toBePriced = lines.filter((l) => l.unitPrice === null).length;
    const estimatedTotal = (baseFee?.price ?? 0) + selectedServices.reduce((sum, s) => sum + lineFor(s).total, 0) + assetsTotal;

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
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_240px] lg:items-stretch">
                {/* ---- Selection Panel ---- */}
                <div className="flex h-full flex-col rounded-xl border border-black/15 bg-white p-3">
                    <PanelHeader title="Selection Panel" />

                    <CollapsibleSection
                        title="Services Needed"
                        meta={`${selectedServices.length} selected`}
                        open={servicesOpen}
                        onToggle={() => setServicesOpen((o) => !o)}
                    >
                        <p className="mb-3 text-[11px] text-ink-soft">
                            {baseFee ? `${baseFee.name} is already included with your request. ` : ''}Add anything else you need for the event
                            (optional).
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
                                    We start you with a suggested theme for your event type. Choosing another theme starts its own default set.
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
                        meta={`${lines.length} on layout`}
                        open={assetsOpen}
                        onToggle={() => setAssetsOpen((o) => !o)}
                    >
                        {/* The theme's default set: swap only */}
                        {slotLines.length > 0 ? (
                            <div className="mb-4">
                                <p className="mb-1 text-[10px] font-bold tracking-wide text-ink-soft uppercase">Included with {selectedTheme?.name}</p>
                                <p className="mb-2 text-[11px] text-ink-soft">Swap any item for another of the same kind.</p>
                                <div className="space-y-2">
                                    {slotLines.map((line) => {
                                        const slot = line.slot!;
                                        const options = assets.filter(
                                            (a) => a.category === slot.category && (a.id === line.assetId || !used.has(a.id)),
                                        );
                                        return (
                                            <div key={line.key} className="rounded-lg border border-black/15 p-2">
                                                <div className="mb-1 flex items-center justify-between gap-2">
                                                    <label htmlFor={`slot-${slot.key}`} className="text-[11px] font-bold text-ink">
                                                        {slot.label}
                                                    </label>
                                                    {line.isDefault && (
                                                        <span className="rounded-full bg-gold/15 px-2 text-[10px] font-bold text-gold-dark">Default</span>
                                                    )}
                                                </div>
                                                <select
                                                    id={`slot-${slot.key}`}
                                                    className="w-full rounded-md border border-black/15 bg-white px-2 py-1 text-[11px] text-ink"
                                                    value={line.assetId ?? ''}
                                                    onChange={(e) => swapSlot(slot.key, Number(e.target.value))}
                                                >
                                                    {options.map((a) => (
                                                        <option key={a.id} value={a.id}>
                                                            {a.name}
                                                            {a.id === slot.defaultAssetId ? ' (default)' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="mt-1 text-[10px] text-ink-soft">{lineDetail(line)}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <p className="mb-3 text-[11px] text-ink-soft">
                                {selectedTheme
                                    ? `${selectedTheme.name} has no default set yet. Add the assets you'd like below.`
                                    : 'Choose a design theme to start with its default set, or add assets below.'}
                            </p>
                        )}

                        {/* Extras and "Other" items, by category */}
                        <p className="mb-2 text-[10px] font-bold tracking-wide text-ink-soft uppercase">Add more</p>
                        {categories.map((cat) => {
                            const extras = assets.filter((a) => a.category === cat && !slotAssetIds.has(a.id));
                            const customs = layoutChoice.customItems.filter((c) => c.category === cat);
                            return (
                                <div key={cat} className="mb-3 last:mb-0">
                                    <p className="mb-1.5 text-[10px] font-bold text-ink-soft">{cat}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {extras.map((a) => {
                                            const on = layoutChoice.extraAssetIds.includes(a.id);
                                            return (
                                                <button
                                                    key={a.id}
                                                    type="button"
                                                    aria-pressed={on}
                                                    onClick={() => toggleExtra(a.id)}
                                                    className={cx(
                                                        'rounded-lg border p-2 text-left transition',
                                                        on ? 'border-gold bg-gold/10' : 'border-black/15 hover:bg-black/[0.02]',
                                                    )}
                                                >
                                                    <span className="block text-[11px] font-bold text-ink">{a.name}</span>
                                                    <span className="block text-[10px] text-ink-soft">{assetPriceLabel(a, peso)}</span>
                                                </button>
                                            );
                                        })}
                                        <button
                                            type="button"
                                            onClick={() => setOtherCategory(cat)}
                                            className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-black/25 p-2 text-[11px] font-bold text-ink-soft hover:border-gold hover:text-gold-dark"
                                        >
                                            <Plus className="size-3.5" /> Other
                                        </button>
                                    </div>
                                    {customs.length > 0 && (
                                        <ul className="mt-2 space-y-1.5">
                                            {customs.map((c) => (
                                                <li key={c.key} className="flex items-start justify-between gap-2 rounded-lg border border-gold/40 bg-gold/5 p-2">
                                                    <span className="min-w-0">
                                                        <span className="block text-[11px] font-bold break-words text-ink">{c.name}</span>
                                                        <span className="block text-[10px] break-words text-ink-soft">{c.description}</span>
                                                        <span className="block text-[10px] font-bold text-gold-dark">To be priced</span>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        aria-label={`Remove ${c.name}`}
                                                        onClick={() => removeCustom(c.key)}
                                                        className="shrink-0 text-ink-soft hover:text-red-600"
                                                    >
                                                        <X className="size-3.5" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            );
                        })}
                    </CollapsibleSection>
                    {layoutError && <p className="mt-2 text-xs text-red-600" data-error="">{layoutError}</p>}
                </div>

                {/* ---- Design Preview: the canvas, text only ---- */}
                <div className="flex h-full flex-col rounded-xl border border-black/15 bg-white p-3">
                    <PanelHeader title="Design Preview" />
                    <LayoutPreview themeName={selectedTheme?.name} items={previewItems} />
                    <PreviewLegend />
                </div>

                {/* ---- Quotation Panel: running total ---- */}
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

                        {lines.map((l) => (
                            <li key={l.key} className="py-2.5 first:pt-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-bold text-gold-dark">{l.name}</p>
                                        <p className="text-[11px] text-ink-soft">{lineDetail(l)}</p>
                                    </div>
                                    <p className="shrink-0 text-xs font-bold text-ink">{l.subtotal === null ? '—' : peso(l.subtotal)}</p>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-auto space-y-3 pt-4">
                        <div className="flex items-center justify-between border-t border-black/10 pt-3">
                            <p className="text-sm font-bold text-ink">Estimated Total</p>
                            <p className="text-lg font-bold text-gold-dark">{peso(estimatedTotal)}</p>
                        </div>
                        {toBePriced > 0 && (
                            <p className="text-[10px] text-ink-soft">
                                Plus {toBePriced} {toBePriced === 1 ? 'item' : 'items'} to be priced.
                            </p>
                        )}

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
                                This layout and quotation are initial estimates only. Our Design Specialist prepares the final design, and your final
                                quotation comes with the design proposal.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <OtherItemDialog category={otherCategory} onClose={() => setOtherCategory(null)} onAdd={addCustom} />
        </div>
    );
}
