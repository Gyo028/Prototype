import { AlertTriangle, ChevronDown, Info, ListChecks, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import LayoutPreview, { syncLayoutView } from '@/components/customer/layout-preview';
import type { CustomItem, LayoutChoice, LayoutLine } from '@/components/customer/layout-selection';
import { assetPriceLabel, resolveLayout, tickedAssetIds } from '@/components/customer/layout-selection';
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
 * Design assets: plain cards like the services. The theme's default set
 * starts ticked; the customer ticks and unticks freely, and can add "Other"
 * items that aren't in the library (priced later). Nothing ticked = the
 * theme's default set.
 *
 * Desktop: the three panels side by side, the canvas and quotation staying in
 * view. Phones and tablets: tabs (Selection · Preview · Quotation total).
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

function QuotationTotal({ label, value, className }: { label: string; value: string; className?: string }) {
    return (
        <div className={cx('flex items-center justify-between gap-2 py-1.5', className)}>
            <dt className="min-w-0 truncate">{label}</dt>
            <dd className="shrink-0 font-bold">{value}</dd>
        </div>
    );
}

function QuotationLine({ name, detail, note, amount, asset = false }: { name: string; detail: string; note?: string; amount: string; asset?: boolean }) {
    return (
        <li className="py-2.5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className={cx('text-sm font-bold', asset ? 'text-gold-dark' : 'text-ink')}>{name}</p>
                    <p className="text-xs text-ink-soft">{detail}</p>
                    {note && <p className="mt-0.5 text-[11px] text-ink-soft">{note}</p>}
                </div>
                <p className={cx('shrink-0 text-sm font-bold', amount === 'To be priced' ? 'text-gold-dark' : 'text-ink')}>{amount}</p>
            </div>
        </li>
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
    // One section open at a time: opening one folds the others. Services first.
    const [openSection, setOpenSection] = useState<'services' | 'theme' | 'assets' | null>('services');
    const toggleSection = (section: 'services' | 'theme' | 'assets') => setOpenSection((open) => (open === section ? null : section));
    const [quotationOpen, setQuotationOpen] = useState(false);
    // Phones and tablets: one panel at a time, picked with the tabs. Desktop shows all three.
    const [mobileTab, setMobileTab] = useState<'selection' | 'preview' | 'quotation'>('selection');
    const [venueFilter, setVenueFilter] = useState<VenueFilter>('all');
    const [otherCategory, setOtherCategory] = useState<string | null>(null);

    // Themes made for the chosen event type, then the venue filter.
    const themesForType = eventTypeId === null ? [] : themes.filter((t) => t.eventTypeId === eventTypeId);
    const visibleThemes = themesForType.filter((t) => venueFilter === 'all' || t.venue === venueFilter);
    const selectedTheme = themes.find((t) => t.id === themeId);
    const suggestedTheme = eventTypeId === null ? null : defaultThemeFor(themes, eventTypeId, guests);

    const selectedServices = services.filter((s) => serviceIds.includes(s.id));

    // The layout: the ticked assets (the theme's default set to start with), then "Other" items.
    const lines = resolveLayout(selectedTheme, assets, layoutChoice, guests);
    const ticked = tickedAssetIds(selectedTheme, assets, layoutChoice);

    // The admin's categories first, then any other category an asset uses.
    const categories = Array.from(new Set([...assetCategories, ...assets.map((a) => a.category)]));

    const previewItems = [
        ...selectedServices.map((s) => ({ key: `service-${s.id}`, name: s.name, category: s.category, kind: 'service' as const })),
        ...lines.map((l) => ({ key: l.key, name: l.name, category: l.category, kind: 'asset' as const })),
    ];

    // A full-view tab opened from this canvas follows the changes made here.
    const previewKey = JSON.stringify([selectedTheme?.name ?? null, previewItems]);
    useEffect(() => {
        syncLayoutView({ themeName: selectedTheme?.name ?? null, items: previewItems });
        // previewKey stands for the theme and the items.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewKey]);

    const toggleService = (id: number) =>
        onServiceIdsChange(serviceIds.includes(id) ? serviceIds.filter((x) => x !== id) : [...serviceIds, id]);

    // Ticking works from what is ticked now (the default set at first). Unticking the last one
    // brings the default set back, which is what an empty selection means.
    const toggleAsset = (id: number) => {
        const next = ticked.includes(id) ? ticked.filter((x) => x !== id) : [...ticked, id];
        onLayoutChoiceChange({ ...layoutChoice, assetIds: next.length > 0 ? next : null });
    };

    const addCustom = (item: CustomItem) => onLayoutChoiceChange({ ...layoutChoice, customItems: [...layoutChoice.customItems, item] });
    const removeCustom = (key: string) =>
        onLayoutChoiceChange({ ...layoutChoice, customItems: layoutChoice.customItems.filter((c) => c.key !== key) });

    // Quotation: the same arithmetic the server uses when the request is saved.
    const lineFor = (s: CatalogService) => {
        const qty = quantityFor(s, guests);
        return { qty, total: s.price * qty };
    };
    const assetsTotal = lines.reduce((sum, l) => sum + (l.subtotal ?? 0), 0);
    const servicesTotal = selectedServices.reduce((sum, s) => sum + lineFor(s).total, 0);
    const pricedLines = lines.filter((l) => l.unitPrice !== null).length;
    const toBePriced = lines.filter((l) => l.unitPrice === null).length;
    const estimatedTotal = (baseFee?.price ?? 0) + servicesTotal + assetsTotal;

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
        // Desktop: a framed box. Phones and tablets: no frame, so the panels get the full width.
        <div className="lg:rounded-2xl lg:border lg:border-black/15 lg:bg-neutral-50 lg:p-4">
            {/* Phones and tablets: tabs, one panel at a time at full width. */}
            <div role="tablist" aria-label="Services and assets" className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-neutral-200/70 p-1 lg:hidden">
                {(
                    [
                        ['selection', 'Selection'],
                        ['preview', 'Preview'],
                        ['quotation', 'Quotation'],
                    ] as const
                ).map(([tab, label]) => (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={mobileTab === tab}
                        onClick={() => setMobileTab(tab)}
                        className={cx(
                            'rounded-lg px-2 py-2 text-xs font-bold whitespace-nowrap transition',
                            mobileTab === tab ? 'bg-white text-gold-dark shadow-sm' : 'text-ink-soft',
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Desktop: the three panels share one fixed height. Only the selection list scrolls (inside its
                panel), so the canvas and the quotation stay put and line up. */}
            <div className="grid gap-4 lg:h-[36rem] lg:grid-cols-[280px_minmax(0,1fr)_240px]">
                {/* ---- Selection Panel ---- */}
                <div
                    className={cx(
                        'min-h-0 flex-col rounded-xl border border-black/15 bg-white p-3 lg:flex lg:overflow-y-auto lg:overscroll-contain',
                        mobileTab === 'selection' ? 'flex' : 'hidden',
                    )}
                >
                    <PanelHeader title="Selection Panel" />

                    <CollapsibleSection
                        title="Services Needed"
                        meta={`${selectedServices.length} selected`}
                        open={openSection === 'services'}
                        onToggle={() => toggleSection('services')}
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
                        open={openSection === 'theme'}
                        onToggle={() => toggleSection('theme')}
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
                        open={openSection === 'assets'}
                        onToggle={() => toggleSection('assets')}
                    >
                        <p className="mb-3 text-[11px] text-ink-soft">
                            {selectedTheme
                                ? `${selectedTheme.name}'s set is already picked for you. Tick or untick anything; with nothing ticked, the theme's set is used.`
                                : 'Pick the design assets you would like.'}{' '}
                            Quantities like chairs and tables follow your guest count.
                        </p>

                        {categories.map((cat) => {
                            const inCategory = assets.filter((a) => a.category === cat);
                            const customs = layoutChoice.customItems.filter((c) => c.category === cat);
                            return (
                                <div key={cat} className="mb-3 last:mb-0">
                                    <p className="mb-1.5 text-[10px] font-bold tracking-wide text-ink-soft uppercase">{cat}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {inCategory.map((a) => {
                                            const on = ticked.includes(a.id);
                                            return (
                                                <button
                                                    key={a.id}
                                                    type="button"
                                                    aria-pressed={on}
                                                    onClick={() => toggleAsset(a.id)}
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
                                                <li key={c.key} className="flex items-start justify-between gap-2 rounded-lg border border-gold bg-gold/10 p-2">
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

                {/* ---- Design Preview: a fixed-height canvas that stays in view on wide screens (below the 5rem header) ---- */}
                <div
                    className={cx(
                        'min-h-0 flex-col rounded-xl border border-black/15 bg-white p-3 lg:flex',
                        mobileTab === 'preview' ? 'flex' : 'hidden',
                    )}
                >
                    <PanelHeader title="Design Preview" />
                    {/* Wide (landscape) on phones and tablets so the labels have room; a fixed height on desktop. */}
                    <div className="flex aspect-[4/3] flex-col lg:aspect-auto lg:min-h-0 lg:flex-1">
                        <LayoutPreview themeName={selectedTheme?.name} items={previewItems} expandable />
                    </div>
                </div>

                {/* ---- Quotation Panel: the totals; every line is in "View full quotation" ---- */}
                <div
                    className={cx(
                        'min-h-0 flex-col rounded-xl border border-black/15 bg-white p-4 lg:flex lg:overflow-y-auto',
                        mobileTab === 'quotation' ? 'flex' : 'hidden',
                    )}
                >
                    <PanelHeader title="Quotation Panel" />

                    <dl className="divide-y divide-black/5 text-xs">
                        {baseFee && <QuotationTotal label={baseFee.name} value={peso(baseFee.price)} />}
                        <QuotationTotal label={`Services (${selectedServices.length})`} value={peso(servicesTotal)} />
                        <QuotationTotal label={`Design assets (${pricedLines})`} value={peso(assetsTotal)} />
                        {toBePriced > 0 && (
                            <QuotationTotal label="To be priced" value={`${toBePriced} ${toBePriced === 1 ? 'item' : 'items'}`} className="text-gold-dark" />
                        )}
                    </dl>

                    <div className="mt-2 flex items-center justify-between border-t-2 border-black/15 pt-3">
                        <p className="text-sm font-bold text-ink">Estimated Total</p>
                        <p className="text-lg font-bold text-gold-dark">{peso(estimatedTotal)}</p>
                    </div>

                    <OutlineButton className="mt-3 w-full justify-center py-2 text-xs" onClick={() => setQuotationOpen(true)}>
                        <ListChecks className="size-4" /> View full quotation
                    </OutlineButton>

                    <div className="mt-3 space-y-3">
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
                                <span className="font-bold">Initial estimate only.</span> Our Design Specialist prepares the final design, and your final
                                quotation comes with the design proposal.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <Dialog open={quotationOpen} onOpenChange={setQuotationOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Initial quotation</DialogTitle>
                        <DialogDescription>Today&apos;s prices for what is on your layout. Initial estimate only.</DialogDescription>
                    </DialogHeader>

                    <ul className="max-h-[60vh] divide-y divide-black/10 overflow-y-auto pr-1">
                        {baseFee && <QuotationLine name={baseFee.name} detail="Included with every request" amount={peso(baseFee.price)} />}

                        {selectedServices.map((s) => {
                            const { qty, total } = lineFor(s);
                            const perGuest = isPerGuest(s);
                            return (
                                <QuotationLine
                                    key={s.id}
                                    name={s.name}
                                    detail={`${peso(s.price)}${s.unitType ? `/${s.unitType}` : ''}${perGuest ? ` × ${qty} pax` : ''}`}
                                    note={s.pricingType === 'per_unit' && !perGuest ? 'Counted once here. The Project Manager confirms the quantity.' : undefined}
                                    amount={peso(total)}
                                />
                            );
                        })}

                        {lines.map((l) => (
                            <QuotationLine key={l.key} name={l.name} detail={lineDetail(l)} amount={l.subtotal === null ? 'To be priced' : peso(l.subtotal)} asset />
                        ))}
                    </ul>

                    <div className="flex items-center justify-between border-t-2 border-black/15 pt-3">
                        <span className="font-bold text-ink">Estimated Total</span>
                        <span className="text-lg font-bold text-gold-dark">{peso(estimatedTotal)}</span>
                    </div>
                    {toBePriced > 0 && (
                        <p className="-mt-2 text-xs text-ink-soft">
                            Plus {toBePriced} {toBePriced === 1 ? 'item' : 'items'} to be priced.
                        </p>
                    )}
                </DialogContent>
            </Dialog>

            <OtherItemDialog category={otherCategory} onClose={() => setOtherCategory(null)} onAdd={addCustom} />
        </div>
    );
}
