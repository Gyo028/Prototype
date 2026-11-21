/*
 * Payments: types and helpers (backlog #27).
 *
 * The customer pays a billing and uploads proof of payment. The Project Manager verifies or
 * rejects it inside the project wizard ("Manage Payments" use case):
 *   - Step 2 · Reservation Fee: the reservation fee billed after the consultation
 *   - Step 7 · Payments:        the down payment, final payment and additional charges
 *
 * A project keeps its own `payments` (what the customer submitted) and `billings`
 * (what the system issued after the contract). Both live on the Project type in projects.ts.
 */

export type PaymentType = 'Reservation Fee' | 'Down Payment' | 'Final Payment' | 'Additional Charge';
export type BillingType = Exclude<PaymentType, 'Reservation Fee'>;
export type PaymentMethod = 'GCash' | 'Maya' | 'Bank Transfer' | 'Cash' | 'Cheque';

/** Paid in person: recorded by the Project Manager and saved as verified right away (backlog #28). */
export const RECORDED_METHODS = ['Cash', 'Cheque'] as const;
export type RecordedMethod = (typeof RECORDED_METHODS)[number];
export type PaymentStatus = 'For Verification' | 'Verified' | 'Rejected';

/** File types accepted as proof of payment. */
export const RECEIPT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

/** What the Project Manager confirms on the receipt before verifying. */
export const RECEIPT_CHECKLIST = [
    { id: 'amount', label: 'The receipt shows the same amount as the payment' },
    { id: 'reference', label: 'The reference number on the receipt matches' },
] as const;

export type ReceiptCheckId = (typeof RECEIPT_CHECKLIST)[number]['id'];

/** A bill issued to the customer after the contract (the reservation fee is kept on the project itself). */
export type Billing = {
    id: number;
    type: BillingType;
    amount: number; // pesos
    issuedAt: string; // ISO date-time
    description?: string | null; // additional charges only: what the charge is for (backlog #29)
    reason?: string | null; // additional charges only: why it is outside the approved quotation
    recordedBy?: string | null; // additional charges only: the Project Manager who recorded it
};

/** One payment the customer submitted. */
export type Payment = {
    id: number;
    code: string; // e.g. "PAY-0001"
    billingId: number | null; // null = reservation fee
    type: PaymentType;
    amount: number; // pesos
    method: PaymentMethod;
    referenceNo: string;
    paidOn: string; // 'YYYY-MM-DD', as entered by the customer
    receipt: { name: string; url: string } | null; // null = no proof of payment uploaded
    chequeNo?: string | null; // cheque payments only
    submittedAt: string; // ISO date-time
    status: PaymentStatus;
    review: {
        remarks: string | null; // required when rejected
        reviewedBy: string;
        reviewedAt: string; // ISO date-time
    } | null;
};

/** The receipt file is valid when it is an image or a PDF. */
export const receiptIsValid = (receipt: Payment['receipt']) =>
    receipt !== null && RECEIPT_EXTENSIONS.includes(receipt.name.split('.').pop()?.toLowerCase() ?? '');

/** Acceptance criterion 2: why a payment cannot be verified, or null when the receipt is fine. */
export function receiptProblem(p: Payment): string | null {
    if (!p.receipt) return 'No payment receipt was uploaded. The payment cannot be verified until the customer uploads one.';
    if (!receiptIsValid(p.receipt)) return 'The uploaded receipt is not a valid file. It must be an image (JPG, PNG, WEBP) or a PDF.';
    return null;
}

export type BillingStatus = 'Paid' | 'For Verification' | 'Unpaid';

/** Total of the verified payments for one billing (billingId null = the reservation fee). */
export const verifiedTotal = (billingId: number | null, payments: Payment[]) =>
    payments.filter((p) => p.billingId === billingId && p.status === 'Verified').reduce((sum, p) => sum + p.amount, 0);

/** A billing is paid once its verified payments cover the full amount. */
export function billingStatus(billing: Billing, payments: Payment[]): BillingStatus {
    if (verifiedTotal(billing.id, payments) >= billing.amount) return 'Paid';
    if (payments.some((p) => p.billingId === billing.id && p.status === 'For Verification')) return 'For Verification';
    return 'Unpaid';
}

/** The customer's payment record for the billings: total billed, verified so far, and the balance. */
export function billingSummary(billings: Billing[], payments: Payment[]) {
    const totalBilled = billings.reduce((sum, b) => sum + b.amount, 0);
    const paid = billings.reduce((sum, b) => sum + Math.min(b.amount, verifiedTotal(b.id, payments)), 0);
    return { totalBilled, paid, balance: Math.max(0, totalBilled - paid) };
}

/* ---------- sample helpers (used by the sample projects in projects.ts) ---------- */

type PaymentInput = Pick<Payment, 'id' | 'type' | 'amount' | 'submittedAt'> & Partial<Payment>;

export const samplePayment = (p: PaymentInput): Payment => ({
    code: `PAY-${String(p.id).padStart(4, '0')}`,
    billingId: null,
    method: 'GCash',
    referenceNo: `1009 ${String(p.id).padStart(3, '0')} 337 1`,
    paidOn: p.submittedAt.slice(0, 10),
    receipt: { name: `receipt-${p.id}.jpg`, url: '' },
    status: 'For Verification',
    review: null,
    ...p,
});

export const verified = (reviewedAt: string): Payment['review'] => ({ remarks: null, reviewedBy: 'Project Manager', reviewedAt });

/* ---------- billing disputes (backlog #31) ---------- */

/**
 * Submitted = the customer raised the dispute, not reviewed yet
 * Reviewed  = the Project Manager is reviewing it
 * Resolved  = a decision was recorded and the customer was notified
 */
export type DisputeStatus = 'Submitted' | 'Reviewed' | 'Resolved';

/** Upheld and Rejected keep the bill as it is; Adjusted changes the billing amount. */
export const DISPUTE_DECISIONS = ['Upheld', 'Rejected', 'Adjusted'] as const;
export type DisputeDecision = (typeof DISPUTE_DECISIONS)[number];

export type BillingDispute = {
    id: number;
    code: string; // e.g. "DSP-0001"
    billingId: number; // the bill being disputed
    reason: string; // the customer's explanation
    submittedAt: string; // ISO date-time
    status: DisputeStatus;
    reviewedAt: string | null; // when the Project Manager started the review
    resolution: {
        decision: DisputeDecision;
        remarks: string | null;
        previousAmount: number; // the bill before the resolution
        newAmount: number; // equal to previousAmount unless Adjusted
        resolvedBy: string;
        resolvedAt: string; // ISO date-time = the resolved date
    } | null;
};