import { PaymentHistory, PaymentReview } from '@/components/project-manager/payment-review';
import RecordPaymentForm from '@/components/project-manager/record-payment-form';
import { Section, peso } from '@/components/project-manager/request-details';
import { CompletedNotice, StepIntro, WaitingNotice } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { verifiedTotal } from '@/data/project-manager/payments';
import { waitingReason } from '@/data/project-manager/projects';

/*
 * Step 2 · Reservation Fee (backlog #27).
 * After the consultation, the customer pays the reservation fee and uploads the receipt.
 * The Project Manager verifies it. Once verified, the customer is notified to book the
 * ocular visit and the Site Assessment step opens ("Manage Payments" use case).
 */

export default function ReservationFeeStep(props: StepProps) {
    const { project } = props;
    const waiting = waitingReason(project, 'reservationFee');
    const feePayments = project.payments.filter((p) => p.type === 'Reservation Fee');
    const pending = feePayments.filter((p) => p.status === 'For Verification');

    return (
        <>
            <StepIntro title="Reservation Fee">
                Verify the reservation fee the customer paid. Once it is verified, the customer can book the ocular visit.
            </StepIntro>

            <div className="grid gap-4">
                {project.reservationFee.paid ? (
                    <CompletedNotice>
                        <b>The reservation fee ({peso(project.reservationFee.amount)}) has been verified.</b> The customer was notified to book the
                        ocular visit.
                    </CompletedNotice>
                ) : (
                    <>
                        <p className="text-sm text-ink">
                            Reservation fee billed: <b>{peso(project.reservationFee.amount)}</b>
                        </p>
                        {waiting && (
                            <WaitingNotice>
                                <b>{waiting}</b>
                            </WaitingNotice>
                        )}
                        {pending.map((payment) => (
                            <PaymentReview key={payment.id} {...props} payment={payment} />
                        ))}
                                                <RecordPaymentForm
                            {...props}
                            targets={[
                                {
                                    billingId: null,
                                    type: 'Reservation Fee',
                                    balance: project.reservationFee.amount - verifiedTotal(null, project.payments),
                                },
                            ]}
                        />
                    </>
                )}

                <Section title="Payment History">
                    <PaymentHistory payments={feePayments} />
                </Section>
            </div>
        </>
    );
}