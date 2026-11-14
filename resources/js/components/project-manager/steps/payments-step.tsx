import { Pill } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import { PaymentHistory, PaymentReview } from '@/components/project-manager/payment-review';
import AddChargeForm from '@/components/project-manager/add-charge-form';
import RecordPaymentForm from '@/components/project-manager/record-payment-form';
import { Detail, Section, formatDateTime, peso } from '@/components/project-manager/request-details';
import { CompletedNotice, StepIntro, WaitingNotice } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { billingStatus, billingSummary, verifiedTotal } from '@/data/project-manager/payments';
import type { BillingStatus } from '@/data/project-manager/payments';
import { isStepComplete, waitingReason } from '@/data/project-manager/projects';

/*
 * Step 7 · Payments (backlog #27).
 * After the contract, the customer is billed (down payment, final payment, additional charges).
 * The Project Manager verifies each payment and monitors the payment status, so the payment
 * requirements are met before the project execution proceeds.
 */

const billingTone: Record<BillingStatus, PillTone> = {
    Paid: 'green',
    'For Verification': 'yellow',
    Unpaid: 'gray',
};

export default function PaymentsStep(props: StepProps) {
    const { project } = props;
    const waiting = waitingReason(project, 'payments');
    const done = isStepComplete(project, 'payments');

    const billingPayments = project.payments.filter((p) => p.billingId !== null);
    const pending = billingPayments.filter((p) => p.status === 'For Verification');
    const summary = billingSummary(project.billings, project.payments);

    return (
        <>
            <StepIntro title="Payments">
                Verify the customer's payments and monitor the payment status. Every billing must be paid before the project execution proceeds.
            </StepIntro>

            <div className="grid gap-4">
                {done && (
                    <CompletedNotice>
                        <b>All billings are paid.</b> The payment requirements are met and the project can proceed to execution.
                    </CompletedNotice>
                )}
                {waiting && (
                    <WaitingNotice>
                        <b>{waiting}</b>
                    </WaitingNotice>
                )}

                {/* The customer's payment record */}
                {project.billings.length > 0 && (
                    <Section title="Payment Status">
                        <div className="mb-4 grid grid-cols-3 gap-3">
                            <Detail label="Total billed">{peso(summary.totalBilled)}</Detail>
                            <Detail label="Paid (verified)">{peso(summary.paid)}</Detail>
                            <Detail label="Remaining balance">{peso(summary.balance)}</Detail>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[480px] text-left text-sm">
                                <thead className="text-xs text-ink-soft uppercase">
                                    <tr>
                                        <th className="pb-2 font-medium">Billing</th>
                                        <th className="pb-2 font-medium">Issued</th>
                                        <th className="pb-2 text-right font-medium">Amount</th>
                                        <th className="pb-2 pl-4 font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/10">
                                    {project.billings.map((b) => {
                                        const status = billingStatus(b, project.payments);
                                        return (
                                            <tr key={b.id}>
                                                <td className="py-2 pr-4 text-ink">
                                                    <span className="font-semibold">{b.type}</span>
                                                    {b.description && <span className="block text-xs">{b.description}</span>}
                                                    {b.reason && <span className="block text-xs text-ink-soft">Reason: {b.reason}</span>}
                                                </td>
                                                <td className="py-2 text-ink-soft">{formatDateTime(b.issuedAt)}</td>
                                                <td className="py-2 text-right text-ink">{peso(b.amount)}</td>
                                                <td className="py-2 pl-4">
                                                    <Pill tone={billingTone[status]}>{status}</Pill>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Section>
                )}

                {pending.length > 0 && (
                    <Section title="For Verification">
                        <div className="grid gap-4">
                            {pending.map((payment) => (
                                <PaymentReview key={payment.id} {...props} payment={payment} />
                            ))}
                        </div>
                    </Section>
                )}
                <AddChargeForm {...props} />
                    <RecordPaymentForm
                    {...props}
                    targets={project.billings
                        .filter((b) => billingStatus(b, project.payments) !== 'Paid')
                        .map((b) => ({ billingId: b.id, type: b.type, balance: b.amount - verifiedTotal(b.id, project.payments) }))}
                />
                <Section title="Payment History">
                    <PaymentHistory payments={project.payments} />
                </Section>
            </div>
        </>
    );
}