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
 * Design Themes and Design Assets (backlog item 11 / the ERD's `design_themes`,
 * `layout_assets` and `asset_variants`). Aligned with the customer-facing
 * Design Theme and Design Assets sections of Services & Assets:
 *  - A theme carries the same fields the customer filters by (event type,
 *    venue, style) plus a guest cap.
 *  - An asset is a checklist item only — no price or quantity yet, matching
 *    the customer side, which defers pricing and quantities to the still
 *    unbuilt Layout Panel. `asset_variants.price` stays for later.
 *
 * Both are switched off rather than deleted, since approved layouts may
 * reference them (preliminary_layouts / preliminary_layout_items).
 */

const EVENT_TYPES = [
    { id: 'corporate', name: 'Corporate' },
    { id: 'wedding', name: 'Wedding' },
    { id: 'birthday', name: 'Birthday' },
    { id: 'debut', name: 'Debut' },
    { id: 'mall', name: 'Mall Activation' },
];
const VENUES = ['Outdoor', 'Indoor'];
const STYLES = ['Modern', 'Rustic', 'Futuristic', 'Classic', 'Bohemian'];
const ASSET_CATEGORIES = ['Furniture', 'Structures', 'Decors', 'Lighting'];

type Theme = {
    id: string;
    name: string;
    eventTypeId: string;
    venue: string;
    style: string;
    maxGuests: number;
    swatch: string;
    active: boolean;
};

// Placeholder data until the database is connected — matches the customer-side sample themes.
const seedThemes: Theme[] = [
    { id: 'modern-lounge', name: 'Modern Lounge', eventTypeId: 'corporate', venue: 'Indoor', style: 'Modern', maxGuests: 150, swatch: 'linear-gradient(135deg,#e9e2d3,#cbbfa0)', active: true },
    { id: 'futuristic-gala', name: 'Futuristic Gala', eventTypeId: 'corporate', venue: 'Indoor', style: 'Futuristic', maxGuests: 300, swatch: 'linear-gradient(135deg,#dbe7ec,#7fa7b8)', active: true },
    { id: 'garden-romance', name: 'Garden Romance', eventTypeId: 'wedding', venue: 'Outdoor', style: 'Rustic', maxGuests: 250, swatch: 'linear-gradient(135deg,#e6ecd9,#b9c99a)', active: true },
    { id: 'beach-bohemian', name: 'Beach Bohemian', eventTypeId: 'wedding', venue: 'Outdoor', style: 'Bohemian', maxGuests: 150, swatch: 'linear-gradient(135deg,#fdf1de,#e8c48a)', active: true },
    { id: 'classic-ballroom', name: 'Classic Ballroom', eventTypeId: 'wedding', venue: 'Indoor', style: 'Classic', maxGuests: 300, swatch: 'linear-gradient(135deg,#f2ece1,#cbb98f)', active: true },
    { id: 'party-corner', name: 'Party Corner', eventTypeId: 'birthday', venue: 'Indoor', style: 'Modern', maxGuests: 80, swatch: 'linear-gradient(135deg,#f3e3ea,#e3a9c4)', active: true },
    { id: 'rustic-garden-party', name: 'Rustic Garden Party', eventTypeId: 'birthday', venue: 'Outdoor', style: 'Rustic', maxGuests: 100, swatch: 'linear-gradient(135deg,#eef1de,#c3cf9a)', active: true },
    { id: 'debut-glam', name: 'Debut Glam', eventTypeId: 'debut', venue: 'Indoor', style: 'Futuristic', maxGuests: 200, swatch: 'linear-gradient(135deg,#ece4d0,#c9a86a)', active: true },
    { id: 'mall-booth', name: 'Mall Display Booth', eventTypeId: 'mall', venue: 'Indoor', style: 'Modern', maxGuests: 1000, swatch: 'linear-gradient(135deg,#e4e6e8,#aab0b6)', active: true },
];

type Asset = { id: string; name: string; category: string; active: boolean };

// Placeholder data until the database is connected — matches the customer-side sample assets.
const seedAssets: Asset[] = [
    { id: 'chiavari-chair', name: 'Chiavari Chairs', category: 'Furniture', active: true },
    { id: 'cocktail-table', name: 'Cocktail Tables', category: 'Furniture', active: true },
    { id: 'backdrop-panel', name: 'Backdrop Panel', category: 'Structures', active: true },
    { id: 'entrance-arch', name: 'Entrance Arch', category: 'Structures', active: true },
    { id: 'balloon-cluster', name: 'Balloon Clusters', category: 'Decors', active: true },
    { id: 'floral-centerpiece', name: 'Floral Centerpieces', category: 'Decors', active: true },
    { id: 'fairy-lights', name: 'Fairy Lights', category: 'Lighting', active: true },
    { id: 'uplighting', name: 'Uplighting', category: 'Lighting', active: true },
];

const slugify = (name: string) =>
    name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `item-${Date.now()}`;

/* Icon-only button with an accessible name and a tooltip */
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

/* ---------------------------------------------------------------------- */
/* Design Themes                                                          */
/* ---------------------------------------------------------------------- */

type ThemeForm = { name: string; eventTypeId: string; venue: string; style: string; maxGuests: string; active: boolean };
const emptyThemeForm: ThemeForm = { name: '', eventTypeId: EVENT_TYPES[0].id, venue: VENUES[0], style: STYLES[0], maxGuests: '', active: true };

function ThemesTab() {
    const [themes, setThemes] = useState<Theme[]>(seedThemes);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<ThemeForm>(emptyThemeForm);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const activeCount = themes.filter((t) => t.active).length;
    const eventTypeName = (id: string) => EVENT_TYPES.find((e) => e.id === id)?.name ?? id;

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyThemeForm);
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (t: Theme) => {
        setEditingId(t.id);
        setForm({ name: t.name, eventTypeId: t.eventTypeId, venue: t.venue, style: t.style, maxGuests: String(t.maxGuests), active: t.active });
        setErrors({});
        setDialogOpen(true);
    };

    const save = () => {
        const e: Record<string, string> = {};
        if (!form.name.trim()) e.name = 'Theme name is required.';
        if (!form.maxGuests || Number(form.maxGuests) <= 0) e.maxGuests = 'Enter a valid guest cap.';
        setErrors(e);
        if (Object.keys(e).length) return;

        const data = {
            name: form.name.trim(),
            eventTypeId: form.eventTypeId,
            venue: form.venue,
            style: form.style,
            maxGuests: Number(form.maxGuests),
            active: form.active,
        };

        if (editingId === null) {
            setThemes([...themes, { id: slugify(form.name), swatch: 'linear-gradient(135deg,#e9e2d3,#cbbfa0)', ...data }]);
        } else {
            setThemes(themes.map((t) => (t.id === editingId ? { ...t, ...data } : t)));
        }
        setDialogOpen(false);
    };

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
                        <div className="flex aspect-[3/1] items-center justify-center" style={{ backgroundImage: t.swatch }} />
                        <div className="flex flex-1 flex-col p-4">
                            <div className="flex items-start justify-between gap-3">
                                <h2 className="text-base font-bold text-ink">{t.name}</h2>
                                <Switch checked={t.active} label={`${t.active ? 'Deactivate' : 'Activate'} ${t.name}`} onChange={(v) => setThemes(themes.map((x) => (x.id === t.id ? { ...x, active: v } : x)))} />
                            </div>
                            <p className="mt-1 flex-1 text-xs text-ink-soft">
                                {eventTypeName(t.eventTypeId)} · {t.venue} · {t.style} · up to {t.maxGuests} guests
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

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingId === null ? 'Add Design Theme' : 'Edit Design Theme'}</DialogTitle>
                        <DialogDescription>These are the same fields customers filter and choose by.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Theme name" htmlFor="theme-name" required error={errors.name} className="sm:col-span-2">
                            <input id="theme-name" className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </Field>
                        <Field label="Event type" htmlFor="theme-event" required>
                            <select id="theme-event" className={selectClass} value={form.eventTypeId} onChange={(e) => setForm({ ...form, eventTypeId: e.target.value })}>
                                {EVENT_TYPES.map((et) => (
                                    <option key={et.id} value={et.id}>{et.name}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Max guests" htmlFor="theme-guests" required error={errors.maxGuests}>
                            <input id="theme-guests" type="number" min="1" className={inputClass} value={form.maxGuests} onChange={(e) => setForm({ ...form, maxGuests: e.target.value })} />
                        </Field>
                        <Field label="Venue" htmlFor="theme-venue" required>
                            <select id="theme-venue" className={selectClass} value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })}>
                                {VENUES.map((v) => (
                                    <option key={v}>{v}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Style" htmlFor="theme-style" required>
                            <select id="theme-style" className={selectClass} value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })}>
                                {STYLES.map((st) => (
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
                        <GoldButton onClick={save}>
                            <Check className="size-4" /> Save
                        </GoldButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ---------------------------------------------------------------------- */
/* Design Assets                                                          */
/* ---------------------------------------------------------------------- */

type AssetForm = { name: string; category: string; active: boolean };
const emptyAssetForm: AssetForm = { name: '', category: ASSET_CATEGORIES[0], active: true };

function AssetsTab() {
    const [assets, setAssets] = useState<Asset[]>(seedAssets);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<AssetForm>(emptyAssetForm);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const activeCount = assets.filter((a) => a.active).length;

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyAssetForm);
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (a: Asset) => {
        setEditingId(a.id);
        setForm({ name: a.name, category: a.category, active: a.active });
        setErrors({});
        setDialogOpen(true);
    };

    const save = () => {
        const e: Record<string, string> = {};
        if (!form.name.trim()) e.name = 'Asset name is required.';
        setErrors(e);
        if (Object.keys(e).length) return;

        const data = { name: form.name.trim(), category: form.category, active: form.active };
        if (editingId === null) {
            setAssets([...assets, { id: slugify(form.name), ...data }]);
        } else {
            setAssets(assets.map((a) => (a.id === editingId ? { ...a, ...data } : a)));
        }
        setDialogOpen(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm text-ink-soft">
                        {assets.length} {assets.length === 1 ? 'asset' : 'assets'} · {activeCount} active
                    </p>
                    <p className="text-[11px] text-ink-soft">
                        Checklist items only for now — no price or quantity yet, same as the customer-facing selector.
                    </p>
                </div>
                <GoldButton aria-label="Add design asset" title="Add design asset" className="size-10 p-0" onClick={openAdd}>
                    <Plus className="size-5" />
                </GoldButton>
            </div>

            {ASSET_CATEGORIES.map((cat) => {
                const items = assets.filter((a) => a.category === cat);
                if (!items.length) return null;
                return (
                    <div key={cat}>
                        <p className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">{cat}</p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((a) => (
                                <Panel key={a.id} className={cx('flex items-center justify-between gap-3 p-3', !a.active && 'opacity-70')}>
                                    <div>
                                        <p className="text-sm font-bold text-ink">{a.name}</p>
                                        <Pill tone={a.active ? 'green' : 'gray'} className="mt-1">{a.active ? 'Active' : 'Inactive'}</Pill>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch checked={a.active} label={`${a.active ? 'Deactivate' : 'Activate'} ${a.name}`} onChange={(v) => setAssets(assets.map((x) => (x.id === a.id ? { ...x, active: v } : x)))} />
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

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId === null ? 'Add Design Asset' : 'Edit Design Asset'}</DialogTitle>
                        <DialogDescription>Name and category only — pricing and variants come once the Layout Panel is built.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Field label="Asset name" htmlFor="asset-name" required error={errors.name}>
                            <input id="asset-name" className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </Field>
                        <Field label="Category" htmlFor="asset-category" required>
                            <select id="asset-category" className={selectClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                                {ASSET_CATEGORIES.map((c) => (
                                    <option key={c}>{c}</option>
                                ))}
                            </select>
                        </Field>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-ink">Availability</span>
                            <Switch checked={form.active} label="Availability" onChange={(v) => setForm({ ...form, active: v })} />
                            <span className={cx('text-xs font-semibold', form.active ? 'text-green-700' : 'text-ink-soft')}>{form.active ? 'Active' : 'Inactive'}</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <OutlineButton onClick={() => setDialogOpen(false)}>Cancel</OutlineButton>
                        <GoldButton onClick={save}>
                            <Check className="size-4" /> Save
                        </GoldButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ---------------------------------------------------------------------- */
/* Container: tab switch                                                  */
/* ---------------------------------------------------------------------- */

export default function AssetThemeManagement() {
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

            {tab === 'themes' ? <ThemesTab /> : <AssetsTab />}
        </div>
    );
}
