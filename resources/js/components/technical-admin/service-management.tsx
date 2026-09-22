import { Check, ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
    Field,
    GoldButton,
    OutlineButton,
    Panel,
    Pill,
    Switch,
    cx,
    inputClass,
    selectClass,
    textareaClass,
} from '@/components/dashboard/ui';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

/*
 * Service configuration (backlog item 11). Each service maps to a row of
 * `services` in the ERD: service_name, service_category, description,
 * pricing_type ('fixed' | 'per_unit'), unit_type and status (active / inactive).
 *
 * Aligned with the customer-facing Services & Assets step: Event Styling
 * itself is not a service the customer picks — it's a flat fee, automatically
 * included with every Event Styling request. It is kept here as a single
 * locked row (id 0) so its price stays editable without letting anyone
 * create a second one, rename it, or turn it off. Everything else in this
 * list is an add-on the customer can select (DJ, photography, catering...),
 * matching the categories used on the customer side: Entertainment,
 * Photo & Video, Catering, Host.
 *
 * Services are switched on or off rather than deleted, because approved
 * requests and quotations refer to them (project_request_services).
 *
 * NOTE FOR THE DOCUMENTATION: `services` still has no price column in the
 * ERD (see the earlier documentation-updates note) — `price` here is a
 * placeholder field until that's added.
 */

const PAGE_SIZE = 6;
const BASE_FEE_ID = 0;
const CATEGORIES = ['Entertainment', 'Photo & Video', 'Catering', 'Host'];
const UNIT_TYPES = ['sqm', 'pc', 'set', 'hour', 'day', 'pax'];

type PricingType = 'fixed' | 'per_unit';

type Service = {
    id: number;
    name: string;
    category: string;
    description: string;
    pricingType: PricingType;
    unitType: string;
    price: number;
    active: boolean;
    /** The automatic Event Styling fee — locked identity fields, always included. */
    isBaseFee?: boolean;
};

// Placeholder data until the database is connected.
const seed: Service[] = [
    { id: BASE_FEE_ID, name: 'Event Styling', category: 'Styling', description: 'Full event styling package. Automatically included with every Event Styling request.', pricingType: 'fixed', unitType: '', price: 45000, active: true, isBaseFee: true },
    { id: 1, name: 'DJ Services', category: 'Entertainment', description: 'Professional DJ and sound system for the event.', pricingType: 'fixed', unitType: '', price: 15000, active: true },
    { id: 2, name: 'Photobooth Rental', category: 'Entertainment', description: 'On-site photobooth with props and instant prints.', pricingType: 'fixed', unitType: '', price: 8000, active: true },
    { id: 3, name: 'Photography Package', category: 'Photo & Video', description: 'Event-day photography coverage.', pricingType: 'fixed', unitType: '', price: 20000, active: true },
    { id: 4, name: 'Videography Package', category: 'Photo & Video', description: 'Event-day videography coverage with edited highlights.', pricingType: 'fixed', unitType: '', price: 25000, active: true },
    { id: 5, name: 'Buffet Catering', category: 'Catering', description: 'Full buffet catering, priced per guest.', pricingType: 'per_unit', unitType: 'pax', price: 650, active: true },
    { id: 6, name: 'Host / Emcee Services', category: 'Host', description: 'Professional host or emcee for the event program.', pricingType: 'fixed', unitType: '', price: 5000, active: true },
];

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

type Form = {
    name: string;
    category: string;
    description: string;
    pricingType: PricingType;
    unitType: string;
    price: string;
    active: boolean;
};

const emptyForm: Form = {
    name: '',
    category: CATEGORIES[0],
    description: '',
    pricingType: 'fixed',
    unitType: '',
    price: '',
    active: true,
};

/* Icon-only button with an accessible name and a tooltip */
function IconButton({
    label,
    onClick,
    tone = 'plain',
    children,
}: {
    label: string;
    onClick: () => void;
    tone?: 'plain' | 'gold';
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            className={cx(
                'inline-flex size-9 items-center justify-center rounded-lg border transition',
                tone === 'plain' && 'border-black/15 bg-white text-ink hover:bg-black/5',
                tone === 'gold' && 'border-gold bg-gold text-white hover:bg-gold-dark',
            )}
        >
            {children}
        </button>
    );
}

export default function ServiceManagement() {
    const [services, setServices] = useState<Service[]>(seed);
    const [page, setPage] = useState(1);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<Form>(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const pages = Math.max(1, Math.ceil(services.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const start = (current - 1) * PAGE_SIZE;
    const visible = services.slice(start, start + PAGE_SIZE);
    const activeCount = services.filter((s) => s.active).length;

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyForm);
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (s: Service) => {
        setEditingId(s.id);
        setForm({
            name: s.name,
            category: s.category,
            description: s.description,
            pricingType: s.pricingType,
            unitType: s.unitType,
            price: String(s.price),
            active: s.active,
        });
        setErrors({});
        setDialogOpen(true);
    };

    const save = () => {
        const e: Record<string, string> = {};
        if (!form.name.trim()) e.name = 'Service name is required.';
        if (!form.description.trim()) e.description = 'Description is required.';
        if (!form.price || Number(form.price) <= 0) e.price = 'Enter a valid price.';
        if (form.pricingType === 'per_unit' && !form.unitType) e.unitType = 'Choose a unit type.';
        setErrors(e);
        if (Object.keys(e).length) return;

        const data = {
            name: form.name.trim(),
            category: form.category,
            description: form.description.trim(),
            pricingType: form.pricingType,
            unitType: form.pricingType === 'per_unit' ? form.unitType : '',
            price: Number(form.price),
            active: form.active,
        };

        if (editingId === null) {
            setServices([...services, { id: Date.now(), ...data }]);
            setPage(Math.ceil((services.length + 1) / PAGE_SIZE)); // jump to the new service
        } else {
            setServices(services.map((s) => (s.id === editingId ? { ...s, ...data } : s)));
        }
        setDialogOpen(false);
    };

    const toggle = (id: number, active: boolean) =>
        setServices(services.map((s) => (s.id === id ? { ...s, active } : s)));

    return (
        <div className="space-y-4">
            {/* Count and the Add button (upper right) */}
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">
                    {services.length} {services.length === 1 ? 'service' : 'services'} · {activeCount} active
                </p>
                <GoldButton aria-label="Add service" title="Add service" className="size-10 p-0" onClick={openAdd}>
                    <Plus className="size-5" />
                </GoldButton>
            </div>

            {/* Service cards. The Event Styling fee (isBaseFee) has no Deactivate
                switch and a distinct badge instead of Active/Inactive — it's always
                included, not a service the customer opts into. */}
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {visible.map((s) => (
                    <Panel key={s.id} className={cx('flex flex-col p-5', !s.active && !s.isBaseFee && 'opacity-70', s.isBaseFee && 'border-gold')}>
                        <div className="flex items-start justify-between gap-3">
                            <Pill tone="cream">{s.category}</Pill>
                            {!s.isBaseFee && (
                                <Switch
                                    checked={s.active}
                                    label={`${s.active ? 'Deactivate' : 'Activate'} ${s.name}`}
                                    onChange={(v) => toggle(s.id, v)}
                                />
                            )}
                        </div>

                        <h2 className="mt-3 text-lg font-bold text-ink">{s.name}</h2>
                        <p className="mt-1 flex-1 text-xs text-ink-soft">{s.description}</p>

                        <p className="mt-4 text-sm font-bold text-ink">
                            <span className="text-gold-dark">{peso(s.price)}</span>{' '}
                            <span className="text-xs font-normal text-ink-soft">
                                {s.pricingType === 'fixed' ? 'fixed price' : `per ${s.unitType}`}
                            </span>
                        </p>

                        <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-4">
                            {s.isBaseFee ? (
                                <Pill tone="cream">Included automatically</Pill>
                            ) : (
                                <Pill tone={s.active ? 'green' : 'gray'}>{s.active ? 'Active' : 'Inactive'}</Pill>
                            )}
                            <IconButton label="Edit service" tone="gold" onClick={() => openEdit(s)}>
                                <Pencil className="size-4" />
                            </IconButton>
                        </div>
                    </Panel>
                ))}
            </div>

            {services.length === 0 && (
                <Panel className="p-8 text-center text-sm text-ink-soft">
                    No services yet. Use the + button to add the first one.
                </Panel>
            )}

            {/* Pagination */}
            {services.length > 0 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-ink-soft">
                        Showing {start + 1}–{Math.min(start + PAGE_SIZE, services.length)} of {services.length}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            aria-label="Previous page"
                            disabled={current === 1}
                            onClick={() => setPage(current - 1)}
                            className="rounded border border-black/15 bg-white p-1.5 disabled:opacity-40"
                        >
                            <ChevronLeft className="size-4" />
                        </button>
                        {Array.from({ length: pages }).map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Page ${i + 1}`}
                                onClick={() => setPage(i + 1)}
                                className={cx(
                                    'size-8 rounded border text-xs font-bold',
                                    current === i + 1 ? 'border-gold bg-gold text-white' : 'border-black/15 bg-white',
                                )}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            type="button"
                            aria-label="Next page"
                            disabled={current === pages}
                            onClick={() => setPage(current + 1)}
                            className="rounded border border-black/15 bg-white p-1.5 disabled:opacity-40"
                        >
                            <ChevronRight className="size-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Add / edit modal. Editing the Event Styling fee (BASE_FEE_ID) locks its
                name, category, pricing type and availability — only its price and
                description can change, so it can never be duplicated, renamed, priced
                per-unit, or turned off. */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingId === BASE_FEE_ID ? 'Edit Event Styling Fee' : editingId === null ? 'Add Service' : 'Edit Service'}</DialogTitle>
                        <DialogDescription>
                            {editingId === BASE_FEE_ID
                                ? 'This flat fee is automatically included with every Event Styling request.'
                                : 'Fill in the details for a new or existing add-on service.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Service name" htmlFor="svc-name" required error={errors.name}>
                            <input
                                id="svc-name"
                                className={inputClass}
                                disabled={editingId === BASE_FEE_ID}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </Field>

                        <Field label="Category" htmlFor="svc-category" required>
                            {editingId === BASE_FEE_ID ? (
                                <input id="svc-category" className={inputClass} disabled value="Styling" />
                            ) : (
                                <select
                                    id="svc-category"
                                    className={selectClass}
                                    value={form.category}
                                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                                >
                                    {CATEGORIES.map((c) => (
                                        <option key={c}>{c}</option>
                                    ))}
                                </select>
                            )}
                        </Field>

                        <Field label="Description" htmlFor="svc-desc" required error={errors.description} className="sm:col-span-2">
                            <textarea
                                id="svc-desc"
                                className={textareaClass}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                            />
                        </Field>

                        {editingId === BASE_FEE_ID ? (
                            <div className="sm:col-span-2">
                                <span className="text-sm text-ink">Pricing type</span>
                                <p className="mt-1.5 text-xs text-ink-soft">Fixed price only — the styling fee is not billed per unit.</p>
                            </div>
                        ) : (
                            <>
                                {/* Pricing type */}
                                <div className="grid gap-1.5 sm:col-span-2">
                                    <span className="text-sm text-ink">
                                        Pricing type <span className="text-red-600">*</span>
                                    </span>
                                    <div className="inline-flex w-fit gap-1 rounded-lg border border-black/10 bg-neutral-200/60 p-1">
                                        {(['fixed', 'per_unit'] as const).map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setForm({ ...form, pricingType: t })}
                                                className={cx(
                                                    'rounded-md border px-4 py-1.5 text-sm font-bold transition',
                                                    form.pricingType === t
                                                        ? 'border-black/10 bg-white text-gold-dark'
                                                        : 'border-transparent text-ink-soft',
                                                )}
                                            >
                                                {t === 'fixed' ? 'Fixed price' : 'Per unit'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {form.pricingType === 'per_unit' && (
                                    <Field label="Unit type" htmlFor="svc-unit" required error={errors.unitType}>
                                        <select
                                            id="svc-unit"
                                            className={selectClass}
                                            value={form.unitType}
                                            onChange={(e) => setForm({ ...form, unitType: e.target.value })}
                                        >
                                            <option value="" />
                                            {UNIT_TYPES.map((u) => (
                                                <option key={u}>{u}</option>
                                            ))}
                                        </select>
                                    </Field>
                                )}
                            </>
                        )}

                        <Field
                            label={form.pricingType === 'fixed' ? 'Price (₱)' : 'Price per unit (₱)'}
                            htmlFor="svc-price"
                            required
                            error={errors.price}
                        >
                            <input
                                id="svc-price"
                                type="number"
                                min="0"
                                className={inputClass}
                                value={form.price}
                                onChange={(e) => setForm({ ...form, price: e.target.value })}
                            />
                        </Field>

                        {editingId !== BASE_FEE_ID && (
                            <div className="flex items-center gap-3 sm:col-span-2">
                                <span className="text-sm text-ink">Availability</span>
                                <Switch checked={form.active} label="Availability" onChange={(v) => setForm({ ...form, active: v })} />
                                <span className={cx('text-xs font-semibold', form.active ? 'text-green-700' : 'text-ink-soft')}>
                                    {form.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        )}
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
