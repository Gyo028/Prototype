import { router } from '@inertiajs/react';
import { AlertTriangle, Check, ExternalLink, FileText, ImageIcon, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DangerButton, Field, GoldButton, OutlineButton, Pill, cx, textareaClass } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import { Detail, formatDate, formatDateTime, peso } from '@/components/project-manager/request-details';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { RECEIPT_CHECKLIST, receiptIsValid, receiptProblem } from '@/data/project-manager/payments';
import type { Payment, PaymentStatus, ReceiptCheckId } from '@/data/project-manager/payments';

/*
 * Backlog #27: verify or reject one payment the customer submitted.
 * Used by step 2 (Reservation Fee) and step 7 (Payments) of the project wizard.
 *   - Verify is blocked when the receipt is missing or invalid (acceptance criterion 2).
 *   - Reject cannot be sent without remarks (acceptance criterion 3).
 *   - The decision and status are saved on the project's payment record (acceptance criterion 1).
 */

type Decision = 'verify' | 'reject';

export const paymentTone: Record<PaymentStatus, PillTone> = {
    'For Verification': 'yellow',
    Verified: 'green',
    Rejected: 'red',
};

/** The payment's details and its receipt link. */
function PaymentDetails({ payment: p }: { payment: Payment }) {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-3">
                <Detail label="Amount">{peso(p.amount)}</Detail>
                <Detail label="Method">{p.method}</Detail>
                <Detail label="Date paid">{formatDate(p.paidOn)}</Detail>
                <Detail label="Reference no.">{p.referenceNo}</Detail>
            </div>
            <div>
                <p className="mb-1 text-xs text-ink-soft">Payment receipt</p>
                {p.receipt ? (
                    <a
                        href={p.receipt.url || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className={cx(
                            'flex items-center gap-3 rounded-lg border p-3 transition hover:bg-gold/10',
                            receiptIsValid(p.receipt) ? 'border-black/15 hover:border-gold' : 'border-red-300',
                        )}
                    >
                        {p.receipt.name.toLowerCase().endsWith('.pdf') ? (
                            <FileText className="size-6 shrink-0 text-red-600" />
                        ) : (
                            <ImageIcon className="size-6 shrink-0 text-sky-600" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{p.receipt.name}</span>
                        <span className="flex items-center gap-1 text-xs font-semibold text-gold-dark">
                            Open <ExternalLink className="size-3.5" />
                        </span>
                    </a>
                ) : (
                    <p className="rounded-lg border border-dashed border-red-300 p-3 text-sm text-red-700">No receipt uploaded.</p>
                )}
            </div>
        </div>
    );
}

type ReviewProps = StepProps & { payment: Payment };

/** A payment waiting for verification, with the Verify / Reject controls. */
export function PaymentReview({ project, payment, usingSample, managerName, onSaved }: ReviewProps) {
    const [checked, setChecked] = useState<ReceiptCheckId[]>([]);
    const [decision, setDecision] = useState<Decision | null>(null);
    const [remarks, setRemarks] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const problem = receiptProblem(payment);
    const allChecked = checked.length === RECEIPT_CHECKLIST.length;
    const canVerify = problem === null && allChecked;

    const startDecision = (d: Decision) => {
        // Acceptance criterion 2: a missing or invalid receipt cannot be verified.
        if (d === 'verify' && !canVerify) return;
        setDecision(d);
        setRemarks('');
        setError('');
    };

    const submit = () => {
        if (!decision) return;
        const text = remarks.trim();

        if (decision === 'verify' && !canVerify) {
            setError(problem ?? 'Confirm every item on the receipt checklist first.');
            return;
        }
        // Acceptance criterion 3: a rejection without remarks is never sent.
        if (decision === 'reject' && !text) {
            setError('Remarks are required when rejecting a payment. Tell the customer what is wrong.');
            return;
        }

        const finish = () => {
            toast.success(
                decision === 'verify'
                    ? payment.type === 'Reservation Fee'
                        ? `${payment.code} verified. The customer has been notified to book the ocular visit.`
                        : `${payment.code} verified. The customer's balance has been updated and a payment confirmation was sent.`
                    : `${payment.code} rejected. The customer has been asked to submit the payment again.`,
            );
        };

        // Acceptance criterion 1: the decision and status are saved and the payment record is updated.
        if (usingSample) {
            const payments = project.payments.map((p) =>
                p.id === payment.id
                    ? {
                          ...p,
                          status: decision === 'verify' ? ('Verified' as const) : ('Rejected' as const),
                          review: { remarks: text || null, reviewedBy: managerName, reviewedAt: new Date().toISOString() },
                      }
                    : p,
            );
            const feePaid = decision === 'verify' && payment.type === 'Reservation Fee';
            onSaved({ ...project, payments, reservationFee: { ...project.reservationFee, paid: project.reservationFee.paid || feePaid } });
            finish();
            return;
        }

        router.patch(
            `${PROJECTS_URL}/${project.id}/payments/${payment.id}/${decision}`,
            { remarks: text || null },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: finish,
                onError: (errors) => setError(errors.remarks ?? errors.receipt ?? 'The decision could not be saved. Please try again.'),
            },
        );
    };

    return (
        <div className="grid gap-4 rounded-xl border border-black/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-ink">
                    <b>
                        {payment.code} · {payment.type}
                    </b>{' '}
                    · submitted {formatDateTime(payment.submittedAt)}
                </p>
                <Pill tone={paymentTone[payment.status]}>{payment.status}</Pill>
            </div>

            <PaymentDetails payment={payment} />

            {problem ? (
                <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                    <p>
                        <b>This payment cannot be verified.</b> {problem} You can reject it and ask the customer to upload a valid receipt.
                    </p>
                </div>
            ) : (
                <div>
                    <p className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">Receipt checklist</p>
                    <div className="grid gap-2">
                        {RECEIPT_CHECKLIST.map((item) => (
                            <label
                                key={item.id}
                                className={cx(
                                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm text-ink transition',
                                    checked.includes(item.id) ? 'border-gold bg-gold/10' : 'border-black/10 hover:bg-gold/5',
                                )}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked.includes(item.id)}
                                    onChange={() =>
                                        setChecked((list) => (list.includes(item.id) ? list.filter((x) => x !== item.id) : [...list, item.id]))
                                    }
                                    className="mt-0.5 size-4 accent-[#C9A013]"
                                />
                                {item.label}
                            </label>
                        ))}
                    </div>
                    <p className="mt-2 text-xs text-ink-soft">
                        {allChecked ? 'Receipt checked. The payment can be verified.' : 'Open the receipt and tick both items to enable Verify.'}
                    </p>
                </div>
            )}

            {decision === null ? (
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <DangerButton onClick={() => startDecision('reject')}>
                        <X className="size-4" /> Reject
                    </DangerButton>
                    <GoldButton
                        onClick={() => startDecision('verify')}
                        disabled={!canVerify}
                        title={problem ?? (allChecked ? undefined : 'Tick both checklist items first')}
                    >
                        <Check className="size-4" /> Verify Payment
                    </GoldButton>
                </div>
            ) : (
                <form
                    className="space-y-4 rounded-xl border border-gold/40 bg-gold/5 p-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                >
                    {decision === 'verify' && (
                        <p className="text-sm text-ink">
                            Verify <b>{peso(payment.amount)}</b> from {project.customer.name}?
                            {payment.type === 'Reservation Fee'
                                ? ' The customer will be notified to book the ocular visit.'
                                : " The customer's balance will be updated."}
                        </p>
                    )}
                    <Field
                        label={decision === 'reject' ? 'Reason for rejection' : 'Remarks (optional)'}
                        htmlFor={`payment-remarks-${payment.id}`}
                        required={decision === 'reject'}
                        error={error}
                    >
                        <textarea
                            id={`payment-remarks-${payment.id}`}
                            autoFocus
                            value={remarks}
                            onChange={(e) => {
                                setRemarks(e.target.value);
                                if (error) setError('');
                            }}
                            placeholder={
                                decision === 'reject'
                                    ? 'e.g. The receipt shows a different amount. Please upload the correct receipt.'
                                    : 'e.g. Payment received in full.'
                            }
                            className={cx(textareaClass, error && 'border-red-500')}
                        />
                    </Field>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <OutlineButton onClick={() => setDecision(null)} disabled={saving}>
                            Back
                        </OutlineButton>
                        {decision === 'reject' ? (
                            <DangerButton type="submit" disabled={saving}>
                                {saving ? 'Rejecting...' : 'Confirm Rejection'}
                            </DangerButton>
                        ) : (
                            <GoldButton type="submit" disabled={saving}>
                                {saving ? 'Verifying...' : 'Confirm Verification'}
                            </GoldButton>
                        )}
                    </div>
                </form>
            )}
        </div>
    );
}

/** Payments already decided (verified or rejected), newest first. */
export function PaymentHistory({ payments }: { payments: Payment[] }) {
    const decided = payments.filter((p) => p.status !== 'For Verification').sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

    if (decided.length === 0) return <p className="text-sm text-ink-soft">No verified or rejected payments yet.</p>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-ink-soft uppercase">
                    <tr>
                        <th className="pb-2 pr-4 font-medium">Payment No.</th>
                        <th className="pb-2 pr-4 font-medium">Type</th>
                        <th className="pb-2 pr-4 font-medium">Amount</th>
                        <th className="pb-2 pr-4 font-medium">Reviewed</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                    {decided.map((p) => (
                        <tr key={p.id} className="align-top">
                            <td className="py-2 pr-4 font-semibold text-ink">{p.code}</td>
                            <td className="py-2 pr-4 text-ink">{p.type}</td>
                            <td className="py-2 pr-4 text-ink">{peso(p.amount)}</td>
                            <td className="py-2 text-ink-soft">
                                {p.review ? `${p.review.reviewedBy}, ${formatDateTime(p.review.reviewedAt)}` : '—'}
                                {p.review?.remarks && <span className="block text-xs">Remarks: {p.review.remarks}</span>}
                            </td>
                            <td className="py-2">
                                <Pill tone={paymentTone[p.status]}>{p.status}</Pill>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}