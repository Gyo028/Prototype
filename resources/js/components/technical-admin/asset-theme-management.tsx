import { router } from '@inertiajs/react';
import { Check, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Field, GoldButton, OutlineButton, Panel, Pill, Switch, cx, inputClass, selectClass } from '@/components/dashboard/ui';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

/*
 * Design Themes and Design Assets
 *  - A theme carries the fields customers filter by (event type, venue,
 *    style) plus a guest cap. Event types come from `event_types`.
 *  - An asset has one price, counted once (fixed) or from the guest count
 *    (per guest, e.g. one table per 10 guests). An asset without a price is
 *    not offered to customers.
 *
 * Nothing is deleted: themes and assets are switched off instead, since
 * layouts refer to them.
 */

const BASE_URL = '/technical-admin/services-assets';

const VENUES = [
    { value: 'indoor', label: 'Indoor' },
    { value: 'outdoor', label: 'Outdoor' },
];

// Placeholder colours until themes get a background image.
const SWATCHES = [
    'linear-gradient(135deg,#e9e2d3,#cbbfa0)',
    'linear-gradient(135deg,#dbe7ec,#7fa7b8)',
    'linear-gradient(135deg,#e6ecd9,#b9c99a)',
    'linear-gradient(135deg,#fdf1de,#e8c48a)',
    'linear-gradient(135deg,#f2ece1,#cbb98f)',
    'linear-gradient(135deg,#f3e3ea,#e3a9c4)',
    'linear-gradient(135deg,#eef1de,#c3cf9a)',
    'linear-gradient(135deg,#ece4d0,#c9a86a)',
    'linear-gradient(135deg,#e4e6e8,#aab0b6)',
];

export type EventTypeOption = { id: number; name: string; active: boolean };

export type Theme = {
    id: number;
    name: string;
    eventTypeId: number;
    venue: string; // 'indoor' | 'outdoor'
    style: string;
    maxGuests: number;
    active: boolean;
};

export type PricingType = 'fixed' | 'per_guest';

export type Asset = {
    id: number;
    name: string;
    category: string;
    price: number | null;
    pricingType: PricingType;
    guestsPerUnit: number | null;
    active: boolean;
};

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;
const venueLabel = (v: string) => VENUES.find((x) => x.value === v)?.label ?? v;

/** "₱8,000 each", "₱45 per guest", "₱350 each · 1 per 10 guests", or "No price yet" */
function priceLabel(a: Pick<Asset, 'price' | 'pricingType' | 'guestsPerUnit'>) {
    if (a.price === null) return 'No price yet';
    if (a.pricingType !== 'per_guest') return `${peso(a.price)} each`;
    const per = a.guestsPerUnit ?? 1;
    return per === 1 ? `${peso(a.price)} per guest` : `${peso(a.price)} each · 1 per ${per} guests`;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-gold bg-gold text-white transition hover:bg-gold-dark"
        >
            {children}
        </button>
    );
}

const visitOptions = (setSaving: (v: boolean) => void, onSuccess: () => void, setErrors: (e: Record<string, string>) => void) => ({
    preserveScroll: true,
    preserveState: true,
    onStart: () => setSaving(true),
    onFinish: () => setSaving(false),
    onSuccess,
    onError: (serverErrors: Record<string, string>) => setErrors(serverErrors),
});

/* ---------------------------------------------------------------- */
/* Design Themes                                                    */
/* ---------------------------------------------------------------- */

type ThemeForm = { name: string; eventTypeId: string; venue: string; style: string; maxGuests: string; active: boolean };

function ThemesTab({ themes, eventTypes, styles }: { themes: Theme[]; eventTypes: EventTypeOption[]; styles: string[] }) {
    const firstActiveType = eventTypes.find((e) => e.active);
    const emptyForm: ThemeForm = {
        name: '',
        eventTypeId: firstActiveType ? String(firstActiveType.id) : '',
        venue: VENUES[0].value,
        style: styles[0] ?? '',
        maxGuests: '',
        active: true,
    };

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Theme | null>(null);
    const [form, setForm] = useState<ThemeForm>(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const activeCount = themes.filter((t) => t.active).length;
    const eventTypeName = (id: number) => eventTypes.find((e) => e.id === id)?.name ?? '—';

    // Active event types, plus the one a theme already uses even if it was switched off.
    const typeChoices = eventTypes.filter((e) => e.active || String(e.id) === form.eventTypeId);

    const openAdd = () => {
        setEditing(null);
        setForm(emptyForm);
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (t: Theme) => {
        setEditing(t);
        setForm({ name: t.name, eventTypeId: String(t.eventTypeId), venue: t.venue, style: t.style, maxGuests: String(t.maxGuests), active: t.active });
        setErrors({});
        setDialogOpen(true);
    };

    const save = () => {
        const e: Record<string, string> = {};
        if (!form.name.trim()) e.name = 'Theme name is required.';
        if (!form.eventTypeId) e.eventTypeId = 'Choose an event type.';
        if (!form.maxGuests || Number(form.maxGuests) <= 0) e.maxGuests = 'Enter a valid guest cap.';
        setErrors(e);
        if (Object.keys(e).length) return;

        const data = { ...form, eventTypeId: Number(form.eventTypeId), maxGuests: Number(form.maxGuests) };
        const options = visitOptions(setSaving, () => setDialogOpen(false), setErrors);

        if (editing === null) router.post(`${BASE_URL}/themes`, data, options);
        else router.patch(`${BASE_URL}/themes/${editing.id}`, data, options);
    };

    const toggle = (id: number, active: boolean) =>
        router.patch(`${BASE_URL}/themes/${id}/status`, { active }, { preserveScroll: true, preserveState: true });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">
                    {themes.length} {themes.length === 1 ? 'theme' : 'themes'} · {activeCount} active
                </p>
                <GoldButton aria-label="Add design theme" title="Add design theme" className="size-10 p-0" onClick={openAdd}>
                    <Plus className="size-5" />
                </GoldButton>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {themes.map((t) => (
                    <Panel key={t.id} className={cx('flex flex-col overflow-hidden p-0', !t.active && 'opacity-70')}>
                        <div className="flex aspect-[3/1] items-center justify-center" style={{ backgroundImage: SWATCHES[t.id % SWATCHES.length] }} />
                        <div className="flex flex-1 flex-col p-4">
                            <div className="flex items-start justify-between gap-3">
                                <h2 className="text-base font-bold text-ink">{t.name}</h2>
                                <Switch checked={t.active} label={`${t.active ? 'Deactivate' : 'Activate'} ${t.name}`} onChange={(v) => toggle(t.id, v)} />
                            </div>
                            <p className="mt-1 flex-1 text-xs text-ink-soft">
                                {eventTypeName(t.eventTypeId)} · {venueLabel(t.venue)} · {t.style} · up to {t.maxGuests} guests
                            </p>
                            <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3">
                                <Pill tone={t.active ? 'green' : 'gray'}>{t.active ? 'Active' : 'Inactive'}</Pill>
                                <IconButton label={`Edit ${t.name}`} onClick={() => openEdit(t)}>
                                    <Pencil className="size-4" />
                                </IconButton>
                            </div>
                        </div>
                    </Panel>
                ))}
            </div>

            {themes.length === 0 && (
                <Panel className="p-8 text-center text-sm text-ink-soft">No design themes yet. Use the + button to add the first one.</Panel>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editing === null ? 'Add Design Theme' : 'Edit Design Theme'}</DialogTitle>
                        <DialogDescription>These are the same fields customers filter and choose by.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Theme name" htmlFor="theme-name" required error={errors.name} className="sm:col-span-2">
                            <input id="theme-name" className={inputClass} maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </Field>
                        <Field label="Event type" htmlFor="theme-event" required error={errors.eventTypeId}>
                            <select id="theme-event" className={selectClass} value={form.eventTypeId} onChange={(e) => setForm({ ...form, eventTypeId: e.target.value })}>
                                {typeChoices.map((et) => (
                                    <option key={et.id} value={et.id}>
                                        {et.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Max guests" htmlFor="theme-guests" required error={errors.maxGuests}>
                            <input id="theme-guests" type="number" min="1" className={inputClass} value={form.maxGuests} onChange={(e) => setForm({ ...form, maxGuests: e.target.value })} />
                        </Field>
                        <Field label="Venue" htmlFor="theme-venue" required error={errors.venue}>
                            <select id="theme-venue" className={selectClass} value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })}>
                                {VENUES.map((v) => (
                                    <option key={v.value} value={v.value}>
                                        {v.label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Style" htmlFor="theme-style" required error={errors.style}>
                            <select id="theme-style" className={selectClass} value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })}>
                                {styles.map((st) => (
                                    <option key={st}>{st}</option>
                                ))}
                            </select>
                        </Field>
                        <div className="flex items-center gap-3 sm:col-span-2">
                            <span className="text-sm text-ink">Availability</span>
                            <Switch checked={form.active} label="Availability" onChange={(v) => setForm({ ...form, active: v })} />
                            <span className={cx('text-xs font-semibold', form.active ? 'text-green-700' : 'text-ink-soft')}>{form.active ? 'Active' : 'Inactive'}</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <OutlineButton onClick={() => setDialogOpen(false)}>Cancel</OutlineButton>
                        <GoldButton onClick={save} disabled={saving}>
                            <Check className="size-4" /> Save
                        </GoldButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ---------------------------------------------------------------- */
/* Design Assets (one price each)                                   */
/* ---------------------------------------------------------------- */

type AssetForm = { name: string; category: string; price: string; pricingType: PricingType; guestsPerUnit: string; active: boolean };

function AssetsTab({ assets, categories }: { assets: Asset[]; categories: string[] }) {
    const emptyForm: AssetForm = { name: '', category: categories[0] ?? '', price: '', pricingType: 'fixed', guestsPerUnit: '1', active: true };

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Asset | null>(null);
    const [form, setForm] = useState<AssetForm>(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const activeCount = assets.filter((a) => a.active).length;
    const perGuest = form.pricingType === 'per_guest';

    const openAdd = () => {
        setEditing(null);
        setForm(emptyForm);
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (a: Asset) => {
        setEditing(a);
        setForm({
            name: a.name,
            category: a.category,
            price: a.price === null ? '' : String(a.price),
            pricingType: a.pricingType,
            guestsPerUnit: String(a.guestsPerUnit ?? 1),
            active: a.active,
        });
        setErrors({});
        setDialogOpen(true);
    };

    const save = () => {
        const e: Record<string, string> = {};
        if (!form.name.trim()) e.name = 'Asset name is required.';
        if (!form.price || Number(form.price) <= 0) e.price = 'Enter a valid price.';
        if (perGuest && (!Number.isInteger(Number(form.guestsPerUnit)) || Number(form.guestsPerUnit) < 1))
            e.guestsPerUnit = 'Enter how many guests one unit serves.';
        setErrors(e);
        if (Object.keys(e).length) return;

        const data = {
            name: form.name,
            category: form.category,
            price: form.price,
            pricingType: form.pricingType,
            guestsPerUnit: perGuest ? Number(form.guestsPerUnit) : null,
            active: form.active,
        };
        const options = visitOptions(setSaving, () => setDialogOpen(false), setErrors);

        if (editing === null) router.post(`${BASE_URL}/assets`, data, options);
        else router.patch(`${BASE_URL}/assets/${editing.id}`, data, options);
    };

    const toggle = (id: number, active: boolean) =>
        router.patch(`${BASE_URL}/assets/${id}/status`, { active }, { preserveScroll: true, preserveState: true });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">
                    {assets.length} {assets.length === 1 ? 'asset' : 'assets'} · {activeCount} active
                </p>
                <GoldButton aria-label="Add design asset" title="Add design asset" className="size-10 p-0" onClick={openAdd}>
                    <Plus className="size-5" />
                </GoldButton>
            </div>

            {categories.map((cat) => {
                const items = assets.filter((a) => a.category === cat);
                if (!items.length) return null;
                return (
                    <div key={cat}>
                        <p className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">{cat}</p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((a) => (
                                <Panel key={a.id} className={cx('flex items-center justify-between gap-3 p-3', !a.active && 'opacity-70')}>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-ink">{a.name}</p>
                                        <p className={cx('text-xs', a.price === null ? 'text-red-700' : 'text-ink-soft')}>{priceLabel(a)}</p>
                                        <Pill tone={a.active ? 'green' : 'gray'} className="mt-1">
                                            {a.active ? 'Active' : 'Inactive'}
                                        </Pill>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch checked={a.active} label={`${a.active ? 'Deactivate' : 'Activate'} ${a.name}`} onChange={(v) => toggle(a.id, v)} />
                                        <IconButton label={`Edit ${a.name}`} onClick={() => openEdit(a)}>
                                            <Pencil className="size-4" />
                                        </IconButton>
                                    </div>
                                </Panel>
                            ))}
                        </div>
                    </div>
                );
            })}

            {assets.length === 0 && (
                <Panel className="p-8 text-center text-sm text-ink-soft">No design assets yet. Use the + button to add the first one.</Panel>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editing === null ? 'Add Design Asset' : 'Edit Design Asset'}</DialogTitle>
                        <DialogDescription>A new price applies to requests sent after it. Requests already sent keep their price.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Asset name" htmlFor="asset-name" required error={errors.name}>
                            <input id="asset-name" className={inputClass} maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </Field>
                        <Field label="Category" htmlFor="asset-category" required error={errors.category}>
                            <select id="asset-category" className={selectClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                                {categories.map((c) => (
                                    <option key={c}>{c}</option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Counted" htmlFor="asset-pricing" required error={errors.pricingType}>
                            <select
                                id="asset-pricing"
                                className={selectClass}
                                value={form.pricingType}
                                onChange={(e) => setForm({ ...form, pricingType: e.target.value as PricingType })}
                            >
                                <option value="fixed">Once per event (e.g. backdrop, arch)</option>
                                <option value="per_guest">By guest count (e.g. chairs, tables)</option>
                            </select>
                        </Field>
                        <Field label={perGuest ? 'Price per unit (₱)' : 'Price (₱)'} htmlFor="asset-price" required error={errors.price}>
                            <input
                                id="asset-price"
                                type="number"
                                min="0"
                                step="0.01"
                                className={inputClass}
                                value={form.price}
                                onChange={(e) => setForm({ ...form, price: e.target.value })}
                            />
                        </Field>

                        {perGuest && (
                            <Field label="Guests per unit" htmlFor="asset-per-unit" required error={errors.guestsPerUnit} className="sm:col-span-2">
                                <input
                                    id="asset-per-unit"
                                    type="number"
                                    min="1"
                                    step="1"
                                    className={inputClass}
                                    value={form.guestsPerUnit}
                                    onChange={(e) => setForm({ ...form, guestsPerUnit: e.target.value })}
                                />
                                <span className="text-[11px] text-ink-soft">
                                    1 = one per guest (chairs). 10 = one per 10 guests (tables). 150 guests ÷ {Number(form.guestsPerUnit) || 1} ={' '}
                                    {Math.ceil(150 / Math.max(1, Number(form.guestsPerUnit) || 1))} units, rounded up.
                                </span>
                            </Field>
                        )}

                        <div className="flex items-center gap-3 sm:col-span-2">
                            <span className="text-sm text-ink">Availability</span>
                            <Switch checked={form.active} label="Availability" onChange={(v) => setForm({ ...form, active: v })} />
                            <span className={cx('text-xs font-semibold', form.active ? 'text-green-700' : 'text-ink-soft')}>{form.active ? 'Active' : 'Inactive'}</span>
                        </div>
                    </div>

                    <DialogFooter>
                        <OutlineButton onClick={() => setDialogOpen(false)}>Cancel</OutlineButton>
                        <GoldButton onClick={save} disabled={saving}>
                            <Check className="size-4" /> Save
                        </GoldButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ---------------------------------------------------------------- */
/* Tabs                                                             */
/* ---------------------------------------------------------------- */

type Props = {
    themes: Theme[];
    eventTypes: EventTypeOption[];
    styles: string[];
    assets: Asset[];
    assetCategories: string[];
};

export default function AssetThemeManagement({ themes, eventTypes, styles, assets, assetCategories }: Props) {
    const [tab, setTab] = useState<'themes' | 'assets'>('themes');

    return (
        <div className="space-y-5">
            <div className="inline-flex gap-1 rounded-xl border border-black/10 bg-neutral-200/60 p-1">
                {(['themes', 'assets'] as const).map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className={cx(
                            'rounded-lg border px-5 py-1.5 text-sm font-bold transition',
                            tab === t ? 'border-black/10 bg-white text-gold-dark' : 'border-transparent text-ink-soft',
                        )}
                    >
                        {t === 'themes' ? 'Design Themes' : 'Design Assets'}
                    </button>
                ))}
            </div>

            {tab === 'themes' ? (
                <ThemesTab themes={themes} eventTypes={eventTypes} styles={styles} />
            ) : (
                <AssetsTab assets={assets} categories={assetCategories} />
            )}
        </div>
    );
}