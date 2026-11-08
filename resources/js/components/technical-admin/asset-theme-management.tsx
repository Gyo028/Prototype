import { router } from '@inertiajs/react';
import { Check, Pencil, Plus, X } from 'lucide-react';
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
 *  - An asset holds its priced variants (e.g. Chiavari Chairs - Gold, ₱150).
 *    The asset and its variants are saved together with one Save.
 *
 * Nothing is deleted: themes, assets and variants are switched off instead,
 * since layouts refer to them.
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

export type Variant = { id: number; name: string; description: string; price: number; active: boolean };

export type Asset = { id: number; name: string; category: string; active: boolean; variants: Variant[] };

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;
const venueLabel = (v: string) => VENUES.find((x) => x.value === v)?.label ?? v;

/** "₱150", "₱150 – ₱200", or "No price yet" from the active variants */
function priceRange(variants: Variant[]) {
    const prices = variants.filter((v) => v.active).map((v) => v.price);
    if (!prices.length) return 'No price yet';
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? peso(min) : `${peso(min)} – ${peso(max)}`;
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
/* Design Assets (with variants and prices)                         */
/* ---------------------------------------------------------------- */

/** A variant row in the form. `id` is null for a new row that isn't saved yet. */
type VariantForm = { key: string; id: number | null; name: string; description: string; price: string; active: boolean };
type AssetForm = { name: string; category: string; active: boolean; variants: VariantForm[] };

let rowCounter = 0;
const newRow = (): VariantForm => ({ key: `new-${++rowCounter}`, id: null, name: '', description: '', price: '', active: true });

function AssetsTab({ assets, categories }: { assets: Asset[]; categories: string[] }) {
    const emptyForm: AssetForm = { name: '', category: categories[0] ?? '', active: true, variants: [] };

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Asset | null>(null);
    const [form, setForm] = useState<AssetForm>(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const activeCount = assets.filter((a) => a.active).length;

    const openAdd = () => {
        setEditing(null);
        setForm({ ...emptyForm, variants: [newRow()] });
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (a: Asset) => {
        setEditing(a);
        setForm({
            name: a.name,
            category: a.category,
            active: a.active,
            variants: a.variants.map((v) => ({
                key: `saved-${v.id}`,
                id: v.id,
                name: v.name,
                description: v.description,
                price: String(v.price),
                active: v.active,
            })),
        });
        setErrors({});
        setDialogOpen(true);
    };

    const setVariant = (index: number, changes: Partial<VariantForm>) =>
        setForm({ ...form, variants: form.variants.map((v, i) => (i === index ? { ...v, ...changes } : v)) });

    // Only rows that were never saved can be removed; saved variants are switched off instead.
    const removeRow = (index: number) => setForm({ ...form, variants: form.variants.filter((_, i) => i !== index) });

    const save = () => {
        const e: Record<string, string> = {};
        if (!form.name.trim()) e.name = 'Asset name is required.';
        form.variants.forEach((v, i) => {
            if (!v.name.trim()) e[`variants.${i}.name`] = 'Variant name is required.';
            if (!v.price || Number(v.price) <= 0) e[`variants.${i}.price`] = 'Enter a valid price.';
        });
        setErrors(e);
        if (Object.keys(e).length) return;

        const data = {
            name: form.name,
            category: form.category,
            active: form.active,
            variants: form.variants.map((v) => ({ id: v.id, name: v.name, description: v.description, price: v.price, active: v.active })),
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
                                        <p className="text-xs text-ink-soft">
                                            {priceRange(a.variants)}
                                            {a.variants.length > 0 && ` · ${a.variants.length} ${a.variants.length === 1 ? 'variant' : 'variants'}`}
                                        </p>
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
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editing === null ? 'Add Design Asset' : 'Edit Design Asset'}</DialogTitle>
                        <DialogDescription>The asset and its priced variants are saved together.</DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
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
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-sm text-ink">Availability</span>
                            <Switch checked={form.active} label="Availability" onChange={(v) => setForm({ ...form, active: v })} />
                            <span className={cx('text-xs font-semibold', form.active ? 'text-green-700' : 'text-ink-soft')}>{form.active ? 'Active' : 'Inactive'}</span>
                        </div>

                        {/* Variants & prices */}
                        <div className="border-t border-black/10 pt-4">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold text-ink">Variants &amp; prices</p>
                                    <p className="text-[11px] text-ink-soft">e.g. Gold, Silver, Large. Saved variants are switched off instead of removed.</p>
                                </div>
                                <OutlineButton onClick={() => setForm({ ...form, variants: [...form.variants, newRow()] })}>
                                    <Plus className="size-4" /> Add variant
                                </OutlineButton>
                            </div>
                            {errors.variants && <p className="mb-2 text-xs text-red-600">{errors.variants}</p>}

                            {form.variants.length === 0 && (
                                <p className="rounded-lg bg-neutral-100 p-3 text-xs text-ink-soft">No variants yet. Customers can't be quoted for this asset until it has a price.</p>
                            )}

                            <div className="space-y-3">
                                {form.variants.map((v, i) => (
                                    <div key={v.key} className={cx('rounded-lg border border-black/10 p-3', !v.active && 'opacity-60')}>
                                        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                                            <Field label="Variant name" htmlFor={`var-name-${v.key}`} required error={errors[`variants.${i}.name`]}>
                                                <input id={`var-name-${v.key}`} className={inputClass} maxLength={100} value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} />
                                            </Field>
                                            <Field label="Price (₱)" htmlFor={`var-price-${v.key}`} required error={errors[`variants.${i}.price`]}>
                                                <input id={`var-price-${v.key}`} type="number" min="0" step="0.01" className={inputClass} value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} />
                                            </Field>
                                            <Field label="Description (optional)" htmlFor={`var-desc-${v.key}`} error={errors[`variants.${i}.description`]} className="sm:col-span-2">
                                                <input id={`var-desc-${v.key}`} className={inputClass} maxLength={255} value={v.description} onChange={(e) => setVariant(i, { description: e.target.value })} />
                                            </Field>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between">
                                            {v.id === null ? (
                                                <button type="button" onClick={() => removeRow(i)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline">
                                                    <X className="size-3.5" /> Remove
                                                </button>
                                            ) : (
                                                <span />
                                            )}
                                            <div className="flex items-center gap-2">
                                                <Switch checked={v.active} label={`${v.active ? 'Switch off' : 'Switch on'} variant`} onChange={(on) => setVariant(i, { active: on })} />
                                                <span className={cx('text-xs font-semibold', v.active ? 'text-green-700' : 'text-ink-soft')}>{v.active ? 'Active' : 'Inactive'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
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