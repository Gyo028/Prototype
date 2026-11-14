import { router } from '@inertiajs/react';
import { Gavel, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field, GoldButton, Pill, cx, inputClass, textareaClass } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import { Detail, Section, formatDateTime, peso } from '@/components/project-manager/request-details';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { DISPUTE_DECISIONS } from '@/data/project-manager/payments';
import type { BillingDispute, DisputeDecision, DisputeStatus } from '@/data/project-manager/payments';

/*
 * Backlog #31: review and resolve billing disputes.
 * Shown in step 7 (Payments) of the project wizard ("Manage Payments" use case).
 *   - Start Review sets the status to "Reviewed". Resolving records the decision (Upheld, Rejected
 *     or Adjusted) and the resolved date; Adjusted updates the billing amount (acceptance criterion 1).
 *   - The customer is notified once the resolution is recorded (acceptance criterion 2).
 *   - Without a decision, the dispute cannot be marked as resolved (acceptance criterion 3).
 */

const statusTone: Record<DisputeStatus, PillTone> = {
    Submitted: 'yellow',
    Reviewed: 'blue',
    Resolved: 'green',
};

const DECISION_HELP: Record<DisputeDecision, string> = {
    Upheld: 'The dispute is accepted. The bill amount stays the same.',
    Rejected: 'The dispute is not accepted. The bill stays as it is.',
    Adjusted: 'The bill amount is changed. Enter the new amount.',
};

type Errors = { decision?: string; newAmount?: string };

/** One dispute: its details, then Start Review, then the resolution form. */
function DisputeCard({ dispute, ...props }: StepProps & { dispute: BillingDispute }) {
    const { project, usingSample, managerName, onSaved } = props;
    const billing = project.billings.find((b) => b.id === dispute.billingId);

    const [decision, setDecision] = useState<DisputeDecision | ''>('');
    const [newAmount, setNewAmount] = useState('');
    const [remarks, setRemarks] = useState('');
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);

    const updateDispute = (changes: Partial<BillingDispute>, amount?: number) =>
        onSaved({
            ...project,
            disputes: project.disputes.map((d) => (d.id === dispute.id ? { ...d, ...changes } : d)),
            billings:
                amount === undefined ? project.billings : project.billings.map((b) => (b.id === dispute.billingId ? { ...b, amount } : b)),
        });

    // Acceptance criterion 1: the status becomes "Reviewed" when the review starts.
    const startReview = () => {
        if (usingSample) {
            updateDispute({ status: 'Reviewed', reviewedAt: new Date().toISOString() });
            return;
        }
        router.patch(`${PROJECTS_URL}/${project.id}/disputes/${dispute.id}/review`, {}, { preserveScroll: true });
    };

    const resolve = () => {
        // Acceptance criterion 3: no decision, no resolution.
        const e: Errors = {};
        if (!decision) e.decision = 'Select a resolution decision before marking the dispute as resolved.';
        if (decision === 'Adjusted' && (newAmount.trim() === '' || !(Number(newAmount) >= 0))) e.newAmount = 'Enter the adjusted bill amount.';
        setErrors(e);
        if (Object.keys(e).length || !decision || !billing) return;

        const previousAmount = billing.amount;
        const amount = decision === 'Adjusted' ? Number(newAmount) : previousAmount;
        const text = remarks.trim() || null;

        // Acceptance criterion 2: the customer is notified once the resolution is recorded.
        const finish = () =>
            toast.success(
                decision === 'Adjusted'
                    ? `${dispute.code} resolved. The ${billing.type} was adjusted from ${peso(previousAmount)} to ${peso(amount)} and the customer was notified.`
                    : `${dispute.code} resolved (${decision}). The customer was notified of the resolution.`,
            );

        // Acceptance criterion 1: decision + resolved date recorded; Adjusted updates the billing amount.
        if (usingSample) {
            updateDispute(
                {
                    status: 'Resolved',
                    resolution: {
                        decision,
                        remarks: text,
                        previousAmount,
                        newAmount: amount,
                        resolvedBy: managerName,
                        resolvedAt: new Date().toISOString(),
                    },
                },
                decision === 'Adjusted' ? amount : undefined,
            );
            finish();
            return;
        }

        router.patch(
            `${PROJECTS_URL}/${project.id}/disputes/${dispute.id}/resolve`,
            { decision, newAmount: decision === 'Adjusted' ? amount : null, remarks: text },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: finish,
                onError: (err) => setErrors(err as Errors),
            },
        );
    };

        return (
        <div className="grid gap-4 rounded-xl border border-black/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-ink">
                    <b>
                        {dispute.code} · {billing?.type ?? 'Billing'}
                    </b>{' '}
                    · submitted {formatDateTime(dispute.submittedAt)}
                </p>
                <Pill tone={statusTone[dispute.status]}>{dispute.status}</Pill>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <Detail label="Disputed bill">{billing ? `${billing.type} · ${peso(dispute.resolution?.previousAmount ?? billing.amount)}` : '—'}</Detail>
                <div className="sm:col-span-2">
                    <Detail label="Customer's reason">{dispute.reason}</Detail>
                </div>
            </div>

            {dispute.reviewedAt && <p className="text-xs text-ink-soft">Review started {formatDateTime(dispute.reviewedAt)}</p>}

            {/* Submitted: start the review */}
            {dispute.status === 'Submitted' && (
                <div className="flex justify-end">
                    <GoldButton onClick={startReview}>
                        <Search className="size-4" /> Start Review
                    </GoldButton>
                </div>
            )}

            {/* Reviewed: record the resolution */}
            {dispute.status === 'Reviewed' && (
                <form
                    noValidate
                    className="grid gap-4 rounded-xl border border-gold/40 bg-gold/5 p-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        resolve();
                    }}
                >
                    <div className="grid gap-1.5">
                        <p className="text-sm text-ink">
                            Resolution decision<span className="text-red-600"> *</span>
                        </p>
                        <div role="radiogroup" aria-label="Resolution decision" className="flex flex-wrap gap-2">
                            {DISPUTE_DECISIONS.map((d) => (
                                <button
                                    key={d}
                                    type="button"
                                    role="radio"
                                    aria-checked={decision === d}
                                    onClick={() => {
                                        setDecision(d);
                                        setErrors({});
                                    }}
                                    className={cx(
                                        'rounded-lg border px-4 py-2 text-sm font-semibold transition',
                                        decision === d
                                            ? 'border-gold bg-gold text-white'
                                            : cx('bg-white text-ink hover:bg-gold/10', errors.decision ? 'border-red-500' : 'border-black/15'),
                                    )}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                        {decision && <p className="text-xs text-ink-soft">{DECISION_HELP[decision]}</p>}
                        {errors.decision && <p className="text-xs text-red-600">{errors.decision}</p>}
                    </div>

                    {decision === 'Adjusted' && (
                        <Field label={`New bill amount (₱), currently ${peso(billing?.amount ?? 0)}`} htmlFor={`dsp-amount-${dispute.id}`} required error={errors.newAmount}>
                            <input
                                id={`dsp-amount-${dispute.id}`}
                                type="number"
                                min={0}
                                step="0.01"
                                value={newAmount}
                                onChange={(e) => {
                                    setNewAmount(e.target.value);
                                    if (errors.newAmount) setErrors((x) => ({ ...x, newAmount: undefined }));
                                }}
                                placeholder="e.g. 100000"
                                className={cx(inputClass, errors.newAmount && 'border-red-500')}
                            />
                        </Field>
                    )}

                    <Field label="Remarks to the customer (optional)" htmlFor={`dsp-remarks-${dispute.id}`}>
                        <textarea
                            id={`dsp-remarks-${dispute.id}`}
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="e.g. The photo booth was removed, so the final payment was reduced."
                            className={textareaClass}
                        />
                    </Field>

                    {(errors.decision || errors.newAmount) && (
                        <p role="alert" className="text-sm font-semibold text-red-700">
                            The dispute was not marked as resolved.
                        </p>
                    )}

                    <div className="flex justify-end">
                        <GoldButton type="submit" disabled={saving}>
                            <Gavel className="size-4" /> {saving ? 'Saving...' : 'Mark as Resolved'}
                        </GoldButton>
                    </div>
                </form>
            )}

            {/* Resolved: the recorded resolution */}
            {dispute.resolution && (
                <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm">
                    <p className="font-bold text-ink">
                        Resolved: {dispute.resolution.decision} · by {dispute.resolution.resolvedBy} on {formatDateTime(dispute.resolution.resolvedAt)}
                    </p>
                    {dispute.resolution.decision === 'Adjusted' && (
                        <p className="mt-1 text-ink">
                            Bill adjusted from {peso(dispute.resolution.previousAmount)} to <b>{peso(dispute.resolution.newAmount)}</b>.
                        </p>
                    )}
                    <p className="mt-1 text-ink-soft">{dispute.resolution.remarks ? `Remarks: ${dispute.resolution.remarks}` : 'No remarks.'}</p>
                    <p className="mt-1 text-xs text-ink-soft">The customer was notified of the resolution.</p>
                </div>
            )}
        </div>
    );
}

/** All billing disputes of the project, open ones first. */
export default function BillingDisputes(props: StepProps) {
    const disputes = [...props.project.disputes].sort(
        (a, b) => Number(a.status === 'Resolved') - Number(b.status === 'Resolved') || b.submittedAt.localeCompare(a.submittedAt),
    );

    if (disputes.length === 0) return null;

    return (
        <Section title="Billing Disputes">
            <div className="grid gap-4">
                {disputes.map((d) => (
                    <DisputeCard key={d.id} {...props} dispute={d} />
                ))}
            </div>
        </Section>
    );
}