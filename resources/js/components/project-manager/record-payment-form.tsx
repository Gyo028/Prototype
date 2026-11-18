import { router } from '@inertiajs/react';
import { Banknote } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field, GoldButton, OutlineButton, cx, inputClass, selectClass } from '@/components/dashboard/ui';
import { peso } from '@/components/project-manager/request-details';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { RECORDED_METHODS, verifiedTotal } from '@/data/project-manager/payments';
import type { Payment, PaymentType, RecordedMethod } from '@/data/project-manager/payments';
import { getSampleProjects } from '@/data/project-manager/projects';

/*
 * Backlog #28: record a cash or cheque payment the customer paid in person.
 * Used by step 2 (Reservation Fee) and step 7 (Payments) of the project wizard.
 *   - Amount, method, date and (for cheques) the cheque number are saved as verified,
 *     the customer's balance is updated and a payment confirmation is sent (acceptance criterion 1).
 *   - If any required detail is missing, nothing is saved (acceptance criterion 2).
 */

/** What the payment can be for: the reservation fee (billingId null) or one of the billings. */
export type PaymentTarget = { billingId: number | null; type: PaymentType; balance: number };

type Values = { target: string; method: RecordedMethod | ''; amount: string; paidOn: string; chequeNo: string };
type Errors = Partial<Record<keyof Values, string>>;

const today = () => new Date().toISOString().slice(0, 10);

function validate(v: Values): Errors {
    const e: Errors = {};
    if (v.target === '') e.target = 'Select what the payment is for.';
    if (!v.method) e.method = 'Select the payment method.';
    if (!(Number(v.amount) > 0)) e.amount = 'Enter the amount received.';
    if (!v.paidOn) e.paidOn = 'Enter the date the payment was received.';
    else if (v.paidOn > today()) e.paidOn = 'The payment date cannot be in the future.';
    if (v.method === 'Cheque' && !v.chequeNo.trim()) e.chequeNo = 'Enter the cheque number.';
    return e;
}

type Props = StepProps & { targets: PaymentTarget[] };

export default function RecordPaymentForm({ project, usingSample, managerName, onSaved, targets }: Props) {
    const [open, setOpen] = useState(false);
    const empty: Values = { target: targets.length === 1 ? '0' : '', method: '', amount: '', paidOn: '', chequeNo: '' };
    const [values, setValues] = useState<Values>(empty);
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);

    if (targets.length === 0) return null;

    const set = <K extends keyof Values>(key: K, value: Values[K]) => {
        setValues((v) => ({ ...v, [key]: value }));
        if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    };

    const close = () => {
        setOpen(false);
        setValues(empty);
        setErrors({});
    };

    const save = () => {
        // Acceptance criterion 2: any missing detail means nothing is saved.
        const e = validate(values);
        setErrors(e);
        if (Object.keys(e).length) return;

        const target = targets[Number(values.target)];
        const amount = Number(values.amount);
        const method = values.method as RecordedMethod;
        const chequeNo = method === 'Cheque' ? values.chequeNo.trim() : null;

        const finish = () => {
            toast.success(
                `${peso(amount)} ${method.toLowerCase()} payment recorded as verified. The customer's balance has been updated and a payment confirmation was sent.`,
            );
            close();
        };

        // Acceptance criterion 1: saved as verified, balance updated.
        if (usingSample) {
            const now = new Date().toISOString();
            const id = Math.max(0, ...getSampleProjects().flatMap((x) => x.payments.map((p) => p.id))) + 1;
            const payment: Payment = {
                id,
                code: `PAY-${String(id).padStart(4, '0')}`,
                billingId: target.billingId,
                type: target.type,
                amount,
                method,
                referenceNo: chequeNo ? `Cheque ${chequeNo}` : 'Cash',
                paidOn: values.paidOn,
                receipt: null,
                chequeNo,
                submittedAt: now,
                status: 'Verified',
                review: { remarks: null, reviewedBy: managerName, reviewedAt: now },
            };
            const payments = [...project.payments, payment];
            const feePaid = project.reservationFee.paid || verifiedTotal(null, payments) >= project.reservationFee.amount;
            onSaved({ ...project, payments, reservationFee: { ...project.reservationFee, paid: feePaid } });
            finish();
            return;
        }

        router.post(
            `${PROJECTS_URL}/${project.id}/payments`,
            { billingId: target.billingId, type: target.type, method, amount, paidOn: values.paidOn, chequeNo },
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
                <p className="text-sm text-ink-soft">Did the customer pay in cash or by cheque? Record it here.</p>
                <OutlineButton onClick={() => setOpen(true)}>
                    <Banknote className="size-4" /> Record Cash / Cheque Payment
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
            <p className="text-sm font-bold text-ink">Record Cash / Cheque Payment</p>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Payment for" htmlFor="rp-target" required error={errors.target}>
                    <select
                        id="rp-target"
                        value={values.target}
                        onChange={(e) => set('target', e.target.value)}
                        className={cx(selectClass, errors.target && 'border-red-500')}
                    >
                        <option value="">Select...</option>
                        {targets.map((t, i) => (
                            <option key={i} value={String(i)}>
                                {t.type} (balance {peso(t.balance)})
                            </option>
                        ))}
                    </select>
                </Field>

                <div className="grid gap-1.5">
                    <p className="text-sm text-ink">
                        Payment method<span className="text-red-600"> *</span>
                    </p>
                    <div role="radiogroup" aria-label="Payment method" className="flex gap-2">
                        {RECORDED_METHODS.map((m) => (
                            <button
                                key={m}
                                type="button"
                                role="radio"
                                aria-checked={values.method === m}
                                onClick={() => set('method', m)}
                                className={cx(
                                    'rounded-lg border px-4 py-2 text-sm font-semibold transition',
                                    values.method === m
                                        ? 'border-gold bg-gold text-white'
                                        : cx('bg-white text-ink hover:bg-gold/10', errors.method ? 'border-red-500' : 'border-black/15'),
                                )}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    {errors.method && <p className="text-xs text-red-600">{errors.method}</p>}
                </div>

                <Field label="Amount received (₱)" htmlFor="rp-amount" required error={errors.amount}>
                    <input
                        id="rp-amount"
                        type="number"
                        min={0}
                        step="0.01"
                        value={values.amount}
                        onChange={(e) => set('amount', e.target.value)}
                        placeholder="e.g. 10000"
                        className={cx(inputClass, errors.amount && 'border-red-500')}
                    />
                </Field>

                <Field label="Payment date" htmlFor="rp-date" required error={errors.paidOn}>
                    <input
                        id="rp-date"
                        type="date"
                        max={today()}
                        value={values.paidOn}
                        onChange={(e) => set('paidOn', e.target.value)}
                        className={cx(inputClass, errors.paidOn && 'border-red-500')}
                    />
                </Field>

                {values.method === 'Cheque' && (
                    <Field label="Cheque number" htmlFor="rp-cheque" required error={errors.chequeNo}>
                        <input
                            id="rp-cheque"
                            value={values.chequeNo}
                            onChange={(e) => set('chequeNo', e.target.value)}
                            placeholder="e.g. 0012345"
                            className={cx(inputClass, errors.chequeNo && 'border-red-500')}
                        />
                    </Field>
                )}
            </div>

            {Object.values(errors).some(Boolean) && (
                <p role="alert" className="text-sm font-semibold text-red-700">
                    The payment was not saved. Fill in every required detail.
                </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <OutlineButton onClick={close} disabled={saving}>
                    Cancel
                </OutlineButton>
                <GoldButton type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save as Verified'}
                </GoldButton>
            </div>
        </form>
    );
}