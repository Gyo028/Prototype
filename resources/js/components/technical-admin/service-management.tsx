import { router } from '@inertiajs/react';
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
 * Service configuration. Each service is a row of
 * `services`: service_name, service_category, description, pricing_type
 * ('fixed' | 'per_unit'), unit_type, price and status (active / inactive).
 * The data comes from ServicesAssetsController and is saved by ServiceController.
 *
 * The Event Styling fee (isBaseFee) is automatically included with every
 * Event Styling request. Only its description and price can change; the
 * server enforces this too.
 *
 * Services are switched on or off rather than deleted, because requests and
 * quotations refer to them.
 */

const SERVICES_URL = '/technical-admin/services-assets/services';
const PAGE_SIZE = 6;

type PricingType = 'fixed' | 'per_unit';

export type Service = {
    id: number;
    name: string;
    category: string;
    description: string;
    pricingType: PricingType;
    unitType: string;
    price: number;
    active: boolean;
    /** The automatic Event Styling fee: locked identity fields, always included. */
    isBaseFee: boolean;
};

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

type Props = {
    services: Service[];
    categories: string[];
    unitTypes: string[];
};

export default function ServiceManagement({ services, categories, unitTypes }: Props) {
    const emptyForm: Form = {
        name: '',
        category: categories[0] ?? '',
        description: '',
        pricingType: 'fixed',
        unitType: '',
        price: '',
        active: true,
    };

    const [page, setPage] = useState(1);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Service | null>(null);
    const [form, setForm] = useState<Form>(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    // Editing the Event Styling fee locks everything except description and price.
    const editingBaseFee = editing?.isBaseFee ?? false;

    const pages = Math.max(1, Math.ceil(services.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const start = (current - 1) * PAGE_SIZE;
    const visible = services.slice(start, start + PAGE_SIZE);
    const activeCount = services.filter((s) => s.active).length;

    const openAdd = () => {
        setEditing(null);
        setForm(emptyForm);
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (s: Service) => {
        setEditing(s);
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

        const data = { ...form, unitType: form.pricingType === 'per_unit' ? form.unitType : '' };
        const options = {
            preserveScroll: true,
            preserveState: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onSuccess: () => {
                setDialogOpen(false);
                if (editing === null) setPage(Number.MAX_SAFE_INTEGER); // jump to the new service (last page)
            },
            onError: (serverErrors: Record<string, string>) => setErrors(serverErrors),
        };

        if (editing === null) router.post(SERVICES_URL, data, options);
        else router.patch(`${SERVICES_URL}/${editing.id}`, data, options);
    };

    const toggle = (id: number, active: boolean) =>
        router.patch(`${SERVICES_URL}/${id}/status`, { active }, { preserveScroll: true, preserveState: true });

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

            {/* Add / edit modal. Editing the Event Styling fee locks its
                name, category, pricing type and availability — only its price and
                description can change, so it can never be duplicated, renamed, priced
                per-unit, or turned off. */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingBaseFee ? 'Edit Event Styling Fee' : editing === null ? 'Add Service' : 'Edit Service'}</DialogTitle>
                        <DialogDescription>
                            {editingBaseFee
                                ? 'This flat fee is automatically included with every Event Styling request.'
                                : 'Fill in the details for a new or existing add-on service.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Service name" htmlFor="svc-name" required error={errors.name}>
                            <input
                                id="svc-name"
                                className={inputClass}
                                disabled={editingBaseFee}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </Field>

                        <Field label="Category" htmlFor="svc-category" required error={errors.category}>
                            {editingBaseFee ? (
                                <input id="svc-category" className={inputClass} disabled value="Styling" />
                            ) : (
                                <select
                                    id="svc-category"
                                    className={selectClass}
                                    value={form.category}
                                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                                >
                                    {categories.map((c) => (
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

                        {editingBaseFee ? (
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
                                            {unitTypes.map((u) => (
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

                        {!editingBaseFee && (
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
                        <GoldButton onClick={save} disabled={saving}>
                            <Check className="size-4" /> Save
                        </GoldButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}