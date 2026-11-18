import { router } from '@inertiajs/react';
import { Check, ExternalLink, FileText, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DangerButton, Field, GoldButton, OutlineButton, Pill, cx, textareaClass } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import { Detail, Section, formatDateTime, peso } from '@/components/project-manager/request-details';
import { CompletedNotice, PROJECTS_URL, StepIntro, WaitingNotice } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { CONTRACT_CHECKLIST, waitingReason } from '@/data/project-manager/projects';
import type { ChecklistId, ContractStatus, ContractSubmission } from '@/data/project-manager/projects';

/*
 * Step 5 · Contract (backlog #18).
 * The customer signs and uploads the project contract. The Project Manager ticks the
 * verification checklist, then approves (verifies) or rejects it.
 *   - Approve only works when every checklist item is ticked.
 *   - Reject cannot be sent without remarks.
 */

type Decision = 'approve' | 'reject';

const statusTone: Record<ContractStatus, PillTone> = {
    'For Review': 'yellow',
    Approved: 'green',
    Rejected: 'red',
};

export default function ContractStep({ project, usingSample, managerName, onSaved }: StepProps) {
    const contract = project.contract;

    const [checked, setChecked] = useState<ChecklistId[]>([]);
    const [decision, setDecision] = useState<Decision | null>(null);
    const [remarks, setRemarks] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const allChecked = checked.length === CONTRACT_CHECKLIST.length;
    const waiting = waitingReason(project, 'contract');

    const toggleCheck = (id: ChecklistId) => {
        setChecked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
        if (error) setError('');
    };

    const startDecision = (d: Decision) => {
        setDecision(d);
        setRemarks('');
        setError('');
    };

    const submit = () => {
        if (!contract || !decision) return;
        const text = remarks.trim();

        if (decision === 'approve' && !allChecked) {
            setError('Tick every checklist item before approving the contract.');
            return;
        }
        // Acceptance criterion 2: a rejection without remarks is never sent.
        if (decision === 'reject' && !text) {
            setError('Remarks are required when rejecting a contract. Tell the customer what to fix.');
            return;
        }

        const finish = () => {
            toast.success(
                decision === 'approve'
                    ? `${contract.code} verified. The customer has been notified that project execution is underway.`
                    : `${contract.code} rejected. The customer has been asked to re-submit.`,
            );
            setDecision(null);
            setChecked([]);
        };

        // Acceptance criterion 1: the decision is saved.
        if (usingSample) {
            onSaved({
                ...project,
                contract: {
                    ...contract,
                    status: decision === 'approve' ? 'Approved' : 'Rejected',
                    review: { remarks: text || null, checklist: checked, reviewedBy: managerName, reviewedAt: new Date().toISOString() },
                },
            });
            finish();
            return;
        }

        router.patch(
            `${PROJECTS_URL}/${project.id}/contract/${decision}`,
            { remarks: text || null, checklist: checked },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: finish,
                onError: (errors) => setError(errors.remarks ?? errors.checklist ?? 'The review could not be saved. Please try again.'),
            },
        );
    };

    return (
        <>
            <StepIntro title="Contract">
                Verify the signed project contract submitted by the customer. Only valid and properly signed contracts can be approved.
            </StepIntro>

            {!contract ? (
                <WaitingNotice>
                    <b>{waiting}</b>
                </WaitingNotice>
            ) : (
                <div className="grid gap-4">
                    {contract.status === 'Approved' && (
                        <CompletedNotice>
                            <b>Contract verified.</b> Project planning is complete, and project execution can now be scheduled.
                        </CompletedNotice>
                    )}
                    {contract.status === 'Rejected' && waiting && (
                        <WaitingNotice>
                            <b>{waiting}</b>
                        </WaitingNotice>
                    )}

                    <ContractDetails contract={contract} />

                    {/* Already reviewed: the saved result */}
                    {contract.review && <ReviewResult contract={contract} />}

                    {/* For review: checklist and decision */}
                    {contract.status === 'For Review' && (
                        <>
                            <Section title="Verification Checklist">
                                <div className="grid gap-2">
                                    {CONTRACT_CHECKLIST.map((item) => (
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
                                                onChange={() => toggleCheck(item.id)}
                                                className="mt-0.5 size-4 accent-[#C9A013]"
                                            />
                                            {item.label}
                                        </label>
                                    ))}
                                </div>
                                <p className="mt-3 text-xs text-ink-soft">
                                    {allChecked
                                        ? 'All items verified. The contract can be approved.'
                                        : `${checked.length} of ${CONTRACT_CHECKLIST.length} verified. Tick every item to enable Approve.`}
                                </p>
                            </Section>

                            {decision === null ? (
                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                    <DangerButton onClick={() => startDecision('reject')}>
                                        <X className="size-4" /> Reject
                                    </DangerButton>
                                    <GoldButton
                                        onClick={() => startDecision('approve')}
                                        disabled={!allChecked}
                                        title={allChecked ? undefined : 'Tick every checklist item first'}
                                    >
                                        <Check className="size-4" /> Approve
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
                                    <Field
                                        label={decision === 'reject' ? 'Reason for rejection' : 'Remarks (optional)'}
                                        htmlFor="contract-remarks"
                                        required={decision === 'reject'}
                                        error={error}
                                    >
                                        <textarea
                                            id="contract-remarks"
                                            autoFocus
                                            value={remarks}
                                            onChange={(e) => {
                                                setRemarks(e.target.value);
                                                if (error) setError('');
                                            }}
                                            placeholder={
                                                decision === 'reject'
                                                    ? 'e.g. Page 3 is missing the customer signature. Please sign every page and upload again.'
                                                    : 'e.g. Contract verified. Please proceed with the down payment.'
                                            }
                                            className={cx(textareaClass, error && 'border-red-500')}
                                        />
                                    </Field>
                                    <p className="text-xs text-ink-soft">The customer will be notified and will see these remarks.</p>

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
                                                {saving ? 'Approving...' : 'Confirm Approval'}
                                            </GoldButton>
                                        )}
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                </div>
            )}
        </>
    );
}

function ContractDetails({ contract: c }: { contract: ContractSubmission }) {
    return (
        <Section title="Signed Contract">
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Detail label="Contract no.">{c.code}</Detail>
                <Detail label="Version">
                    {c.version}
                    {c.version > 1 && ' (re-submitted)'}
                </Detail>
                <Detail label="Amount">{peso(c.amount)}</Detail>
                <Detail label="Status">
                    <Pill tone={statusTone[c.status]}>{c.status === 'Approved' ? 'Verified' : c.status}</Pill>
                </Detail>
            </div>
            <a
                href={c.file.url || undefined}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-lg border border-black/15 p-3 transition hover:border-gold hover:bg-gold/10"
            >
                <FileText className="size-6 shrink-0 text-red-600" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{c.file.name}</span>
                <span className="flex items-center gap-1 text-xs font-semibold text-gold-dark">
                    Open <ExternalLink className="size-3.5" />
                </span>
            </a>
            <p className="mt-2 text-xs text-ink-soft">Submitted {formatDateTime(c.submittedAt)}</p>
        </Section>
    );
}

function ReviewResult({ contract: c }: { contract: ContractSubmission }) {
    if (!c.review) return null;
    return (
        <div className={cx('rounded-xl border p-4', c.status === 'Approved' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50')}>
            <p className="text-sm font-bold text-ink">
                {c.status === 'Approved' ? 'Verified' : 'Rejected'} by {c.review.reviewedBy} on {formatDateTime(c.review.reviewedAt)}
            </p>
            <p className="mt-1 text-sm text-ink-soft">{c.review.remarks ? `Remarks: ${c.review.remarks}` : 'No remarks.'}</p>
            <ul className="mt-3 grid gap-1">
                {CONTRACT_CHECKLIST.map((item) => {
                    const ok = c.review?.checklist.includes(item.id);
                    return (
                        <li key={item.id} className="flex items-start gap-2 text-sm text-ink">
                            {ok ? <Check className="mt-0.5 size-4 shrink-0 text-green-600" /> : <X className="mt-0.5 size-4 shrink-0 text-red-600" />}
                            {item.label}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
