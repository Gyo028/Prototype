import { AlertTriangle, ChevronDown, Info } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { cx } from '@/components/dashboard/ui';

/*
 * Step 3: "Services & Assets" — a three-panel workspace matching the Figma
 * 2D Design Tool's overall page shape (Selection | Layout | Quotation), so
 * this step and the eventual Design Layout step feel like one tool:
 *
 *   - Selection Panel  (left):   what the customer picks: add-on services,
 *                                a design theme, then the design assets they
 *                                want included (chairs, backdrop, balloons...).
 *                                All three sections are collapsible. A theme
 *                                carries its own venue (Outdoor / Indoor) and
 *                                style, which the customer filters by directly
 *                                here — venue is not a separate Project
 *                                Details field. Design assets are a checklist
 *                                only: no price and no quantity here. They are
 *                                bundled into the flat styling fee below, and
 *                                their quantities (how many chairs, etc.) are
 *                                worked out automatically from the guest count
 *                                once the Layout Panel exists to place them.
 *   - Layout Panel     (middle): the design canvas — placeholder, built in
 *                                the next step (theme + auto-placement)
 *                                                                 [backlog 14]
 *   - Quotation Panel  (right):  a flat Event Styling fee, always included,
 *                                plus a running total for any add-on services
 *                                selected. Design assets aren't priced here
 *                                yet — that joins once the Layout Panel exists.
 *
 * Services Needed lists ADD-ON services only (DJ, photobooth, catering...).
 * Styling itself is not a checkbox here — the customer already chose "Event
 * Styling" as the request type in Step 1, so it is billed automatically and
 * shown as its own line in the Quotation Panel. Add-ons are chosen as plain
 * toggle buttons rather than checkboxes, to keep the list compact.
 *
 * The catalog below is hardcoded — a few sample rows only — until it comes
 * from the database (`services` in the ERD).
 */

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

// Flat fee for the styling service itself, included automatically with every
// Event Styling request. One flat price for now, regardless of theme or
// guest count — replace with real pricing once that is decided.
const STYLING_FEE = 45000;

/** Turns a Project Details budget option (e.g. "₱50,000 – ₱100,000", "Below ₱50,000",
 * "Above ₱500,000") into a numeric range so the live quotation can be checked against it. */
function parseBudgetRange(budget: string): { min: number; max: number | null } | null {
    if (!budget) return null;
    const num = (text: string) => Number(text.replace(/[^\d]/g, ''));

    if (budget.startsWith('Below')) return { min: 0, max: num(budget) };
    if (budget.startsWith('Above')) return { min: num(budget), max: null };

    const [lo, hi] = budget.split('–').map(num);
    return Number.isFinite(lo) && Number.isFinite(hi) ? { min: lo, max: hi } : null;
}

// Add-on services only. Styling is automatic once "Event Styling" is chosen
// in Step 1, so no styling package is listed here.
const requestableServices = [
    { id: 1, name: 'DJ Services', category: 'Entertainment', price: 15000, unit: '' },
    { id: 2, name: 'Photobooth Rental', category: 'Entertainment', price: 8000, unit: '' },
    { id: 3, name: 'Photography Package', category: 'Photo & Video', price: 20000, unit: '' },
    { id: 4, name: 'Videography Package', category: 'Photo & Video', price: 25000, unit: '' },
    { id: 5, name: 'Buffet Catering', category: 'Catering', price: 650, unit: 'pax' },
    { id: 6, name: 'Host / Emcee Services', category: 'Host', price: 5000, unit: '' },
];

// A theme is an isometric layout template (per the ERD's `design_themes`) that
// design assets will be auto-placed onto in the Layout Panel. Venue (Outdoor /
// Indoor) and style are attributes of the theme itself, not Project Details
// fields — the customer filters by them directly in this panel.
const VENUES = ['Outdoor', 'Indoor'] as const;

// Design assets are a checklist only — no price, no quantity (see the header
// comment above). A small sample list for now; moves to `layout_assets` in
// the database later.
type AssetCategory = 'Furniture' | 'Structures' | 'Decors' | 'Lighting';
const ASSET_CATEGORIES: AssetCategory[] = ['Furniture', 'Structures', 'Decors', 'Lighting'];

const layoutAssets: { id: string; name: string; category: AssetCategory }[] = [
    { id: 'chiavari-chair', name: 'Chiavari Chairs', category: 'Furniture' },
    { id: 'cocktail-table', name: 'Cocktail Tables', category: 'Furniture' },
    { id: 'backdrop-panel', name: 'Backdrop Panel', category: 'Structures' },
    { id: 'entrance-arch', name: 'Entrance Arch', category: 'Structures' },
    { id: 'balloon-cluster', name: 'Balloon Clusters', category: 'Decors' },
    { id: 'floral-centerpiece', name: 'Floral Centerpieces', category: 'Decors' },
    { id: 'fairy-lights', name: 'Fairy Lights', category: 'Lighting' },
    { id: 'uplighting', name: 'Uplighting', category: 'Lighting' },
];

const designThemes = [
    { id: 'modern-lounge', name: 'Modern Lounge', eventTypeId: 'corporate', eventTypeLabel: 'Corporate', venue: 'Indoor', style: 'Modern', maxGuests: 150, swatch: 'linear-gradient(135deg,#e9e2d3,#cbbfa0)' },
    { id: 'futuristic-gala', name: 'Futuristic Gala', eventTypeId: 'corporate', eventTypeLabel: 'Corporate', venue: 'Indoor', style: 'Futuristic', maxGuests: 300, swatch: 'linear-gradient(135deg,#dbe7ec,#7fa7b8)' },
    { id: 'garden-romance', name: 'Garden Romance', eventTypeId: 'wedding', eventTypeLabel: 'Wedding', venue: 'Outdoor', style: 'Rustic', maxGuests: 250, swatch: 'linear-gradient(135deg,#e6ecd9,#b9c99a)' },
    { id: 'beach-bohemian', name: 'Beach Bohemian', eventTypeId: 'wedding', eventTypeLabel: 'Wedding', venue: 'Outdoor', style: 'Bohemian', maxGuests: 150, swatch: 'linear-gradient(135deg,#fdf1de,#e8c48a)' },
    { id: 'classic-ballroom', name: 'Classic Ballroom', eventTypeId: 'wedding', eventTypeLabel: 'Wedding', venue: 'Indoor', style: 'Classic', maxGuests: 300, swatch: 'linear-gradient(135deg,#f2ece1,#cbb98f)' },
    { id: 'party-corner', name: 'Party Corner', eventTypeId: 'birthday', eventTypeLabel: 'Birthday', venue: 'Indoor', style: 'Modern', maxGuests: 80, swatch: 'linear-gradient(135deg,#f3e3ea,#e3a9c4)' },
    { id: 'rustic-garden-party', name: 'Rustic Garden Party', eventTypeId: 'birthday', eventTypeLabel: 'Birthday', venue: 'Outdoor', style: 'Rustic', maxGuests: 100, swatch: 'linear-gradient(135deg,#eef1de,#c3cf9a)' },
    { id: 'debut-glam', name: 'Debut Glam', eventTypeId: 'debut', eventTypeLabel: 'Debut', venue: 'Indoor', style: 'Futuristic', maxGuests: 200, swatch: 'linear-gradient(135deg,#ece4d0,#c9a86a)' },
    { id: 'mall-booth', name: 'Mall Display Booth', eventTypeId: 'mall', eventTypeLabel: 'Mall Activation', venue: 'Indoor', style: 'Modern', maxGuests: 1000, swatch: 'linear-gradient(135deg,#e4e6e8,#aab0b6)' },
];

type Props = {
    serviceIds: number[];
    onServiceIdsChange: (ids: number[]) => void;
    serviceError?: string;
    /** Expected guest count from Project Details, used to price per-pax services (e.g. catering). */
    guests?: number;
    themeId: string | null;
    onThemeIdChange: (id: string | null) => void;
    /** Event type from Project Details, used to filter the design themes shown. */
    eventTypeId?: string;
    /** Budget range from Project Details, used to flag the live quotation against it. */
    budget?: string;
    /** Design assets the customer wants included. Checklist only — no price, no quantity. */
    assetIds: string[];
    onAssetIdsChange: (ids: string[]) => void;
};

function PanelHeader({ title }: { title: string }) {
    return <p className="mb-3 text-xs font-bold tracking-wide text-ink uppercase">{title}</p>;
}

/** A titled, collapsible block used for both Services Needed and Design Theme. */
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

export default function ServicesAssetsSelector({
    serviceIds,
    onServiceIdsChange,
    serviceError,
    guests = 0,
    themeId,
    onThemeIdChange,
    eventTypeId,
    budget,
    assetIds,
    onAssetIdsChange,
}: Props) {
    const [servicesOpen, setServicesOpen] = useState(true);
    const [themeOpen, setThemeOpen] = useState(false);
    const [assetsOpen, setAssetsOpen] = useState(false);
    const [venueFilter, setVenueFilter] = useState<'All' | (typeof VENUES)[number]>('All');

    // Event Type (from Project Details) narrows automatically, falling back to
    // every theme if it would otherwise leave nothing to show. Venue and Style
    // are the customer's own filters on top of that, so an empty result from
    // either is shown as-is rather than silently ignored.
    const byEventType = eventTypeId ? designThemes.filter((t) => t.eventTypeId === eventTypeId) : designThemes;
    const afterAutoFilters = byEventType.length ? byEventType : designThemes;
    const visibleThemes = afterAutoFilters.filter((t) => venueFilter === 'All' || t.venue === venueFilter);

    const selectedTheme = themeId ? designThemes.find((t) => t.id === themeId) : undefined;

    const themeNote = !eventTypeId
        ? 'Choose an Event Type in Project Details to see themes made for it. Showing all themes for now.'
        : 'Optional for now. Your assets will be arranged on this theme once the Layout Panel is built.';

    const toggleService = (id: number) =>
        onServiceIdsChange(serviceIds.includes(id) ? serviceIds.filter((x) => x !== id) : [...serviceIds, id]);

    const toggleAsset = (id: string) =>
        onAssetIdsChange(assetIds.includes(id) ? assetIds.filter((x) => x !== id) : [...assetIds, id]);

    // Per-pax services (e.g. catering) are priced against the guest count from
    // Project Details; everything else is a flat, one-time price.
    const selectedServices = requestableServices.filter((s) => serviceIds.includes(s.id));
    const lineFor = (s: (typeof requestableServices)[number]) => {
        const qty = s.unit === 'pax' ? guests : 1;
        return { qty, total: s.price * qty };
    };
    const addOnsTotal = selectedServices.reduce((sum, s) => sum + lineFor(s).total, 0);
    const estimatedTotal = STYLING_FEE + addOnsTotal;

    // Flags the live total against the customer's stated budget. Silent when it fits.
    const budgetRange = budget ? parseBudgetRange(budget) : null;
    const budgetFlag =
        budgetRange && budgetRange.max !== null && estimatedTotal > budgetRange.max
            ? { tone: 'over' as const, icon: AlertTriangle, message: `This is ${peso(estimatedTotal - budgetRange.max)} over your selected budget (${budget}).` }
            : budgetRange && estimatedTotal < budgetRange.min
              ? { tone: 'under' as const, icon: Info, message: `This is ${peso(budgetRange.min - estimatedTotal)} under your selected budget (${budget}). You may have room to add more.` }
              : null;

    return (
        // One outer container holding all three panels, like the workspace behind
        // the Figma tool's panels. The middle column (Layout Panel) is given the
        // most room: the two side panels are fixed-width, it takes what's left.
        <div className="rounded-2xl border border-black/15 bg-neutral-50 p-4">
            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_220px] lg:items-stretch">
                {/* ---- Selection Panel ---- */}
                <div className="flex h-full flex-col rounded-xl border border-black/15 bg-white p-3" data-error={serviceError ? '' : undefined}>
                    <PanelHeader title="Selection Panel" />

                    <CollapsibleSection
                        title="Services Needed"
                        required
                        meta={`${serviceIds.length} selected`}
                        open={servicesOpen}
                        onToggle={() => setServicesOpen((o) => !o)}
                    >
                        <p className="mb-3 text-[11px] text-ink-soft">
                            Event styling is already included with your request. Add anything else you need for the event.
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                            {requestableServices.map((s) => {
                                const on = serviceIds.includes(s.id);
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => toggleService(s.id)}
                                        className={cx(
                                            'rounded-lg border p-2 text-left transition',
                                            on ? 'border-gold bg-gold/10' : 'border-black/15 hover:bg-black/[0.02]',
                                        )}
                                    >
                                        <span className="block text-[11px] font-bold text-ink">{s.name}</span>
                                        <span className="block text-[10px] text-ink-soft">
                                            {peso(s.price)}
                                            {s.unit && `/${s.unit}`}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </CollapsibleSection>
                    {serviceError && <p className="mt-2 text-xs text-red-600">{serviceError}</p>}

                    <div className="my-4 border-t border-black/10" />

                    <CollapsibleSection
                        title="Design Theme"
                        meta={selectedTheme ? selectedTheme.name : 'None yet'}
                        open={themeOpen}
                        onToggle={() => setThemeOpen((o) => !o)}
                    >
                        <p className="mb-3 text-[11px] text-ink-soft">{themeNote}</p>

                        {/* Venue and Style are filters the customer applies themselves, on
                            top of the automatic Event Type narrowing above — venue lives on
                            the theme itself, not as a separate Project Details field. */}
                        <div className="mb-1.5 flex flex-wrap gap-1.5">
                            {(['All', ...VENUES] as const).map((venue) => (
                                <button
                                    key={venue}
                                    type="button"
                                    onClick={() => setVenueFilter(venue)}
                                    className={cx(
                                        'rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition',
                                        venueFilter === venue ? 'border-gold bg-gold text-white' : 'border-black/15 text-ink-soft hover:bg-black/5',
                                    )}
                                >
                                    {venue}
                                </button>
                            ))}
                        </div>
                        {visibleThemes.length === 0 ? (
                            <p className="text-[11px] text-ink-soft">No themes match these filters. Try a different venue or style.</p>
                        ) : (
                            <div className="space-y-2">
                                {visibleThemes.map((t) => {
                                    const on = themeId === t.id;
                                    return (
                                        <label
                                            key={t.id}
                                            className={cx(
                                                'flex cursor-pointer items-center gap-2.5 rounded-lg border p-2 transition',
                                                on ? 'border-gold bg-gold/10' : 'border-black/15 hover:bg-black/[0.02]',
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="design-theme"
                                                className="size-3.5 shrink-0 accent-[#c99a2a]"
                                                checked={on}
                                                onChange={() => onThemeIdChange(t.id)}
                                            />
                                            <span
                                                className="size-8 shrink-0 rounded-md border border-black/10"
                                                style={{ backgroundImage: t.swatch }}
                                                aria-hidden="true"
                                            />
                                            <span className="min-w-0">
                                                <span className="block text-[11px] font-bold text-ink">{t.name}</span>
                                                <span className="block text-[10px] text-ink-soft">
                                                    {t.venue} · {t.style} · up to {t.maxGuests} guests
                                                </span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        {themeId && (
                            <button
                                type="button"
                                onClick={() => onThemeIdChange(null)}
                                className="mt-2 text-[11px] font-bold text-gold-dark hover:underline"
                            >
                                Clear selection
                            </button>
                        )}
                    </CollapsibleSection>

                    <div className="my-4 border-t border-black/10" />

                    <CollapsibleSection
                        title="Design Assets"
                        meta={`${assetIds.length} selected`}
                        open={assetsOpen}
                        onToggle={() => setAssetsOpen((o) => !o)}
                    >
                        <p className="mb-3 text-[11px] text-ink-soft">
                            Pick what you'd like included. Quantities (like how many chairs) are worked out automatically from your expected
                            guest count once we build your layout.
                        </p>

                        {ASSET_CATEGORIES.map((cat) => (
                            <div key={cat} className="mb-3 last:mb-0">
                                <p className="mb-1.5 text-[10px] font-bold tracking-wide text-ink-soft uppercase">{cat}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {layoutAssets
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

                {/* ---- Layout Panel: placeholder until the theme + auto-placement step.
                    flex-1 on the dashed canvas fills whatever height the row stretches to,
                    so it stays the dominant panel instead of leaving space unused below it. */}
                <div className="flex h-full flex-col rounded-xl border border-black/15 bg-white p-3">
                    <PanelHeader title="Design Preview" />
                    <div
                        className="flex min-h-64 flex-1 items-center justify-center rounded-lg border border-dashed border-black/20 bg-neutral-50 p-6 text-center"
                        style={{
                            backgroundImage: 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
                            backgroundSize: '24px 24px',
                        }}
                    >
                        <p className="text-sm text-ink-soft">
                            The design canvas is coming in the next step. You'll pick a design theme and arrange assets here.
                        </p>
                    </div>
                </div>

                {/* ---- Quotation Panel: running total for the selected services ---- */}
                <div className="flex h-full flex-col rounded-xl border border-black/15 bg-white p-4">
                    <PanelHeader title="Quotation Panel" />

                    <ul className="divide-y divide-black/10">
                        {/* Styling itself: always included, one flat price for now */}
                        <li className="py-2.5 first:pt-0">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="truncate text-xs font-bold text-ink">Event Styling</p>
                                    <p className="text-[11px] text-ink-soft">Included with every request</p>
                                </div>
                                <p className="shrink-0 text-xs font-bold text-ink">{peso(STYLING_FEE)}</p>
                            </div>
                        </li>

                        {selectedServices.map((s) => {
                                const { qty, total } = lineFor(s);
                                const noGuests = s.unit === 'pax' && qty === 0;
                                return (
                                    <li key={s.id} className="py-2.5 first:pt-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-bold text-ink">{s.name}</p>
                                                <p className="text-[11px] text-ink-soft">
                                                    {peso(s.price)}
                                                    {s.unit && `/${s.unit}`}
                                                    {s.unit === 'pax' && ` × ${qty} pax`}
                                                </p>
                                            </div>
                                            <p className="shrink-0 text-xs font-bold text-ink">{peso(total)}</p>
                                        </div>
                                        {noGuests && (
                                            <p className="mt-1 text-[10px] text-yellow-700">
                                                Set your expected guest count in Project Details to estimate this.
                                            </p>
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
                                <budgetFlag.icon
                                    className={cx('mt-0.5 size-4 shrink-0', budgetFlag.tone === 'over' ? 'text-red-600' : 'text-sky-600')}
                                />
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
