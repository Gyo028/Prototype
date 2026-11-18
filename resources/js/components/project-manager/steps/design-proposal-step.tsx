import { router } from '@inertiajs/react';
import { Check, ExternalLink, FileText, LayoutGrid, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DangerButton, Field, GoldButton, OutlineButton, Pill, cx, textareaClass } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import QuotationEditor, {
    QuotationSummary,
    hasQuotationErrors,
    initialQuotation,
    validateQuotation,
} from '@/components/project-manager/quotation-editor';
import type { QuotationErrors } from '@/components/project-manager/quotation-editor';
import { Detail, Section, formatDateTime, peso } from '@/components/project-manager/request-details';
import { CompletedNotice, PROJECTS_URL, StepIntro, WaitingNotice } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { quotationTotal, waitingReason } from '@/data/project-manager/projects';
import type { DesignProposal, ProposalStatus, Quotation } from '@/data/project-manager/projects';

/*
 * Step 4 · Design Proposal (backlog #24).
 * The Project Manager reviews the design proposal submitted by the Design Specialist,
 * finalizes the project quotation, then approves the proposal or returns it for revision.
 *   - Return for Revision needs remarks (acceptance criterion 2).
 *   - Approve is blocked while the quotation is incomplete or has missing prices (acceptance criterion 3).
 *   - The proposal, the finalized quotation and the decision are saved (acceptance criterion 1).
 * After approval, the customer reviews the proposal and quotation (Plan Project use case).
 */

type Decision = 'approve' | 'return';

const statusTone: Record<ProposalStatus, PillTone> = {
    Submitted: 'yellow',
    'Returned for Revision': 'red',
    'Awaiting Customer': 'blue',
    Approved: 'green',
};

const emptyErrors: QuotationErrors = { items: {} };

export default function DesignProposalStep({ project, usingSample, managerName, onSaved }: StepProps) {
    const proposal = project.designProposal;
    const waiting = waitingReason(project, 'designProposal');

    const [quotation, setQuotation] = useState<Quotation>(() => initialQuotation(project));
    const [quoteErrors, setQuoteErrors] = useState<QuotationErrors>(emptyErrors);
    const [decision, setDecision] = useState<Decision | null>(null);
    const [remarks, setRemarks] = useState('');
    const [remarksError, setRemarksError] = useState('');
    const [saving, setSaving] = useState(false);

    // Re-check as the Project Manager edits, but only after a failed approval attempt.
    const changeQuotation = (q: Quotation) => {
        setQuotation(q);
        if (hasQuotationErrors(quoteErrors)) setQuoteErrors(validateQuotation(q));
    };

    const startDecision = (d: Decision) => {
        if (d === 'approve') {
            // Acceptance criterion 3: an incomplete quotation cannot be approved.
            const e = validateQuotation(quotation);
            setQuoteErrors(e);
            if (hasQuotationErrors(e)) return;
        }
        setDecision(d);
        setRemarks('');
        setRemarksError('');
    };

    const submit = () => {
        if (!proposal || !decision) return;
        const text = remarks.trim();

        // Acceptance criterion 2: a return for revision without remarks is never sent.
        if (decision === 'return' && !text) {
            setRemarksError('Revision remarks are required. Tell the Design Specialist what to change.');
            return;
        }
        if (decision === 'approve' && hasQuotationErrors(validateQuotation(quotation))) return;

        const finish = () => {
            toast.success(
                decision === 'approve'
                    ? `Design proposal approved and quotation finalized (${peso(quotationTotal(quotation))}). Sent to the customer for approval.`
                    : `Design proposal returned to ${proposal.submittedBy} for revision.`,
            );
            setDecision(null);
        };

        // Acceptance criterion 1: the proposal, finalized quotation and decision are saved.
        if (usingSample) {
            const updated: DesignProposal = {
                ...proposal,
                status: decision === 'approve' ? 'Awaiting Customer' : 'Returned for Revision',
                quotation: decision === 'approve' ? quotation : proposal.quotation,
                review: { decision, remarks: text || null, reviewedBy: managerName, reviewedAt: new Date().toISOString() },
            };
            onSaved({ ...project, designProposal: updated });
            finish();
            return;
        }

        router.patch(
            `${PROJECTS_URL}/${project.id}/design-proposal/${decision}`,
            decision === 'approve' ? { remarks: text || null, quotation } : { remarks: text },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: finish,
                onError: (errors) => setRemarksError(errors.remarks ?? errors.quotation ?? 'The decision could not be saved. Please try again.'),
            },
        );
    };

    const itemErrorCount = Object.keys(quoteErrors.items).length;

    return (
        <>
            <StepIntro title="Design Proposal">
                Review the design proposal from the Design Specialist, finalize the project quotation, then approve it or return it for
                revision.
            </StepIntro>

            {!proposal ? (
                <WaitingNotice>
                    <b>{waiting}</b>
                </WaitingNotice>
            ) : (
                <div className="grid gap-4">
                    {proposal.status === 'Approved' && (
                        <CompletedNotice>
                            <b>The customer approved the design proposal and quotation.</b> The project contract comes next.
                        </CompletedNotice>
                    )}
                    {waiting && (
                        <WaitingNotice>
                            <b>{waiting}</b>
                        </WaitingNotice>
                    )}

                    {/* The proposal from the Design Specialist */}
                    <Section title="Design Proposal">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm text-ink">
                                Version {proposal.version}
                                {proposal.version > 1 && ' (revised)'} · submitted by <b>{proposal.submittedBy}</b> on{' '}
                                {formatDateTime(proposal.submittedAt)}
                            </p>
                            <Pill tone={statusTone[proposal.status]}>{proposal.status}</Pill>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="overflow-hidden rounded-lg border border-black/10 bg-neutral-100">
                                {proposal.layoutSnapshotUrl ? (
                                    <a href={proposal.layoutSnapshotUrl} target="_blank" rel="noreferrer">
                                        <img src={proposal.layoutSnapshotUrl} alt="Proposed layout" className="w-full object-contain" />
                                    </a>
                                ) : (
                                    <div className="flex aspect-video flex-col items-center justify-center gap-2 p-4 text-center">
                                        <LayoutGrid className="size-8 text-ink-soft" />
                                        <p className="text-xs text-ink-soft">Layout snapshot not available</p>
                                    </div>
                                )}
                            </div>
                            <div className="grid content-start gap-3">
                                <Detail label="Designer's notes">{proposal.notes || 'No notes.'}</Detail>
                                {proposal.file && (
                                    <a
                                        href={proposal.file.url || undefined}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-3 rounded-lg border border-black/15 p-3 transition hover:border-gold hover:bg-gold/10"
                                    >
                                        <FileText className="size-6 shrink-0 text-red-600" />
                                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{proposal.file.name}</span>
                                        <span className="flex items-center gap-1 text-xs font-semibold text-gold-dark">
                                            Open <ExternalLink className="size-3.5" />
                                        </span>
                                    </a>
                                )}
                            </div>
                        </div>
                    </Section>

                    {/* Last decision (read-only) */}
                    {proposal.review && proposal.status !== 'Submitted' && (
                        <div
                            className={cx(
                                'rounded-xl border p-4 text-sm',
                                proposal.review.decision === 'approve' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50',
                            )}
                        >
                            <p className="font-bold text-ink">
                                {proposal.review.decision === 'approve' ? 'Approved' : 'Returned for revision'} by {proposal.review.reviewedBy} on{' '}
                                {formatDateTime(proposal.review.reviewedAt)}
                            </p>
                            <p className="mt-1 text-ink-soft">{proposal.review.remarks ? `Remarks: ${proposal.review.remarks}` : 'No remarks.'}</p>
                        </div>
                    )}

                    {/* Finalized quotation (read-only once approved) */}
                    {proposal.status !== 'Submitted' && proposal.quotation && (
                        <Section title="Finalized Quotation">
                            <QuotationSummary quotation={proposal.quotation} />
                        </Section>
                    )}

                    {/* Submitted: finalize the quotation and decide */}
                    {proposal.status === 'Submitted' && (
                        <>
                            <Section title="Finalize the Project Quotation">
                                <p className="mb-3 text-xs text-ink-soft">
                                    Started from the customer's services and the layout assets in the proposal. Check every price, add any missing
                                    items, then approve.
                                </p>
                                <QuotationEditor quotation={quotation} errors={quoteErrors} onChange={changeQuotation} />
                            </Section>

                            {hasQuotationErrors(quoteErrors) && (
                                <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                                    <p className="font-bold">The design proposal cannot be approved. The quotation is incomplete:</p>
                                    <ul className="mt-1 list-disc pl-5">
                                        {quoteErrors.general && <li>{quoteErrors.general}</li>}
                                        {itemErrorCount > 0 && (
                                            <li>
                                                {itemErrorCount} {itemErrorCount === 1 ? 'line is' : 'lines are'} missing a description, quantity or price
                                            </li>
                                        )}
                                        {quoteErrors.discount && <li>{quoteErrors.discount}</li>}
                                    </ul>
                                </div>
                            )}

                            {decision === null ? (
                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                    <DangerButton onClick={() => startDecision('return')}>
                                        <Undo2 className="size-4" /> Return for Revision
                                    </DangerButton>
                                    <GoldButton onClick={() => startDecision('approve')}>
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
                                    {decision === 'approve' && (
                                        <p className="text-sm text-ink">
                                            Approve this proposal with a finalized quotation of <b>{peso(quotationTotal(quotation))}</b>? It will be sent
                                            to the customer for approval.
                                        </p>
                                    )}
                                    <Field
                                        label={decision === 'return' ? 'Revision remarks' : 'Remarks (optional)'}
                                        htmlFor="proposal-remarks"
                                        required={decision === 'return'}
                                        error={remarksError}
                                    >
                                        <textarea
                                            id="proposal-remarks"
                                            autoFocus
                                            value={remarks}
                                            onChange={(e) => {
                                                setRemarks(e.target.value);
                                                if (remarksError) setRemarksError('');
                                            }}
                                            placeholder={
                                                decision === 'return'
                                                    ? 'e.g. Move the stage to the north wall and use white flowers for the arch.'
                                                    : 'e.g. Looks good. Please prepare the final assets list.'
                                            }
                                            className={cx(textareaClass, remarksError && 'border-red-500')}
                                        />
                                    </Field>

                                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                        <OutlineButton onClick={() => setDecision(null)} disabled={saving}>
                                            Back
                                        </OutlineButton>
                                        {decision === 'return' ? (
                                            <DangerButton type="submit" disabled={saving}>
                                                {saving ? 'Sending...' : 'Confirm Return'}
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
