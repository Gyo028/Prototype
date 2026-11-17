/**
 * Types and helpers for the customer's My Projects pages.
 * The shapes match what Customer\ProjectController sends.
 */

import type { PillTone } from '@/components/dashboard/ui';

export type RequestType = 'standard' | 'custom';

export type ProjectStatusInfo = {
    name: string; // sub-status, e.g. "Designing"
    phase: string; // "Planning" | "Execution" | "Closed"
    onHold: boolean;
    terminal: boolean;
};

/** One row of My Projects: a submitted request, with its project once approved. */
export type ProjectListItem = {
    requestId: number;
    requestCode: string;
    projectId: number | null;
    projectCode: string | null;
    title: string;
    requestType: RequestType;
    startDate: string;
    endDate: string;
    startTime: string | null;
    endTime: string | null;
    venue: string;
    requestStatus: 'pending' | 'approved' | 'rejected';
    requestDate: string;
    status: ProjectStatusInfo | null;
    nextAction: NextAction | null;
};

/** The "What to do now" line. actionNeeded = the customer has something to do. */
export type NextAction = {
    title: string;
    detail: string;
    actionNeeded: boolean;
};

export type StepKey = 'consultation' | 'reservation_fee' | 'ocular_visit' | 'design' | 'contract' | 'fabrication' | 'installation' | 'completed';
export type StepState = 'done' | 'current' | 'locked' | 'skipped' | 'cancelled';

/** One step of the project timeline, worked out on the server (ProjectProgress). */
export type Step = {
    key: StepKey;
    label: string;
    phase: 'planning' | 'execution' | 'closed';
    description: string;
    state: StepState;
    note: string | null; // e.g. "Held Nov 23", "₱25,000", "Not needed" (under the step in the timeline)
    summary: string | null; // the folded card's line, e.g. "Held Oct 2 · You decided to proceed"
    details: { label: string; value: string }[]; // rows on the open card
};

export const PHASE_LABELS: Record<Step['phase'], string> = {
    planning: 'Planning',
    execution: 'Execution',
    closed: 'Closed',
};

export type MeetingMode = 'online' | 'face_to_face';

export type VenueOwnership = 'own_property' | 'third_party';

export const VENUE_OWNERSHIPS: { value: VenueOwnership; label: string; hint: string }[] = [
    { value: 'own_property', label: 'My own property', hint: 'Your home or a place you own. No documents needed.' },
    { value: 'third_party', label: 'Rented or third-party venue', hint: 'Hotel, mall, events place or any venue you rent.' },
];

/** A booked, held or earlier consultation or ocular visit. */
export type AppointmentSchedule = {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    meetingMode: MeetingMode | null;
    venueOwnership: VenueOwnership | null; // ocular visits only
    status: 'pending' | 'tentative' | 'confirmed' | 'completed' | 'cancelled';
    remarks: string | null;
    changedBy: string | null; // "You", "Project Manager", ...
};

export type ConsultationSchedule = AppointmentSchedule;

export type ConsultationInfo = {
    current: ConsultationSchedule | null;
    history: ConsultationSchedule[];
    canBook: boolean;
    bookingBlockedReason: string | null;
    canChange: boolean;
    changeBlockedReason: string | null;
};

/** Booking rules for an appointment (AppointmentScheduler::rules on the server). */
export type AppointmentRules = {
    earliestDate: string;
    latestDate: string;
    leadDays: number;
    changeCutoffDays: number;
    slotTimes: string[]; // start times, e.g. ['09:00', '10:00', …] or ['09:00', '11:00', …]
    slotMinutes: number;
    reasonMax: number;
};

export type ConsultationRules = AppointmentRules;

/* ---------- ocular visit (Plan Project step 3) ---------- */

export type OutcomeFile = {
    id: number;
    name: string;
    extension: string;
    viewable: boolean; // PDF and images open in the browser; DOCX/XLSX download
    url: string;
};

/** The site assessment the Project Manager recorded after the visit. */
export type SiteAssessment = {
    visitDate: string;
    notes: string | null;
    recordedAt: string;
    recordedBy: string;
    report: OutcomeFile | null;
    photos: OutcomeFile[];
    attachments: OutcomeFile[];
};

export type SiteAccessFile = {
    id: number;
    name: string;
    viewable: boolean;
    url: string;
    status: 'submitted' | 'approved' | 'rejected';
    remarks: string | null; // the reason, when rejected
    uploadedAt: string; // 'YYYY-MM-DD HH:mm'
    reviewedAt: string | null;
    replacedAt: string | null;
};

/** The authorization letter or the venue permit: the current file and the ones it replaced. */
export type SiteAccessDocument = {
    type: 'authorization_letter' | 'venue_permit';
    label: string;
    current: SiteAccessFile | null;
    history: SiteAccessFile[];
};

export type OcularVisitInfo = {
    required: boolean | null; // from the consultation outcome
    current: AppointmentSchedule | null;
    history: AppointmentSchedule[];
    canBook: boolean;
    bookingBlockedReason: string | null;
    canChange: boolean;
    changeBlockedReason: string | null;
    assessment: SiteAssessment | null;
    documents: SiteAccessDocument[];
    canUploadDocuments: boolean;
    documentRules: { maxMb: number; types: string[] };
    availableSlots: Record<string, string[]>;
    rules: AppointmentRules;
};

export type ProjectDetail = {
    id: number;
    requestId: number;
    code: string;
    requestCode: string;
    title: string;
    requestType: RequestType;
    startDate: string;
    endDate: string;
    startTime: string | null;
    endTime: string | null;
    venue: string;
    guests: number | null;
    budgetMin: number;
    budgetMax: number | null;
    status: ProjectStatusInfo;
    decision: 'proceed' | 'hold' | 'cancelled' | null;
};

/* ---------- reservation fee (Plan Project step 2) ---------- */

export type ReservationPayment = {
    id: number;
    amount: number;
    reference: string;
    paymentDate: string;
    submittedAt: string; // 'YYYY-MM-DD HH:mm'
    method: 'gcash' | 'cash' | 'cheque';
    status: 'submitted' | 'verified' | 'rejected';
    remarks: string | null; // the reason, when rejected
    verifiedAt: string | null;
    receiptName: string | null;
    receiptUrl: string | null;
};

export type ReservationFeeInfo = {
    billing: {
        id: number;
        amount: number;
        issuedAt: string;
        dueDate: string;
        status: 'issued' | 'paid' | 'overdue';
        pastDue: boolean;
    } | null;
    payments: ReservationPayment[]; // newest first
    canPay: boolean;
    payBlockedReason: string | null;
    expectedAmount: number; // 10% of the budget, shown before the bill is issued
    dueDays: number;
    gcash: { account_name: string; account_number: string; qr_image: string; is_sample: boolean };
    receipt: { maxMb: number; types: string[] };
};

/** Everything the customer submitted (Request Details / Project Details page). */
export type RequestDetail = {
    id: number;
    code: string;
    title: string;
    requestType: RequestType;
    requestDate: string;
    requestStatus: 'pending' | 'approved' | 'rejected';
    pmRemarks: string | null;
    eventType: string | null;
    projectTitle: string | null;
    startDate: string;
    endDate: string;
    startTime: string | null;
    endTime: string | null;
    venue: string;
    guests: number | null;
    budgetMin: number;
    budgetMax: number | null;
    reservationFee: number;
    description: string | null;
    services: { name: string; category: string | null; quantity: number; unit: string | null; unitPrice: number; subtotal: number }[];
    servicesTotal: number;
    files: { id: number; name: string; isImage: boolean; url: string }[];
};

export const MEETING_MODES: { value: MeetingMode; label: string; hint: string }[] = [
    { value: 'online', label: 'Online', hint: 'Video call; the link is sent before the meeting' },
    { value: 'face_to_face', label: 'Face to face', hint: "At GR3AT A's office" },
];

export const meetingModeLabel = (m: MeetingMode | null) => MEETING_MODES.find((x) => x.value === m)?.label ?? '—';

/* ---------- formatting ---------- */

const fromISO = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const addDaysISO = (iso: string, n: number) => {
    const d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
};

export const isSunday = (iso: string) => fromISO(iso).getDay() === 0;

/** "Nov 23, 2026" */
export const formatDate = (iso: string) => fromISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** "Monday, November 23, 2026" */
export const formatLongDate = (iso: string) =>
    fromISO(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

/** "14:00" → "2:00 PM" */
export const formatTime = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Standard: "Dec 10, 2026 · 2:00 PM – 10:00 PM". Custom: "Dec 10 – Dec 14, 2026". */
export function formatWhen(p: { startDate: string; endDate: string; startTime: string | null; endTime: string | null }) {
    if (p.startDate !== p.endDate) {
        const start = fromISO(p.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${start} – ${formatDate(p.endDate)}`;
    }

    return p.startTime && p.endTime ? `${formatDate(p.startDate)} · ${formatTime(p.startTime)} – ${formatTime(p.endTime)}` : formatDate(p.startDate);
}

export const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

export const budgetLabel = (min: number, max: number | null) =>
    max === null ? `Above ${peso(min)}` : min === 0 ? `Below ${peso(max)}` : `${peso(min)} – ${peso(max)}`;

/** The pill colour for a project's phase or a request's review status. */
export function statusTone(item: { requestStatus?: string; status: ProjectStatusInfo | null }): PillTone {
    if (!item.status) return item.requestStatus === 'rejected' ? 'gray' : 'yellow';
    if (item.status.name === 'Completed') return 'green';
    if (item.status.name === 'Cancelled') return 'red';
    return item.status.phase === 'Execution' ? 'blue' : 'cream';
}

/** "Planning · Designing", "Pending review", "Not approved" */
export function statusText(item: { requestStatus?: string; status: ProjectStatusInfo | null }): string {
    if (!item.status) return item.requestStatus === 'rejected' ? 'Not approved' : 'Pending review';
    return item.status.terminal ? item.status.name : `${item.status.phase} · ${item.status.name}`;
}
