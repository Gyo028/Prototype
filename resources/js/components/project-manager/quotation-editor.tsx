import { Plus, Trash2 } from 'lucide-react';
import { OutlineButton, cx, inputClass } from '@/components/dashboard/ui';
import { peso } from '@/components/project-manager/request-details';
import { quotationSubtotal, quotationTotal } from '@/data/project-manager/projects';
import type { Project, Quotation, QuotationItem } from '@/data/project-manager/projects';

/*
 * Backlog #24: the quotation the Project Manager finalizes for the design proposal.
 * Every line needs a description, a quantity and a price before the proposal can be approved.
 */

/** Problems found in one quotation line, by field. */
export type ItemErrors = Partial<Record<'description' | 'quantity' | 'unitPrice', string>>;

export type QuotationErrors = {
    items: Record<string, ItemErrors>; // keyed by the line's id
    discount?: string;
    general?: string; // e.g. "Add at least one line"
};

const newId = () => `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Starts the quotation from the customer's request: each selected service (per-guest services
 * use the guest count) and each layout asset the designer used. Assets have no preset price,
 * so their price starts empty and must be filled in.
 */
export function initialQuotation(project: Project): Quotation {
    if (project.designProposal?.quotation) return project.designProposal.quotation;

    const services: QuotationItem[] = project.services.map((s) => ({
        id: `service-${s.id}`,
        description: s.unit === 'pax' ? `${s.name} (per guest)` : s.name,
        quantity: s.unit === 'pax' ? (project.guests ?? 1) : 1,
        unitPrice: s.price,
    }));

    const assets: QuotationItem[] = project.assets.map((a) => ({
        id: `asset-${a.id}`,
        description: `${a.name} (layout asset)`,
        quantity: 1,
        unitPrice: 0,
    }));

    return { items: [...services, ...assets], discount: 0 };
}

/** Acceptance criterion 3: finds missing or invalid pricing information. Empty result = complete. */
export function validateQuotation(q: Quotation): QuotationErrors {
    const errors: QuotationErrors = { items: {} };

    if (q.items.length === 0) errors.general = 'Add at least one line to the quotation.';

    q.items.forEach((item) => {
        const e: ItemErrors = {};
        if (!item.description.trim()) e.description = 'Describe this line.';
        if (!Number.isInteger(item.quantity) || item.quantity < 1) e.quantity = 'At least 1.';
        if (!(item.unitPrice > 0)) e.unitPrice = 'Enter a price.';
        if (Object.keys(e).length) errors.items[item.id] = e;
    });

    if (q.discount < 0) errors.discount = 'The discount cannot be negative.';
    else if (q.items.length > 0 && q.discount >= quotationSubtotal(q)) errors.discount = 'The discount must be less than the subtotal.';

    return errors;
}

export const hasQuotationErrors = (e: QuotationErrors) => Boolean(e.general || e.discount || Object.keys(e.items).length);

/** Turns a number input's text into a number; empty or invalid text becomes 0 (and is then caught by validation). */
const toNumber = (value: string) => (value.trim() === '' || Number.isNaN(Number(value)) ? 0 : Number(value));

type Props = {
    quotation: Quotation;
    errors: QuotationErrors;
    onChange: (quotation: Quotation) => void;
};

/** Editable quotation table. */
export default function QuotationEditor({ quotation, errors, onChange }: Props) {
    const updateItem = (id: string, changes: Partial<QuotationItem>) =>
        onChange({ ...quotation, items: quotation.items.map((item) => (item.id === id ? { ...item, ...changes } : item)) });

    const removeItem = (id: string) => onChange({ ...quotation, items: quotation.items.filter((item) => item.id !== id) });

    const addItem = () =>
        onChange({ ...quotation, items: [...quotation.items, { id: newId(), description: '', quantity: 1, unitPrice: 0 }] });

    const subtotal = quotationSubtotal(quotation);

    return (
        <div className="grid gap-3">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-xs text-ink-soft uppercase">
                        <tr>
                            <th className="pb-2 font-medium">Description</th>
                            <th className="w-24 pb-2 font-medium">Qty</th>
                            <th className="w-36 pb-2 font-medium">Unit price (₱)</th>
                            <th className="w-32 pb-2 text-right font-medium">Amount</th>
                            <th className="w-10 pb-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {quotation.items.map((item) => {
                            const e = errors.items[item.id] ?? {};
                            return (
                                <tr key={item.id} className="align-top">
                                    <td className="py-1.5 pr-2">
                                        <input
                                            aria-label="Description"
                                            value={item.description}
                                            onChange={(ev) => updateItem(item.id, { description: ev.target.value })}
                                            placeholder="e.g. Fresh flower arch"
                                            className={cx(inputClass, e.description && 'border-red-500')}
                                        />
                                        {e.description && <p className="mt-1 text-xs text-red-600">{e.description}</p>}
                                    </td>
                                    <td className="py-1.5 pr-2">
                                        <input
                                            aria-label="Quantity"
                                            type="number"
                                            min={1}
                                            step={1}
                                            value={item.quantity || ''}
                                            onChange={(ev) => updateItem(item.id, { quantity: toNumber(ev.target.value) })}
                                            className={cx(inputClass, e.quantity && 'border-red-500')}
                                        />
                                        {e.quantity && <p className="mt-1 text-xs text-red-600">{e.quantity}</p>}
                                    </td>
                                    <td className="py-1.5 pr-2">
                                        <input
                                            aria-label="Unit price"
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={item.unitPrice || ''}
                                            placeholder="0"
                                            onChange={(ev) => updateItem(item.id, { unitPrice: toNumber(ev.target.value) })}
                                            className={cx(inputClass, e.unitPrice && 'border-red-500')}
                                        />
                                        {e.unitPrice && <p className="mt-1 text-xs text-red-600">{e.unitPrice}</p>}
                                    </td>
                                    <td className="py-1.5 pt-4 text-right font-semibold text-ink">{peso(item.quantity * item.unitPrice)}</td>
                                    <td className="py-1.5 pt-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => removeItem(item.id)}
                                            aria-label={`Remove ${item.description || 'this line'}`}
                                            className="rounded p-1 text-ink-soft hover:bg-black/5 hover:text-red-600"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {errors.general && <p className="text-sm text-red-600">{errors.general}</p>}

            <div>
                <OutlineButton onClick={addItem}>
                    <Plus className="size-4" /> Add Line
                </OutlineButton>
            </div>

            {/* Totals */}
            <div className="ml-auto grid w-full max-w-sm gap-2 border-t border-black/10 pt-3 text-sm">
                <div className="flex justify-between text-ink">
                    <span>Subtotal</span>
                    <span>{peso(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-ink">
                    <label htmlFor="q-discount">Discount (₱)</label>
                    <input
                        id="q-discount"
                        type="number"
                        min={0}
                        step="0.01"
                        value={quotation.discount || ''}
                        placeholder="0"
                        onChange={(ev) => onChange({ ...quotation, discount: toNumber(ev.target.value) })}
                        className={cx(inputClass, 'w-36 text-right', errors.discount && 'border-red-500')}
                    />
                </div>
                {errors.discount && <p className="text-right text-xs text-red-600">{errors.discount}</p>}
                <div className="flex justify-between border-t border-black/10 pt-2 text-base font-bold text-ink">
                    <span>Total</span>
                    <span>{peso(quotationTotal(quotation))}</span>
                </div>
            </div>
        </div>
    );
}

/** Read-only view of a finalized quotation. */
export function QuotationSummary({ quotation }: { quotation: Quotation }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
                <thead className="text-xs text-ink-soft uppercase">
                    <tr>
                        <th className="pb-2 text-left font-medium">Description</th>
                        <th className="pb-2 text-right font-medium">Qty</th>
                        <th className="pb-2 text-right font-medium">Unit price</th>
                        <th className="pb-2 text-right font-medium">Amount</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                    {quotation.items.map((item) => (
                        <tr key={item.id}>
                            <td className="py-2 text-ink">{item.description}</td>
                            <td className="py-2 text-right text-ink">{item.quantity}</td>
                            <td className="py-2 text-right text-ink">{peso(item.unitPrice)}</td>
                            <td className="py-2 text-right text-ink">{peso(item.quantity * item.unitPrice)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="text-ink">
                    <tr className="border-t-2 border-black/20">
                        <td colSpan={3} className="pt-2 text-right">
                            Subtotal
                        </td>
                        <td className="pt-2 text-right">{peso(quotationSubtotal(quotation))}</td>
                    </tr>
                    {quotation.discount > 0 && (
                        <tr>
                            <td colSpan={3} className="text-right">
                                Discount
                            </td>
                            <td className="text-right">−{peso(quotation.discount)}</td>
                        </tr>
                    )}
                    <tr>
                        <td colSpan={3} className="pt-1 text-right font-bold">
                            Total
                        </td>
                        <td className="pt-1 text-right font-bold">{peso(quotationTotal(quotation))}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
