/*
 * Signed project contracts: types + sample data (backlog #18).
 *
 * After a project is set to "Proceed", the customer signs the contract and uploads it.
 * The Project Manager then verifies it and approves or rejects it.
 *
 * SAMPLE_CONTRACTS is only used while the backend is not ready yet.
 * Once the controller sends a `contracts` prop, the page uses that instead.
 */

export type ContractStatus = 'For Review' | 'Approved' | 'Rejected';

/** What the Project Manager must confirm before a contract can be approved. */
export const CONTRACT_CHECKLIST = [
    { id: 'signed', label: 'Signed by the customer on every signature line' },
    { id: 'details', label: 'Project details match the approved project (event date, venue, services)' },
    { id: 'amount', label: 'Contract amount and payment terms match the quotation' },
    { id: 'complete', label: 'All pages are complete and readable' },
] as const;

export type ChecklistId = (typeof CONTRACT_CHECKLIST)[number]['id'];

export type Contract = {
    id: number;
    code: string; // e.g. "CON-0001"
    version: number; // 1 for the first upload, 2 after the customer re-submits a rejected one, and so on
    project: {
        id: number;
        code: string; // the project's request number, e.g. "REQ-0006"
        customerName: string;
        eventType: string;
        eventDate: string; // 'YYYY-MM-DD'
        venue: string;
    };
    amount: number; // contract amount in pesos
    file: {
        name: string;
        url: string; // served through the app (private Supabase Storage)
    };
    submittedAt: string; // ISO date-time
    status: ContractStatus;
    review: {
        remarks: string | null; // required when rejected
        checklist: ChecklistId[]; // which items were confirmed
        reviewedBy: string;
        reviewedAt: string; // ISO date-time
    } | null; // null while the contract is still For Review
};

export const SAMPLE_CONTRACTS: Contract[] = [
    {
        id: 1,
        code: 'CON-0001',
        version: 1,
        project: {
            id: 6,
            code: 'REQ-0006',
            customerName: 'Jessa Mendoza',
            eventType: 'Wedding',
            eventDate: '2027-03-06',
            venue: 'Tagaytay Highlands Garden, Tagaytay City',
        },
        amount: 337000,
        file: { name: 'CON-0001_Mendoza_signed.pdf', url: '#' },
        submittedAt: '2026-11-10T14:05:00+08:00',
        status: 'For Review',
        review: null,
    },
    {
        id: 2,
        code: 'CON-0002',
        version: 2,
        project: {
            id: 7,
            code: 'REQ-0007',
            customerName: 'Rafael Domingo',
            eventType: 'Corporate',
            eventDate: '2027-01-22',
            venue: 'Okada Manila Grand Ballroom, Parañaque City',
        },
        amount: 185000,
        file: { name: 'CON-0002_Domingo_signed_v2.pdf', url: '#' },
        submittedAt: '2026-11-11T09:30:00+08:00',
        status: 'For Review',
        review: null,
    },
    {
        id: 3,
        code: 'CON-0003',
        version: 1,
        project: {
            id: 8,
            code: 'REQ-0008',
            customerName: 'Bea Navarro',
            eventType: 'Birthday',
            eventDate: '2026-12-12',
            venue: 'Function Room B, Ortigas Center, Pasig City',
        },
        amount: 68000,
        file: { name: 'CON-0003_Navarro_signed.pdf', url: '#' },
        submittedAt: '2026-11-05T16:45:00+08:00',
        status: 'Approved',
        review: {
            remarks: null,
            checklist: ['signed', 'details', 'amount', 'complete'],
            reviewedBy: 'Project Manager',
            reviewedAt: '2026-11-06T10:10:00+08:00',
        },
    },
    {
        id: 4,
        code: 'CON-0004',
        version: 1,
        project: {
            id: 9,
            code: 'REQ-0009',
            customerName: 'Kevin Tan',
            eventType: 'Debut',
            eventDate: '2027-02-27',
            venue: 'The Blue Leaf Pavilion, Taguig City',
        },
        amount: 142000,
        file: { name: 'CON-0004_Tan_signed.pdf', url: '#' },
        submittedAt: '2026-11-07T11:20:00+08:00',
        status: 'Rejected',
        review: {
            remarks: 'Page 3 is missing the customer signature. Please sign every page and upload the contract again.',
            checklist: ['details', 'amount', 'complete'],
            reviewedBy: 'Project Manager',
            reviewedAt: '2026-11-08T08:50:00+08:00',
        },
    },
];