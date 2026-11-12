/*
 * Design assignments: types + sample data (backlog #21).
 *
 * Before a Design Specialist can prepare the design proposal, the project's information
 * must be complete. A project is ready when its consultation says "Proceed" (backlog #16),
 * its signed contract is approved (backlog #18) and its site assessment is done (backlog #20).
 *
 * SAMPLE_* data is only used while the backend is not ready yet.
 * Once the controller sends `projects` and `specialists` props, the page uses those instead.
 */

/** The information a project needs before it can be assigned, and where to complete each one. */
export const READINESS_ITEMS = [
    { key: 'consultation', label: 'Consultation recorded with decision "Proceed"', page: '/project-manager/consultations', pageName: 'Consultations' },
    { key: 'contract', label: 'Signed contract approved', page: '/project-manager/contracts', pageName: 'Contracts' },
    { key: 'siteAssessment', label: 'Site assessment report uploaded', page: '/project-manager/site-assessments', pageName: 'Site Assessments' },
] as const;

export type ReadinessKey = (typeof READINESS_ITEMS)[number]['key'];

export type DesignSpecialist = {
    id: number;
    name: string;
    activeProjects: number; // how many projects they are currently designing
};

export type Assignment = {
    specialistId: number;
    specialistName: string;
    notes: string | null; // instructions for the designer
    assignedBy: string;
    assignedAt: string; // ISO date-time
};

export type AssignmentProject = {
    id: number;
    code: string; // e.g. "REQ-0006"
    customerName: string;
    eventType: string;
    eventDate: string; // 'YYYY-MM-DD'
    venue: string;
    guests: number | null;
    theme: string | null;
    readiness: Record<ReadinessKey, boolean>;
    assignment: Assignment | null; // null until a Design Specialist is assigned
};

/** True when every required piece of project information is complete. */
export const isReady = (p: AssignmentProject) => READINESS_ITEMS.every((item) => p.readiness[item.key]);

export const SAMPLE_SPECIALISTS: DesignSpecialist[] = [
    { id: 21, name: 'Camille Ocampo', activeProjects: 1 },
    { id: 22, name: 'Miguel Santiago', activeProjects: 3 },
    { id: 23, name: 'Trisha Valdez', activeProjects: 0 },
];

export const SAMPLE_ASSIGNMENT_PROJECTS: AssignmentProject[] = [
    {
        id: 8,
        code: 'REQ-0008',
        customerName: 'Bea Navarro',
        eventType: 'Birthday',
        eventDate: '2026-12-12',
        venue: 'Function Room B, Ortigas Center, Pasig City',
        guests: 60,
        theme: 'Pastel Garden',
        readiness: { consultation: true, contract: true, siteAssessment: true },
        assignment: null,
    },
    {
        id: 7,
        code: 'REQ-0007',
        customerName: 'Rafael Domingo',
        eventType: 'Corporate',
        eventDate: '2027-01-22',
        venue: 'Okada Manila Grand Ballroom, Parañaque City',
        guests: 250,
        theme: 'Black and Gold Gala',
        readiness: { consultation: true, contract: true, siteAssessment: false },
        assignment: null,
    },
    {
        id: 6,
        code: 'REQ-0006',
        customerName: 'Jessa Mendoza',
        eventType: 'Wedding',
        eventDate: '2027-03-06',
        venue: 'Tagaytay Highlands Garden, Tagaytay City',
        guests: 180,
        theme: 'Rustic Garden',
        readiness: { consultation: true, contract: false, siteAssessment: false },
        assignment: null,
    },
    {
        id: 10,
        code: 'REQ-0010',
        customerName: 'Nina Aquino',
        eventType: 'Debut',
        eventDate: '2026-12-19',
        venue: 'Marco Polo Ortigas, Pasig City',
        guests: 150,
        theme: 'Pastel Garden',
        readiness: { consultation: true, contract: true, siteAssessment: true },
        assignment: {
            specialistId: 21,
            specialistName: 'Camille Ocampo',
            notes: 'Client wants a floral ceiling over the 18 roses area.',
            assignedBy: 'Project Manager',
            assignedAt: '2026-11-09T10:15:00+08:00',
        },
    },
];