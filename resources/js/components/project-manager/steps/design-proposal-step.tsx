import { Detail, Section, formatDateTime, peso } from '@/components/project-manager/request-details';
import { CompletedNotice, StepIntro, WaitingNotice } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { waitingReason } from '@/data/project-manager/projects';

/*
 * Step 4 · Design Proposal (backlog #24).
 * Placeholder until backlog #24 is built: shows whether the proposal is approved.
 * Reviewing the proposal and finalizing the quotation will be added here.
 */
export default function DesignProposalStep({ project }: StepProps) {
    const proposal = project.designProposal;
    const waiting = waitingReason(project, 'designProposal');

    return (
        <>
            <StepIntro title="Design Proposal">
                Review the design proposal from the Design Specialist and finalize the project quotation.
            </StepIntro>

            {proposal?.status === 'Approved' ? (
                <div className="grid gap-4">
                    <CompletedNotice>
                        <b>The design proposal and finalized quotation were approved</b> by the Project Manager and the customer.
                    </CompletedNotice>
                    <Section title="Approved Proposal">
                        <div className="grid grid-cols-2 gap-3">
                            <Detail label="Finalized quotation">{proposal.quotationTotal !== null ? peso(proposal.quotationTotal) : '—'}</Detail>
                            <Detail label="Approved">{proposal.approvedAt ? formatDateTime(proposal.approvedAt) : '—'}</Detail>
                        </div>
                    </Section>
                </div>
            ) : waiting ? (
                <WaitingNotice>
                    <b>{waiting}</b>
                </WaitingNotice>
            ) : (
                <WaitingNotice>
                    <b>The design proposal has been submitted.</b>
                </WaitingNotice>
            )}

            {proposal?.status !== 'Approved' && (
                <p className="mt-4 rounded-xl border border-dashed border-black/20 p-4 text-center text-sm text-ink-soft">
                    Coming soon: reviewing the design proposal and finalizing the quotation (backlog #24).
                </p>
            )}
        </>
    );
}
