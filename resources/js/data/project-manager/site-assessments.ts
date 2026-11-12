/*
 * Site assessments: types + sample data (backlog #20).
 *
 * After the ocular visit (set during the consultation, backlog #16), the Project Manager
 * uploads the site assessment report and venue photos. These become part of the
 * project's specifications, so the designers have complete information.
 *
 * SAMPLE_ASSESSMENT_PROJECTS is only used while the backend is not ready yet.
 * Once the controller sends a `projects` prop, the page uses that instead.
 */

/** File types the report may be. */
export const REPORT_EXTENSIONS = ['pdf', 'docx'] as const;
export const REPORT_MAX_MB = 10;

/** File types and size allowed for venue photos. */
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

/** A project that can proceed (from the consultation) and needs a site assessment. */
export type AssessmentProject = {
    id: number;
    code: string; // the project's request number, e.g. "REQ-0006"
    customerName: string;
    eventType: string;
    eventDate: string; // 'YYYY-MM-DD'
    venue: string;
    venueSetting: 'Indoor' | 'Outdoor';
    ocularVisitAt: string | null; // 'YYYY-MM-DDTHH:mm' from the consultation, if one was scheduled
    assessment: SiteAssessment | null; // null until the Project Manager records it
};

export const SAMPLE_ASSESSMENT_PROJECTS: AssessmentProject[] = [
    {
        id: 6,
        code: 'REQ-0006',
        customerName: 'Jessa Mendoza',
        eventType: 'Wedding',
        eventDate: '2027-03-06',
        venue: 'Tagaytay Highlands Garden, Tagaytay City',
        venueSetting: 'Outdoor',
        ocularVisitAt: '2026-11-21T10:00',
        assessment: null,
    },
    {
        id: 7,
        code: 'REQ-0007',
        customerName: 'Rafael Domingo',
        eventType: 'Corporate',
        eventDate: '2027-01-22',
        venue: 'Okada Manila Grand Ballroom, Parañaque City',
        venueSetting: 'Indoor',
        ocularVisitAt: '2026-11-18T14:00',
        assessment: null,
    },
    {
        id: 8,
        code: 'REQ-0008',
        customerName: 'Bea Navarro',
        eventType: 'Birthday',
        eventDate: '2026-12-12',
        venue: 'Function Room B, Ortigas Center, Pasig City',
        venueSetting: 'Indoor',
        ocularVisitAt: '2026-11-08T09:30',
        assessment: {
            assessedOn: '2026-11-08',
            findings: 'Ceiling height about 3.5 m. Power outlets on the east wall only. Loading entrance at the back, freight elevator available until 6 PM.',
            report: { name: 'REQ-0008_site-assessment.pdf', url: '', type: 'pdf' },
            photos: [
                { id: 1, name: 'function-room-entrance.jpg', url: '' },
                { id: 2, name: 'stage-area.jpg', url: '' },
                { id: 3, name: 'east-wall-outlets.jpg', url: '' },
            ],
            recordedBy: 'Project Manager',
            recordedAt: '2026-11-08T15:40:00+08:00',
        },
    },
];