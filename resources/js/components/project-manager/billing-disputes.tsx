import { router } from '@inertiajs/react';
import { FileText, Gavel, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field, GoldButton, Pill, cx, inputClass, textareaClass } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import { Detail, Section, formatDate, formatDateTime, peso } from '@/components/project-manager/request-details';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { DISPUTE_DECISIONS } from '@/data/project-manager/payments';
import type { BillingDispute, DisputeDecision, DisputeStatus } from '@/data/project-manager/payments';

/*
 * Backlog #31: review and resolve billing disputes ("Manage Payments" use case).
 *   - Start Review sets the status to "Reviewed". Resolving records the decision (Upheld, Rejected
 *     or Adjusted) and the resolved date; Upheld and Adjusted correct the bill amount (criterion 1).
 *   - The customer sees the resolution and the remarks on their billing page (criterion 2).
 *   - Without a decision, the dispute cannot be marked as resolved (criterion 3).
 * Decided with the user (Nov 26): remarks and a new due date are required (the group's
 * Billings::resolveDispute); a reservation fee dispute shows on the Reservation Fee part.
 */

const statusTone: Record<DisputeStatus, PillTone> = {
    Submitted: 'yellow',
    Reviewed: 'blue',
    Resolved: 'green',
};

const DECISION_HELP: Record<DisputeDecision, string> = {
    Upheld: 'The customer is right. Enter the corrected bill amount.',
    Rejected: 'The dispute is not accepted. The bill amount stays the same.',
    Adjusted: 'The bill is partly corrected. Enter the new bill amount.',
};

const REMARKS_MAX = 1000;

/** Today + 7 days as YYYY-MM-DD, in the computer's own time zone. */
const inSevenDays = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Errors = { decision?: string; newAmount?: string; remarks?: string; dueDate?: string };

/** One dispute: its details, then Start Review, then the resolution form. */
function DisputeCard({ dispute, ...props }: StepProps & { dispute: BillingDispute }) {
    const { project, usingSample, managerName, onSaved } = props;
    const billing = project.billings.find((b) => b.id === dispute.billingId);
    const billType = dispute.billingType ?? billing?.type ?? 'Billing';
    const currentAmount = dispute.currentAmount ?? billing?.amount ?? 0;

    const [decision, setDecision] = useState<DisputeDecision | ''>('');
    const [newAmount, setNewAmount] = useState('');
    const [remarks, setRemarks] = useState('');
    const [dueDate, setDueDate] = useState(inSevenDays);
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);

    const needsAmount = decision === 'Upheld' || decision === 'Adjusted';

    const clearError = (key: keyof Errors) => {
        if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
    };

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
        if (needsAmount && (newAmount.trim() === '' || !(Number(newAmount) >= 0))) e.newAmount = 'Enter the corrected bill amount.';
        if (!remarks.trim()) e.remarks = 'Give your remarks to the customer.';
        if (!dueDate) e.dueDate = 'Choose the new due date of the bill.';
        else if (dueDate < today()) e.dueDate = 'The new due date cannot be in the past.';
        setErrors(e);
        if (Object.keys(e).length || !decision) return;

        const amount = needsAmount ? Number(newAmount) : currentAmount;
        const text = remarks.trim();

        const finish = () =>
            toast.success(
                needsAmount
                    ? `${dispute.code} resolved (${decision}). The ${billType} is now ${peso(amount)}, due ${formatDate(dueDate)}.`
                    : `${dispute.code} resolved (Rejected). The ${billType} stays ${peso(amount)}, due ${formatDate(dueDate)}.`,
            );

        // Acceptance criterion 1: decision + resolved date recorded; the bill is updated.
        if (usingSample) {
            updateDispute(
                {
                    status: 'Resolved',
                    resolution: {
                        decision,
                        remarks: text,
                        previousAmount: currentAmount,
                        newAmount: amount,
                        resolvedBy: managerName,
                        resolvedAt: new Date().toISOString(),
                        dueDate,
                    },
                },
                needsAmount ? amount : undefined,
            );
            finish();
            return;
        }

        router.patch(
            `${PROJECTS_URL}/${project.id}/disputes/${dispute.id}/resolve`,
            { decision, newAmount: needsAmount ? amount : null, remarks: text, dueDate },
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
                        {dispute.code} · {billType}
                    </b>{' '}
                    · submitted {formatDateTime(dispute.submittedAt)}
                </p>
                <Pill tone={statusTone[dispute.status]}>{dispute.status}</Pill>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <Detail label="Disputed bill">{`${billType} · ${peso(dispute.resolution?.previousAmount ?? currentAmount)}`}</Detail>
                <div className="sm:col-span-2">
                    <Detail label="Customer's reason">{dispute.reason}</Detail>
                </div>
            </div>

            {dispute.proof && (
                <a
                    href={dispute.proof.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-gold underline-offset-2 hover:underline"
                >
                    <FileText className="size-4" /> Customer's proof: {dispute.proof.name}
                </a>
            )}

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
                                        clearError('decision');
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

                    <div className="grid gap-4 sm:grid-cols-2">
                        {needsAmount && (
                            <Field label={`Corrected bill amount (₱), currently ${peso(currentAmount)}`} htmlFor={`dsp-amount-${dispute.id}`} required error={errors.newAmount}>
                                <input
                                    id={`dsp-amount-${dispute.id}`}
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={newAmount}
                                    onChange={(e) => {
                                        setNewAmount(e.target.value);
                                        clearError('newAmount');
                                    }}
                                    placeholder="e.g. 3000"
                                    className={cx(inputClass, errors.newAmount && 'border-red-500')}
                                />
                            </Field>
                        )}

                        <Field label="New due date of the bill" htmlFor={`dsp-due-${dispute.id}`} required error={errors.dueDate}>
                            <input
                                id={`dsp-due-${dispute.id}`}
                                type="date"
                                min={today()}
                                value={dueDate}
                                onChange={(e) => {
                                    setDueDate(e.target.value);
                                    clearError('dueDate');
                                }}
                                className={cx(inputClass, errors.dueDate && 'border-red-500')}
                            />
                        </Field>
                    </div>

                    <Field label="Remarks to the customer" htmlFor={`dsp-remarks-${dispute.id}`} required error={errors.remarks}>
                        <textarea
                            id={`dsp-remarks-${dispute.id}`}
                            maxLength={REMARKS_MAX}
                            value={remarks}
                            onChange={(e) => {
                                setRemarks(e.target.value);
                                clearError('remarks');
                            }}
                            placeholder="e.g. Only 2 uplights were added, so the charge was corrected to ₱3,000."
                            className={cx(textareaClass, errors.remarks && 'border-red-500')}
                        />
                    </Field>

                    {Object.values(errors).some(Boolean) && (
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
                        Resolved: {dispute.resolution.decision}
                        {dispute.resolution.resolvedBy ? ` · by ${dispute.resolution.resolvedBy}` : ''} on {formatDateTime(dispute.resolution.resolvedAt)}
                    </p>
                    <p className="mt-1 text-ink">
                        {dispute.resolution.previousAmount !== null && dispute.resolution.previousAmount !== dispute.resolution.newAmount ? (
                            <>
                                Bill changed from {peso(dispute.resolution.previousAmount)} to <b>{peso(dispute.resolution.newAmount)}</b>.
                            </>
                        ) : (
                            <>
                                Bill amount: <b>{peso(dispute.resolution.newAmount)}</b>.
                            </>
                        )}
                        {dispute.resolution.dueDate && <> New due date: {formatDate(dispute.resolution.dueDate)}.</>}
                    </p>
                    <p className="mt-1 text-ink-soft">{dispute.resolution.remarks ? `Remarks: ${dispute.resolution.remarks}` : 'No remarks.'}</p>
                    <p className="mt-1 text-xs text-ink-soft">The customer sees this resolution on their billing page.</p>
                </div>
            )}
        </div>
    );
}

/**
 * The project's billing disputes, open ones first.
 * scope "reservation" = the reservation fee's dispute (Reservation Fee part);
 * scope "bills" = the bills after the contract (Payments part).
 */
export default function BillingDisputes({ scope, ...props }: StepProps & { scope: 'reservation' | 'bills' }) {
    const isReservation = (d: BillingDispute) => d.billingType === 'Reservation Fee';
    const disputes = props.project.disputes
        .filter((d) => (scope === 'reservation' ? isReservation(d) : !isReservation(d)))
        .sort((a, b) => Number(a.status === 'Resolved') - Number(b.status === 'Resolved') || b.submittedAt.localeCompare(a.submittedAt));

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