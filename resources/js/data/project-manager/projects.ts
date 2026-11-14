/*
 * Projects: types, wizard step rules and sample data.
 *
 * An approved service request becomes a project. Its planning follows the
 * "Plan Project" use case, one step at a time:
 *
 *   1. Consultation        (backlog #16)
 *   2. Reservation Fee     (backlog #27)  needs: the customer's reservation fee payment
 *   3. Site Assessment     (backlog #20)  needs: ocular visit booked by the customer
 *   4. Design Assignment   (backlog #21)
 *   5. Design Proposal     (backlog #24)
 *   6. Contract            (backlog #18)  needs: the customer's signed contract
 *   7. Payments            (backlog #27)  needs: the down payment / final payment billings paid
 *
 * A step stays locked until the step before it is complete.
 * The SAMPLE_PROJECTS list is only used while the backend is not ready yet.
 */

import { billingStatus, samplePayment, verified } from '@/data/project-manager/payments';
import type { Billing, BillingDispute, Payment } from '@/data/project-manager/payments';
import type { ProjectRequest } from '@/data/project-manager/project-requests';

/* ---------- site assessment (backlog #20) ---------- */

export const REPORT_EXTENSIONS = ['pdf', 'docx'] as const;
export const REPORT_MAX_MB = 10;
export const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;
export const PHOTO_MAX_MB = 5;

export type StoredFile = {
    name: string;
    url: string; // served through the app (private Supabase Storage); '' in the sample data
};

export type SitePhoto = StoredFile & { id: number };

export type SiteAssessment = {
    assessedOn: string; // 'YYYY-MM-DD'
    findings: string | null;
    report: StoredFile & { type: 'pdf' | 'docx' };
    photos: SitePhoto[];
    recordedBy: string;
    recordedAt: string; // ISO date-time
};

/* ---------- design assignment (backlog #21) ---------- */

export type DesignSpecialist = {
    id: number;
    name: string;
    activeProjects: number; // how many projects they are currently designing
};

export type Assignment = {
    specialistId: number;
    specialistName: string;
    notes: string | null;
    assignedBy: string;
    assignedAt: string; // ISO date-time
};

/* ---------- design proposal and quotation (backlog #24) ---------- */

/** One line of the project quotation. */
export type QuotationItem = {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number; // pesos
};

export type Quotation = {
    items: QuotationItem[];
    discount: number; // pesos taken off the subtotal
};

export const quotationSubtotal = (q: Quotation) => q.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
export const quotationTotal = (q: Quotation) => Math.max(0, quotationSubtotal(q) - q.discount);

/**
 * Submitted             = waiting for the Project Manager's review
 * Returned for Revision = sent back to the Design Specialist with remarks
 * Awaiting Customer     = approved by the Project Manager, quotation finalized, waiting for the customer
 * Approved              = approved by the customer too (the contract comes next)
 */
export type ProposalStatus = 'Submitted' | 'Returned for Revision' | 'Awaiting Customer' | 'Approved';

export type DesignProposal = {
    version: number; // 2 or more = re-submitted after a revision
    status: ProposalStatus;
    submittedBy: string; // the Design Specialist
    submittedAt: string; // ISO date-time
    notes: string; // the designer's explanation of the proposal
    layoutSnapshotUrl: string | null; // image exported from the 2D Layout Designer
    file: StoredFile | null; // the design proposal document
    quotation: Quotation | null; // finalized by the Project Manager when approving
    review: {
        decision: 'approve' | 'return';
        remarks: string | null; // required when returned for revision
        reviewedBy: string;
        reviewedAt: string; // ISO date-time
    } | null;
};

/* ---------- contract (backlog #18) ---------- */

export type ContractStatus = 'For Review' | 'Approved' | 'Rejected';

/** What the Project Manager must confirm before a contract can be approved. */
export const CONTRACT_CHECKLIST = [
    { id: 'signed', label: 'Signed by the customer on every signature line' },
    { id: 'details', label: 'Project details match the approved project (event date, venue, services)' },
    { id: 'amount', label: 'Contract amount and payment terms match the quotation' },
    { id: 'complete', label: 'All pages are complete and readable' },
] as const;

export type ChecklistId = (typeof CONTRACT_CHECKLIST)[number]['id'];

export type ContractSubmission = {
    code: string; // e.g. "CON-0001"
    version: number; // 2 or more = re-submitted after a rejection
    amount: number;
    file: StoredFile;
    submittedAt: string; // ISO date-time
    status: ContractStatus;
    review: {
        remarks: string | null; // required when rejected
        checklist: ChecklistId[];
        reviewedBy: string;
        reviewedAt: string; // ISO date-time
    } | null;
};

/* ---------- the project ---------- */

/** An approved service request plus everything recorded while planning it. */
export type Project = ProjectRequest & {
    reservationFee: { amount: number; paid: boolean }; // billed after the consultation, verified in step 2
    ocularVisitAt: string | null; // 'YYYY-MM-DDTHH:mm', booked by the customer
    siteAssessment: SiteAssessment | null;
    assignment: Assignment | null;
    designProposal: DesignProposal | null;
    contract: ContractSubmission | null;
    billings: Billing[]; // issued to the customer after the contract (down payment, final payment, additional charges)
    payments: Payment[]; // every payment the customer submitted, for the reservation fee and the billings
    disputes: BillingDispute[]; // billing disputes raised by the customer (backlog #31)
};

/* ---------- wizard steps ---------- */

export const STEPS = [
    { key: 'consultation', title: 'Consultation' },
    { key: 'reservationFee', title: 'Reservation Fee' },
    { key: 'siteAssessment', title: 'Site Assessment' },
    { key: 'designAssignment', title: 'Design Assignment' },
    { key: 'designProposal', title: 'Design Proposal' },
    { key: 'contract', title: 'Contract' },
    { key: 'payments', title: 'Payments' },
] as const;

export type StepKey = (typeof STEPS)[number]['key'];

/**
 * done     = completed
 * skipped  = not needed for this project (e.g. no ocular visit) and counts as completed
 * current  = the Project Manager can work on it now
 * waiting  = open, but waiting for the customer or the Design Specialist first
 * locked   = the step before it is not complete yet
 * closed   = the project will not proceed
 */
export type StepState = 'done' | 'skipped' | 'current' | 'waiting' | 'locked' | 'closed';

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

export const isNotProceeding = (p: Project) => p.consultation?.decision === 'Do not proceed';

const ocularRequired = (p: Project) => p.consultation?.ocularVisit.required ?? true;

/** Whether a step's work is finished. */
export function isStepComplete(p: Project, key: StepKey): boolean {
    switch (key) {
        case 'consultation':
            return p.consultation !== null;
        case 'reservationFee':
            return p.reservationFee.paid;
        case 'siteAssessment':
            return !ocularRequired(p) || p.siteAssessment !== null;
        case 'designAssignment':
            return p.assignment !== null;
        case 'designProposal':
            return p.designProposal?.status === 'Approved';
        case 'contract':
            return p.contract?.status === 'Approved';
        case 'payments':
            return p.billings.length > 0 && p.billings.every((b) => billingStatus(b, p.payments) === 'Paid');
    }
}

/** Why an open step cannot be worked on yet, or null when the Project Manager can act. */
export function waitingReason(p: Project, key: StepKey): string | null {
    switch (key) {
        case 'reservationFee': {
            const pending = p.payments.some((x) => x.type === 'Reservation Fee' && x.status === 'For Verification');
            if (!pending) return `Waiting for the customer to pay the reservation fee (${peso(p.reservationFee.amount)}) and upload the receipt.`;
            return null;
        }
        case 'siteAssessment':
            if (!p.ocularVisitAt) return 'Waiting for the customer to book the ocular visit.';
            return null;
        case 'designProposal': {
            const designer = p.assignment?.specialistName ?? 'the Design Specialist';
            if (!p.designProposal) return `Waiting for ${designer} to submit the design proposal.`;
            if (p.designProposal.status === 'Returned for Revision') return `Waiting for ${designer} to revise and re-submit the design proposal.`;
            if (p.designProposal.status === 'Awaiting Customer') return 'Waiting for the customer to approve the design proposal and quotation.';
            return null;
        }
        case 'contract':
            if (!p.contract) return 'Waiting for the customer to sign and upload the project contract.';
            if (p.contract.status === 'Rejected') return 'Waiting for the customer to re-submit the signed contract.';
            return null;
        case 'payments': {
            if (p.billings.length === 0) return 'Waiting for the billing to be issued to the customer.';
            if (p.payments.some((x) => x.billingId !== null && x.status === 'For Verification')) return null;
            if (p.disputes.some((d) => d.status !== 'Resolved')) return null; // a billing dispute needs the Project Manager
            const unpaid = p.billings.filter((b) => billingStatus(b, p.payments) === 'Unpaid');
            if (unpaid.length === 0) return null;
            return `Waiting for the customer to pay: ${unpaid.map((b) => `${b.type} (${peso(b.amount)})`).join(', ')}.`;
        }
        default:
            return null;
    }
}

/** The state of every step, in order. A step unlocks only when the one before it is complete. */
export function stepStates(p: Project): Record<StepKey, StepState> {
    const states = {} as Record<StepKey, StepState>;
    const closed = isNotProceeding(p);
    let previousComplete = true;

    STEPS.forEach(({ key }, index) => {
        const complete = isStepComplete(p, key);

        if (closed && index > 0) states[key] = 'closed';
        else if (!previousComplete) states[key] = 'locked';
        else if (complete) states[key] = key === 'siteAssessment' && !ocularRequired(p) ? 'skipped' : 'done';
        else states[key] = waitingReason(p, key) ? 'waiting' : 'current';

        previousComplete = complete;
    });

    return states;
}

/** The first step that is not finished yet, or null when planning is complete or closed. */
export function activeStep(p: Project): StepKey | null {
    if (isNotProceeding(p)) return null;
    return STEPS.find(({ key }) => !isStepComplete(p, key))?.key ?? null;
}

export type ProjectStatus = 'In Progress' | 'Completed' | 'Not Proceeding';

export function projectStatus(p: Project): ProjectStatus {
    if (isNotProceeding(p)) return 'Not Proceeding';
    return activeStep(p) === null ? 'Completed' : 'In Progress';
}

/* ---------- sample data ---------- */

export const SAMPLE_SPECIALISTS: DesignSpecialist[] = [
    { id: 21, name: 'Camille Ocampo', activeProjects: 1 },
    { id: 22, name: 'Miguel Santiago', activeProjects: 3 },
    { id: 23, name: 'Trisha Valdez', activeProjects: 0 },
];

type SampleInput = Pick<Project, 'id' | 'code' | 'customer' | 'eventType' | 'eventDate' | 'venue'> & Partial<Project>;

/** Fills in the fields every sample shares, so each sample only lists what is different. */
function sample(p: SampleInput): Project {
    return {
        startTime: '15:00',
        endTime: '22:00',
        venueSetting: 'Indoor',
        guests: 150,
        budget: '₱100,000 – ₱250,000',
        description: 'Please see the selected services and theme.',
        services: [
            { id: 3, name: 'Photography Package', category: 'Photo & Video', price: 20000, unit: '' },
            { id: 5, name: 'Buffet Catering', category: 'Catering', price: 650, unit: 'pax' },
        ],
        theme: 'Rustic Garden',
        assets: [{ id: 'entrance-arch', name: 'Entrance Arch', category: 'Structures' }],
        files: [],
        layoutSnapshotUrl: null,
        submittedAt: '2026-10-15T10:00:00+08:00',
        status: 'Approved',
        decision: { remarks: 'Approved. Please book a consultation.', decidedBy: 'Project Manager', decidedAt: '2026-10-16T09:00:00+08:00' },
        consultation: null,
        reservationFee: { amount: 10000, paid: false },
        ocularVisitAt: null,
        siteAssessment: null,
        assignment: null,
        designProposal: null,
        contract: null,
        billings: [],
        payments: [],
        disputes: [],
        ...p,
    };
}

const consultation = (overrides: Partial<NonNullable<Project['consultation']>> = {}): Project['consultation'] => ({
    outcome: 'Completed',
    summary: 'Client confirmed the theme and the venue setup.',
    additionalNotes: null,
    ocularVisit: { required: true },
    decision: 'Proceed',
    decisionReason: null,
    recordedBy: 'Project Manager',
    recordedAt: '2026-10-25T15:00:00+08:00',
    ...overrides,
});

const siteAssessment = (assessedOn: string): SiteAssessment => ({
    assessedOn,
    findings: 'Ceiling height about 3.5 m. Power outlets on the east wall only.',
    report: { name: 'site-assessment-report.pdf', url: '', type: 'pdf' },
    photos: [
        { id: 1, name: 'venue-entrance.jpg', url: '' },
        { id: 2, name: 'stage-area.jpg', url: '' },
    ],
    recordedBy: 'Project Manager',
    recordedAt: `${assessedOn}T16:00:00+08:00`,
});

const assignment = (specialistId: number, specialistName: string): Assignment => ({
    specialistId,
    specialistName,
    notes: 'Follow the theme the client confirmed in the consultation.',
    assignedBy: 'Project Manager',
    assignedAt: '2026-11-05T10:00:00+08:00',
});

const proposal = (overrides: Partial<DesignProposal> = {}): DesignProposal => ({
    version: 1,
    status: 'Submitted',
    submittedBy: 'Camille Ocampo',
    submittedAt: '2026-11-10T15:30:00+08:00',
    notes: 'Pastel floral arch at the entrance, a backdrop for the 18 roses, and round tables with chiavari chairs.',
    layoutSnapshotUrl: null,
    file: { name: 'design-proposal.pdf', url: '' },
    quotation: null,
    review: null,
    ...overrides,
});

const approvedProposal = (total: number): DesignProposal =>
    proposal({
        status: 'Approved',
        submittedAt: '2026-11-06T10:00:00+08:00',
        quotation: {
            items: [
                { id: 'styling', description: 'Event styling and design package', quantity: 1, unitPrice: total - 15000 },
                { id: 'setup', description: 'Setup, logistics and teardown', quantity: 1, unitPrice: 15000 },
            ],
            discount: 0,
        },
        review: { decision: 'approve', remarks: null, reviewedBy: 'Project Manager', reviewedAt: '2026-11-07T10:00:00+08:00' },
    });

const SAMPLE_PROJECTS: Project[] = [
    // Step 1: consultation not recorded yet
    sample({
        id: 4,
        code: 'REQ-0004',
        customer: { name: 'Carmela Reyes', email: 'carmela.reyes@example.com', phone: '0920 555 1212' },
        eventType: 'Debut',
        eventDate: '2027-02-14',
        venue: 'Private residence, Antipolo City',
        venueSetting: 'Outdoor',
        guests: 120,
        theme: 'Pastel Garden',
    }),
    // Step 2: reservation fee paid, receipt ready to verify
    sample({
        id: 11,
        code: 'REQ-0011',
        customer: { name: 'Lara Gomez', email: 'lara.gomez@example.com', phone: '0917 222 8080' },
        eventType: 'Wedding',
        eventDate: '2027-04-10',
        venue: 'Hacienda Isabella, Indang, Cavite',
        venueSetting: 'Outdoor',
        guests: 200,
        consultation: consultation(),
        payments: [
            samplePayment({ id: 1, type: 'Reservation Fee', amount: 10000, submittedAt: '2026-11-12T19:40:00+08:00', referenceNo: '1009 482 337 1' }),
        ],
    }),
    // Step 2: reservation fee receipt is not a valid file (an earlier payment was rejected)
    sample({
        id: 16,
        code: 'REQ-0016',
        customer: { name: 'Paolo Cruz', email: 'paolo.cruz@example.com', phone: '0915 404 2020' },
        eventType: 'Birthday',
        eventDate: '2027-03-20',
        venue: 'Events Place, Makati City',
        guests: 80,
        consultation: consultation(),
        payments: [
            samplePayment({
                id: 2,
                type: 'Reservation Fee',
                amount: 10000,
                submittedAt: '2026-11-09T09:00:00+08:00',
                status: 'Rejected',
                review: {
                    remarks: 'The receipt shows ₱1,000, not ₱10,000. Please upload the correct receipt.',
                    reviewedBy: 'Project Manager',
                    reviewedAt: '2026-11-09T13:00:00+08:00',
                },
            }),
            samplePayment({
                id: 3,
                type: 'Reservation Fee',
                amount: 10000,
                method: 'Bank Transfer',
                referenceNo: 'BPI-55002871',
                submittedAt: '2026-11-13T16:22:00+08:00',
                receipt: { name: 'payment-details.docx', url: '' },
            }),
        ],
    }),
    // Step 3: fee paid and ocular visit booked, ready for the site assessment
    sample({
        id: 7,
        code: 'REQ-0007',
        customer: { name: 'Rafael Domingo', email: 'rafael.domingo@example.com', phone: '0998 111 2233' },
        eventType: 'Corporate',
        eventDate: '2027-01-22',
        venue: 'Okada Manila Grand Ballroom, Parañaque City',
        guests: 250,
        theme: 'Black and Gold Gala',
        consultation: consultation(),
        reservationFee: { amount: 15000, paid: true },
        ocularVisitAt: '2026-11-18T14:00',
    }),
    // Step 4: ready to assign a Design Specialist
    sample({
        id: 8,
        code: 'REQ-0008',
        customer: { name: 'Bea Navarro', email: 'bea.navarro@example.com', phone: '0918 444 5566' },
        eventType: 'Birthday',
        eventDate: '2026-12-12',
        venue: 'Function Room B, Ortigas Center, Pasig City',
        guests: 60,
        theme: 'Pastel Garden',
        consultation: consultation(),
        reservationFee: { amount: 5000, paid: true },
        ocularVisitAt: '2026-11-08T09:30',
        siteAssessment: siteAssessment('2026-11-08'),
    }),
    // Step 4: no ocular visit needed, so Site Assessment is skipped
    sample({
        id: 6,
        code: 'REQ-0006',
        customer: { name: 'Jessa Mendoza', email: 'jessa.mendoza@example.com', phone: '0927 888 0101' },
        eventType: 'Wedding',
        eventDate: '2027-03-06',
        venue: 'Tagaytay Highlands Garden, Tagaytay City',
        venueSetting: 'Outdoor',
        guests: 180,
        consultation: consultation({ ocularVisit: { required: false }, summary: 'Client has used this venue before; layout plans were provided.' }),
        reservationFee: { amount: 10000, paid: true },
    }),
    // Step 5: design proposal submitted, ready for review
    sample({
        id: 10,
        code: 'REQ-0010',
        customer: { name: 'Nina Aquino', email: 'nina.aquino@example.com', phone: '0905 333 9090' },
        eventType: 'Debut',
        eventDate: '2026-12-19',
        venue: 'Marco Polo Ortigas, Pasig City',
        theme: 'Pastel Garden',
        consultation: consultation(),
        reservationFee: { amount: 10000, paid: true },
        ocularVisitAt: '2026-11-02T10:00',
        siteAssessment: siteAssessment('2026-11-02'),
        assignment: assignment(21, 'Camille Ocampo'),
        designProposal: proposal(),
    }),
    // Step 6: signed contract submitted, for review
    sample({
        id: 12,
        code: 'REQ-0012',
        customer: { name: 'Rico Bautista', email: 'rico.bautista@example.com', phone: '0919 777 1212' },
        eventType: 'Corporate',
        eventDate: '2027-01-29',
        venue: 'SMX Convention Center, Pasay City',
        guests: 300,
        theme: 'Black and Gold Gala',
        consultation: consultation(),
        reservationFee: { amount: 15000, paid: true },
        ocularVisitAt: '2026-10-28T13:00',
        siteAssessment: siteAssessment('2026-10-28'),
        assignment: assignment(22, 'Miguel Santiago'),
        designProposal: approvedProposal(185000),
        contract: {
            code: 'CON-0012',
            version: 1,
            amount: 185000,
            file: { name: 'CON-0012_Bautista_signed.pdf', url: '' },
            submittedAt: '2026-11-11T09:30:00+08:00',
            status: 'For Review',
            review: null,
        },
    }),
    // Step 6: contract rejected, waiting for the customer to re-submit
    sample({
        id: 9,
        code: 'REQ-0009',
        customer: { name: 'Kevin Tan', email: 'kevin.tan@example.com', phone: '0916 222 3434' },
        eventType: 'Debut',
        eventDate: '2027-02-27',
        venue: 'The Blue Leaf Pavilion, Taguig City',
        consultation: consultation(),
        reservationFee: { amount: 10000, paid: true },
        ocularVisitAt: '2026-10-20T10:00',
        siteAssessment: siteAssessment('2026-10-20'),
        assignment: assignment(21, 'Camille Ocampo'),
        designProposal: approvedProposal(142000),
        contract: {
            code: 'CON-0009',
            version: 1,
            amount: 142000,
            file: { name: 'CON-0009_Tan_signed.pdf', url: '' },
            submittedAt: '2026-11-07T11:20:00+08:00',
            status: 'Rejected',
            review: {
                remarks: 'Page 3 is missing the customer signature. Please sign every page and upload the contract again.',
                checklist: ['details', 'amount', 'complete'],
                reviewedBy: 'Project Manager',
                reviewedAt: '2026-11-08T08:50:00+08:00',
            },
        },
    }),
    // Planning completed: contract verified and every billing paid
    sample({
        id: 13,
        code: 'REQ-0013',
        customer: { name: 'Grace Lim', email: 'grace.lim@example.com', phone: '0917 909 1010' },
        eventType: 'Wedding',
        eventDate: '2026-12-28',
        venue: 'Manila Cathedral and Bayleaf Intramuros, Manila',
        consultation: consultation(),
        reservationFee: { amount: 15000, paid: true },
        ocularVisitAt: '2026-10-10T09:00',
        siteAssessment: siteAssessment('2026-10-10'),
        assignment: assignment(23, 'Trisha Valdez'),
        designProposal: approvedProposal(298000),
        contract: {
            code: 'CON-0013',
            version: 1,
            amount: 298000,
            file: { name: 'CON-0013_Lim_signed.pdf', url: '' },
            submittedAt: '2026-11-03T15:00:00+08:00',
            status: 'Approved',
            review: {
                remarks: null,
                checklist: ['signed', 'details', 'amount', 'complete'],
                reviewedBy: 'Project Manager',
                reviewedAt: '2026-11-04T10:00:00+08:00',
            },
        },
        billings: [
            { id: 1, type: 'Down Payment', amount: 149000, issuedAt: '2026-11-04T10:05:00+08:00' },
            { id: 2, type: 'Final Payment', amount: 149000, issuedAt: '2026-11-04T10:05:00+08:00' },
        ],
        payments: [
            samplePayment({ id: 4, type: 'Reservation Fee', amount: 15000, submittedAt: '2026-10-05T09:10:00+08:00', status: 'Verified', review: verified('2026-10-05T13:00:00+08:00') }),
            samplePayment({
                id: 5,
                billingId: 1,
                type: 'Down Payment',
                amount: 149000,
                method: 'Bank Transfer',
                referenceNo: 'BPI-44120933',
                submittedAt: '2026-11-05T11:00:00+08:00',
                receipt: { name: 'bpi-downpayment.pdf', url: '' },
                status: 'Verified',
                review: verified('2026-11-05T15:30:00+08:00'),
            }),
            samplePayment({
                id: 6,
                billingId: 2,
                type: 'Final Payment',
                amount: 149000,
                method: 'Bank Transfer',
                referenceNo: 'BPI-46001288',
                submittedAt: '2026-11-12T10:00:00+08:00',
                receipt: { name: 'bpi-finalpayment.pdf', url: '' },
                status: 'Verified',
                review: verified('2026-11-12T14:00:00+08:00'),
            }),
        ],
                disputes: [
            {
                id: 1,
                code: 'DSP-0001',
                billingId: 1,
                reason: 'The down payment should only be 40% of the contract.',
                submittedAt: '2026-11-04T15:00:00+08:00',
                status: 'Resolved',
                reviewedAt: '2026-11-04T16:00:00+08:00',
                resolution: {
                    decision: 'Rejected',
                    remarks: 'The signed contract states a 50% down payment. The bill stays at ₱149,000.',
                    previousAmount: 149000,
                    newAmount: 149000,
                    resolvedBy: 'Project Manager',
                    resolvedAt: '2026-11-04T16:30:00+08:00',
                },
            },
        ],
    }),
    // Step 7: contract approved; down payment submitted without a receipt, final payment not paid yet
    sample({
        id: 15,
        code: 'REQ-0015',
        customer: { name: 'Mika Santos', email: 'mika.santos@example.com', phone: '0917 515 1515' },
        eventType: 'Wedding',
        eventDate: '2027-01-16',
        venue: 'Shangri-La The Fort, Taguig City',
        consultation: consultation(),
        reservationFee: { amount: 10000, paid: true },
        ocularVisitAt: '2026-10-14T10:00',
        siteAssessment: siteAssessment('2026-10-14'),
        assignment: assignment(22, 'Miguel Santiago'),
        designProposal: approvedProposal(220000),
        contract: {
            code: 'CON-0015',
            version: 1,
            amount: 220000,
            file: { name: 'CON-0015_Santos_signed.pdf', url: '' },
            submittedAt: '2026-11-08T09:00:00+08:00',
            status: 'Approved',
            review: {
                remarks: null,
                checklist: ['signed', 'details', 'amount', 'complete'],
                reviewedBy: 'Project Manager',
                reviewedAt: '2026-11-09T10:00:00+08:00',
            },
        },
        billings: [
            { id: 3, type: 'Down Payment', amount: 110000, issuedAt: '2026-11-09T10:05:00+08:00' },
            { id: 4, type: 'Final Payment', amount: 110000, issuedAt: '2026-11-09T10:05:00+08:00' },
        ],
        payments: [
            samplePayment({ id: 7, type: 'Reservation Fee', amount: 10000, submittedAt: '2026-10-08T09:00:00+08:00', status: 'Verified', review: verified('2026-10-08T12:00:00+08:00') }),
            samplePayment({
                id: 8,
                billingId: 3,
                type: 'Down Payment',
                amount: 110000,
                method: 'Bank Transfer',
                referenceNo: 'BDO-88213409',
                submittedAt: '2026-11-13T10:05:00+08:00',
                receipt: null,
            }),
        ],
                disputes: [
            {
                id: 2,
                code: 'DSP-0002',
                billingId: 4,
                reason: 'The final payment should be ₱100,000. We removed the photo booth during the consultation, but it is still included.',
                submittedAt: '2026-11-13T18:30:00+08:00',
                status: 'Submitted',
                reviewedAt: null,
                resolution: null,
            },
        ],
    }),
    // Not proceeding: closed at the consultation
    sample({
        id: 14,
        code: 'REQ-0014',
        customer: { name: 'Ana Villareal', email: 'ana.villareal@example.com', phone: '0921 555 6767' },
        eventType: 'Birthday',
        eventDate: '2026-12-20',
        venue: 'Clubhouse, Quezon City',
        consultation: consultation({
            outcome: 'Completed',
            decision: 'Do not proceed',
            decisionReason: 'The client decided to postpone the event to next year.',
        }),
    }),
];

/*
 * A small in-memory store for the sample data, so changes made in the wizard still
 * show on the Projects list while you move between pages (until the browser refreshes).
 */
let sampleStore = SAMPLE_PROJECTS;

export const getSampleProjects = () => sampleStore;

export const getSampleProject = (id: number) => sampleStore.find((p) => p.id === id) ?? null;

export function saveSampleProject(project: Project) {
    sampleStore = sampleStore.map((p) => (p.id === project.id ? project : p));
}