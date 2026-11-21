import { router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field, GoldButton, OutlineButton, cx, inputClass, textareaClass } from '@/components/dashboard/ui';
import { peso } from '@/components/project-manager/request-details';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import type { Billing } from '@/data/project-manager/payments';
import { getSampleProjects } from '@/data/project-manager/projects';

/*
 * Backlog #29: record an additional charge outside the approved quotation.
 * Used by step 7 (Payments) of the project wizard ("Manage Payments" use case).
 *   - The details, amount and reason are saved, an additional charges bill is issued to the
 *     customer and the remaining balance is updated (acceptance criterion 1).
 *   - If the amount or reason is missing, nothing is saved (acceptance criterion 2).
 * The new bill is paid through the same flow as any other billing (online receipt or cash / cheque).
 */

type Values = { description: string; amount: string; reason: string };
type Errors = Partial<Record<keyof Values, string>>;

const empty: Values = { description: '', amount: '', reason: '' };

function validate(v: Values): Errors {
    const e: Errors = {};
    if (!(Number(v.amount) > 0)) e.amount = 'Enter the amount of the additional charge.';
    if (!v.reason.trim()) e.reason = 'Give the reason for the additional charge.';
    return e;
}

export default function AddChargeForm({ project, usingSample, managerName, onSaved }: StepProps) {
    const [open, setOpen] = useState(false);
    const [values, setValues] = useState<Values>(empty);
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);

    const set = (key: keyof Values, value: string) => {
        setValues((v) => ({ ...v, [key]: value }));
        if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    };

    const close = () => {
        setOpen(false);
        setValues(empty);
        setErrors({});
    };

    const save = () => {
        // Acceptance criterion 2: a missing amount or reason means nothing is saved.
        const e = validate(values);
        setErrors(e);
        if (Object.keys(e).length) return;

        const amount = Number(values.amount);
        const description = values.description.trim() || null;
        const reason = values.reason.trim();

        const finish = () => {
            toast.success(
                `Additional charge of ${peso(amount)} recorded. An additional charges bill was issued to the customer and the remaining balance was updated.`,
            );
            close();
        };

        // Acceptance criterion 1: saved, billed to the customer, balance updated.
        if (usingSample) {
            const id = Math.max(0, ...getSampleProjects().flatMap((x) => x.billings.map((b) => b.id))) + 1;
            const billing: Billing = {
                id,
                type: 'Additional Charge',
                amount,
                issuedAt: new Date().toISOString(),
                description,
                reason,
                recordedBy: managerName,
            };
            onSaved({ ...project, billings: [...project.billings, billing] });
            finish();
            return;
        }

        router.post(
            `${PROJECTS_URL}/${project.id}/additional-charges`,
            { description, amount, reason },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: finish,
                onError: (err) => setErrors(err as Errors),
            },
        );
    };

        if (!open) {
        return (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-black/15 p-4">
                <p className="text-sm text-ink-soft">Is there a cost outside the approved quotation? Bill it as an additional charge.</p>
                <OutlineButton onClick={() => setOpen(true)}>
                    <Plus className="size-4" /> Add Additional Charge
                </OutlineButton>
            </div>
        );
    }

    return (
        <form
            noValidate
            className="grid gap-4 rounded-xl border border-gold/40 bg-gold/5 p-4"
            onSubmit={(e) => {
                e.preventDefault();
                save();
            }}
        >
            <p className="text-sm font-bold text-ink">Add Additional Charge</p>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Charge details (optional)" htmlFor="ac-description">
                    <input
                        id="ac-description"
                        value={values.description}
                        onChange={(e) => set('description', e.target.value)}
                        placeholder="e.g. 20 extra chiavari chairs"
                        className={inputClass}
                    />
                </Field>

                <Field label="Amount (₱)" htmlFor="ac-amount" required error={errors.amount}>
                    <input
                        id="ac-amount"
                        type="number"
                        min={0}
                        step="0.01"
                        value={values.amount}
                        onChange={(e) => set('amount', e.target.value)}
                        placeholder="e.g. 5000"
                        className={cx(inputClass, errors.amount && 'border-red-500')}
                    />
                </Field>

                <Field label="Reason" htmlFor="ac-reason" required error={errors.reason} className="sm:col-span-2">
                    <textarea
                        id="ac-reason"
                        value={values.reason}
                        onChange={(e) => set('reason', e.target.value)}
                        placeholder="e.g. The customer added 20 guests after the quotation was approved."
                        className={cx(textareaClass, errors.reason && 'border-red-500')}
                    />
                </Field>
            </div>

            {Object.values(errors).some(Boolean) && (
                <p role="alert" className="text-sm font-semibold text-red-700">
                    The additional charge was not saved. The amount and reason are required.
                </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <OutlineButton onClick={close} disabled={saving}>
                    Cancel
                </OutlineButton>
                <GoldButton type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save and Bill Customer'}
                </GoldButton>
            </div>
        </form>
    );
}