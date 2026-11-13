/*
 * Project requests: types + sample data.
 *
 * The types describe ONE project request exactly as the Project Manager page
 * expects to receive it from Laravel. The fields mirror what the customer fills in
 * on the "Request New Project" form (components/customer/project-request-form.tsx).
 *
 * SAMPLE_PROJECT_REQUESTS is only used while the backend is not ready yet.
 * Once the controller sends a `requests` prop, the page uses that instead.
 */

export type RequestStatus = 'Pending' | 'Approved' | 'Rejected';

/* ---------- consultation (backlog #16) ---------- */

export const CONSULTATION_OUTCOMES = ['Completed', 'Rescheduled', 'Customer did not attend'] as const;
export type ConsultationOutcome = (typeof CONSULTATION_OUTCOMES)[number];

export const PROJECT_DECISIONS = ['Proceed', 'Do not proceed'] as const;
export type ProjectDecision = (typeof PROJECT_DECISIONS)[number];

// Same budget ranges the customer chooses from on the request form.
export const BUDGET_RANGES = [
    'Below ₱50,000',
    '₱50,000 – ₱100,000',
    '₱100,000 – ₱250,000',
    '₱250,000 – ₱500,000',
    'Above ₱500,000',
];

export type Consultation = {
    outcome: ConsultationOutcome;
    summary: string; // what was discussed
    additionalNotes: string | null; // extra project details from the consultation
    ocularVisit: {
        required: boolean; // the customer books the actual date after paying the reservation fee
    };
    decision: ProjectDecision;
    decisionReason: string | null; // required when the decision is "Do not proceed"
    recordedBy: string;
    recordedAt: string; // ISO date-time
};

export type RequestedService = {
    id: number;
    name: string;
    category: string;
    price: number;
    unit: string; // '' for a flat price, 'pax' for per-guest pricing
};

export type ReferenceFile = {
    id: number;
    name: string;
    type: 'image' | 'pdf';
    url: string; // served through the app (private Supabase Storage)
};

export type ProjectRequest = {
    id: number;
    code: string; // shown to people, e.g. "REQ-0012"
    customer: {
        name: string;
        email: string;
        phone: string | null;
    };
    eventType: string; // Corporate, Wedding, Birthday, Debut, Mall Activation
    eventDate: string; // 'YYYY-MM-DD'
    startTime: string; // 'HH:mm' (24-hour)
    endTime: string; // 'HH:mm' (24-hour)
    venue: string;
    venueSetting: 'Indoor' | 'Outdoor';
    guests: number | null; // null for Mall Activation (no guest count)
    budget: string; // the budget range the customer picked
    description: string;
    services: RequestedService[];
    theme: string | null;
    assets: { id: string; name: string; category: string }[];
    files: ReferenceFile[];
    layoutSnapshotUrl: string | null; // image of the preliminary 2D layout the customer saw; null if not available
    submittedAt: string; // ISO date-time
    status: RequestStatus;
    decision: {
        remarks: string | null;
        decidedBy: string;
        decidedAt: string; // ISO date-time
    } | null; // null while the request is still Pending
    consultation: Consultation | null; // null until the Project Manager records the consultation
};

export const SAMPLE_PROJECT_REQUESTS: ProjectRequest[] = [
    {
        id: 1,
        code: 'REQ-0001',
        customer: { name: 'Andrea Santos', email: 'andrea.santos@example.com', phone: '0917 123 4567' },
        eventType: 'Wedding',
        eventDate: '2027-01-16',
        startTime: '14:00',
        endTime: '22:00',
        venue: 'Grand Palace Events Hall, Quezon City',
        venueSetting: 'Indoor',
        guests: 150,
        budget: '₱250,000 – ₱500,000',
        description:
            'Rustic garden wedding with warm lighting. We would like an entrance arch with flowers and a backdrop for the couple’s table.',
        services: [
            { id: 3, name: 'Photography Package', category: 'Photo & Video', price: 20000, unit: '' },
            { id: 4, name: 'Videography Package', category: 'Photo & Video', price: 25000, unit: '' },
            { id: 5, name: 'Buffet Catering', category: 'Catering', price: 650, unit: 'pax' },
            { id: 6, name: 'Host / Emcee Services', category: 'Host', price: 5000, unit: '' },
        ],
        theme: 'Rustic Garden',
        assets: [
            { id: 'entrance-arch', name: 'Entrance Arch', category: 'Structures' },
            { id: 'backdrop-panel', name: 'Backdrop Panel', category: 'Structures' },
            { id: 'chiavari-chair', name: 'Chiavari Chairs', category: 'Furniture' },
        ],
        files: [
            { id: 1, name: 'arch-inspiration.jpg', type: 'image', url: '#' },
            { id: 2, name: 'seating-plan.pdf', type: 'pdf', url: '#' },
        ],
        layoutSnapshotUrl: null,
        submittedAt: '2026-11-08T09:24:00+08:00',
        status: 'Pending',
        decision: null,
        consultation: null,
    },
    {
        id: 2,
        code: 'REQ-0002',
        customer: { name: 'Mark Villanueva', email: 'mark.v@example.com', phone: '0998 765 4321' },
        eventType: 'Corporate',
        eventDate: '2026-12-18',
        startTime: '17:00',
        endTime: '23:00',
        venue: 'Makati Shangri-La, Makati City',
        venueSetting: 'Indoor',
        guests: 200,
        budget: '₱100,000 – ₱250,000',
        description: 'Year-end party for our company. Black and gold motif, with a stage for awarding.',
        services: [
            { id: 1, name: 'DJ Services', category: 'Entertainment', price: 15000, unit: '' },
            { id: 2, name: 'Photobooth Rental', category: 'Entertainment', price: 8000, unit: '' },
            { id: 6, name: 'Host / Emcee Services', category: 'Host', price: 5000, unit: '' },
        ],
        theme: 'Black and Gold Gala',
        assets: [
            { id: 'backdrop-panel', name: 'Backdrop Panel', category: 'Structures' },
            { id: 'cocktail-table', name: 'Cocktail Tables', category: 'Furniture' },
        ],
        files: [],
        layoutSnapshotUrl: null,
        submittedAt: '2026-11-09T15:02:00+08:00',
        status: 'Pending',
        decision: null,
        consultation: null,
    },
    {
        id: 3,
        code: 'REQ-0003',
        customer: { name: 'Liza Ramos', email: 'liza.ramos@example.com', phone: null },
        eventType: 'Mall Activation',
        eventDate: '2026-12-26',
        startTime: '10:00',
        endTime: '20:00',
        venue: 'SM Mall of Asia, Pasay City',
        venueSetting: 'Indoor',
        guests: null,
        budget: '₱50,000 – ₱100,000',
        description: 'Holiday product booth for a skincare brand. Needs a photo spot for shoppers.',
        services: [{ id: 2, name: 'Photobooth Rental', category: 'Entertainment', price: 8000, unit: '' }],
        theme: null,
        assets: [{ id: 'backdrop-panel', name: 'Backdrop Panel', category: 'Structures' }],
        files: [{ id: 3, name: 'brand-guidelines.pdf', type: 'pdf', url: '#' }],
        layoutSnapshotUrl: null,
        submittedAt: '2026-11-10T08:45:00+08:00',
        status: 'Pending',
        decision: null,
        consultation: null,
    },
    {
        id: 4,
        code: 'REQ-0004',
        customer: { name: 'Carmela Reyes', email: 'carmela.reyes@example.com', phone: '0920 555 1212' },
        eventType: 'Debut',
        eventDate: '2027-02-14',
        startTime: '18:00',
        endTime: '23:30',
        venue: 'Private residence, Antipolo City',
        venueSetting: 'Outdoor',
        guests: 120,
        budget: '₱100,000 – ₱250,000',
        description: 'Pastel garden debut with fairy lights.',
        services: [
            { id: 1, name: 'DJ Services', category: 'Entertainment', price: 15000, unit: '' },
            { id: 3, name: 'Photography Package', category: 'Photo & Video', price: 20000, unit: '' },
        ],
        theme: 'Pastel Garden',
        assets: [{ id: 'entrance-arch', name: 'Entrance Arch', category: 'Structures' }],
        files: [],
        layoutSnapshotUrl: null,
        submittedAt: '2026-11-03T11:10:00+08:00',
        status: 'Approved',
        decision: {
            remarks: 'Requirements are complete. Please book a consultation.',
            decidedBy: 'Project Manager',
            decidedAt: '2026-11-04T10:00:00+08:00',
        },
        consultation: null,
    },
    {
        id: 5,
        code: 'REQ-0005',
        customer: { name: 'Paolo Cruz', email: 'paolo.cruz@example.com', phone: '0915 222 3344' },
        eventType: 'Birthday',
        eventDate: '2026-12-05',
        startTime: '13:00',
        endTime: '19:00',
        venue: 'Clubhouse, Pasig City',
        venueSetting: 'Indoor',
        guests: 400,
        budget: 'Below ₱50,000',
        description: '7th birthday party with a superhero theme.',
        services: [
            { id: 5, name: 'Buffet Catering', category: 'Catering', price: 650, unit: 'pax' },
            { id: 1, name: 'DJ Services', category: 'Entertainment', price: 15000, unit: '' },
        ],
        theme: null,
        assets: [],
        files: [],
        layoutSnapshotUrl: null,
        submittedAt: '2026-11-01T16:30:00+08:00',
        status: 'Rejected',
        decision: {
            remarks: 'The budget cannot cover catering for 400 guests. Please adjust the guest count or budget and submit a new request.',
            decidedBy: 'Project Manager',
            decidedAt: '2026-11-02T09:15:00+08:00',
        },
        consultation: null,
    },
    {
        id: 6,
        code: 'REQ-0006',
        customer: { name: 'Jessa Mendoza', email: 'jessa.mendoza@example.com', phone: '0927 888 0101' },
        eventType: 'Wedding',
        eventDate: '2027-03-06',
        startTime: '15:00',
        endTime: '23:00',
        venue: 'Tagaytay Highlands Garden, Tagaytay City',
        venueSetting: 'Outdoor',
        guests: 180,
        budget: '₱250,000 – ₱500,000',
        description: 'Garden wedding with a white and sage green palette.',
        services: [
            { id: 3, name: 'Photography Package', category: 'Photo & Video', price: 20000, unit: '' },
            { id: 5, name: 'Buffet Catering', category: 'Catering', price: 650, unit: 'pax' },
        ],
        theme: 'Rustic Garden',
        assets: [
            { id: 'entrance-arch', name: 'Entrance Arch', category: 'Structures' },
            { id: 'chiavari-chair', name: 'Chiavari Chairs', category: 'Furniture' },
        ],
        files: [],
        layoutSnapshotUrl: null,
        submittedAt: '2026-10-20T13:40:00+08:00',
        status: 'Approved',
        decision: {
            remarks: 'Approved. Please book a consultation.',
            decidedBy: 'Project Manager',
            decidedAt: '2026-10-21T09:00:00+08:00',
        },
        consultation: {
            outcome: 'Completed',
            summary: 'Client confirmed the garden setup and asked for a rain plan with a tent.',
            additionalNotes: 'Add a tent as backup in case of rain. Guest count raised to 180.',
            ocularVisit: { required: true },
            decision: 'Proceed',
            decisionReason: null,
            recordedBy: 'Project Manager',
            recordedAt: '2026-10-28T16:20:00+08:00',
        },
    },
];
