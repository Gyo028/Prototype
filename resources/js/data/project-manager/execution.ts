/*
 * Project execution: the fabrication and installation schedule (backlog #32).
 *
 * After the signed contract is verified, the Project Manager schedules fabrication and
 * installation and assigns the Fabrication Head and the Installation Head ("Manage Project
 * Execution" use case). Saving the schedule generates a work order for each Head.
 */

export const EXECUTION_PHASES = [
    { key: 'fabrication', title: 'Fabrication', head: 'Fabrication Head' },
    { key: 'installation', title: 'Installation', head: 'Installation Head' },
] as const;

export type PhaseKey = (typeof EXECUTION_PHASES)[number]['key'];

/** An employee who can lead a phase (Fabrication / Installation Set-up Head). */
export type SetUpHead = {
    id: number;
    name: string;
    phase: PhaseKey;
    email: string | null; // from the employee records; needed to email the work order (backlog #33)
    activeAssignments: number; // how many projects they are currently assigned to
};

/** One line of the schedule. */
export type ScheduleActivity = {
    id: string;
    activity: string;
    scheduledDate: string; // 'YYYY-MM-DD'
    targetDate: string; // 'YYYY-MM-DD', target completion date
};

/** The work order emailed to a phase's Head (backlog #33). */
export type WorkOrder = {
    code: string; // e.g. "WO-0013-F"
    instructions: string; // the project instructions written by the Project Manager
    sentTo: string; // the Head's name
    sentToEmail: string;
    sentBy: string;
    sentAt: string; // ISO date-time
};

export type PhaseSchedule = {
    headId: number | null;
    headName: string | null;
    activities: ScheduleActivity[];
    workOrder?: WorkOrder | null; // null = not sent yet (or the schedule changed since)
    completion?: { completedBy: string; completedAt: string } | null; // the assignment's completion (backlog #35)
    changes?: ScheduleChange[]; // reschedules of this phase, oldest first
};

/** Rescheduling a phase after the schedule was saved needs a reason (revision, Nov 19). */
export type ScheduleChange = {
    reason: string;
    changedBy: string;
    changedAt: string | null; // ISO date-time (not stored in the backend)
};

export type ExecutionSchedule = Record<PhaseKey, PhaseSchedule> & {
    savedBy: string;
    savedAt: string | null; // ISO date-time (not stored in the backend)
};

/* ---------- validation (acceptance criterion 2) ---------- */

export type ActivityErrors = Partial<Record<'activity' | 'scheduledDate' | 'targetDate', string>>;

export type PhaseErrors = {
    head?: string;
    general?: string; // e.g. "Add at least one activity"
    activities: Record<string, ActivityErrors>; // keyed by the activity's id
};

export type ScheduleErrors = Record<PhaseKey, PhaseErrors>;

export function validateSchedule(s: Pick<ExecutionSchedule, PhaseKey>): ScheduleErrors {
    const errors = {} as ScheduleErrors;

    EXECUTION_PHASES.forEach(({ key, title, head }) => {
        const phase = s[key];
        const e: PhaseErrors = { activities: {} };

        if (!phase.headId) e.head = `Assign the ${head}.`;
        if (phase.activities.length === 0) e.general = `Add at least one ${title.toLowerCase()} activity.`;

        phase.activities.forEach((a) => {
            const ae: ActivityErrors = {};
            if (!a.activity.trim()) ae.activity = 'Enter the activity.';
            if (!a.scheduledDate) ae.scheduledDate = 'Enter the scheduled date.';
            if (!a.targetDate) ae.targetDate = 'Enter the target completion date.';
            else if (a.scheduledDate && a.targetDate < a.scheduledDate) ae.targetDate = 'Cannot be before the scheduled date.';
            if (Object.keys(ae).length) e.activities[a.id] = ae;
        });

        errors[key] = e;
    });

    return errors;
}

export const hasScheduleErrors = (e: ScheduleErrors) =>
    EXECUTION_PHASES.some(({ key }) => Boolean(e[key].head || e[key].general || Object.keys(e[key].activities).length));

/* ---------- work order (backlog #33) ---------- */

/** Acceptance criterion 2: what is missing before a work order can be sent. Empty list = ready. */
export function workOrderProblems(phase: PhaseSchedule, head: SetUpHead | undefined, instructions: string): string[] {
    const problems: string[] = [];
    if (!phase.headId || !head) problems.push('No Head is assigned to this phase.');
    else if (!head.email) problems.push(`${head.name} has no email address in the employee records.`);
    if (phase.activities.length === 0) problems.push('The schedule has no activities.');
    else if (phase.activities.some((a) => !a.activity.trim() || !a.scheduledDate || !a.targetDate))
        problems.push('An activity is missing its name, scheduled date or target completion date.');
    if (!instructions.trim()) problems.push('Write the project instructions for the Head.');
    return problems;
}

/* ---------- project status (backlog #35) ---------- */

/** The project's execution status. Completed and Cancelled are final. */
export const EXECUTION_STATUSES = ['Completed', 'Cancelled'] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

/** Acceptance criterion 1: these statuses cannot be saved without remarks. */
export const STATUSES_NEEDING_REMARKS: ExecutionStatus[] = ['Cancelled'];

export type StatusUpdate = {
    status: ExecutionStatus;
    remarks: string | null; // required for Rescheduled and Cancelled
    updatedBy: string;
    updatedAt: string; // ISO date-time
};
/* ---------- sample data ---------- */

export const SAMPLE_SET_UP_HEADS: SetUpHead[] = [
    { id: 31, name: 'Mark Reyes', phase: 'fabrication', email: 'mark.reyes@gr3ats.com', activeAssignments: 2 },
    { id: 32, name: 'Paolo Garcia', phase: 'fabrication', email: 'paolo.garcia@gr3ats.com', activeAssignments: 0 },
    { id: 41, name: 'Jun Cruz', phase: 'installation', email: 'jun.cruz@gr3ats.com', activeAssignments: 1 },
    { id: 42, name: 'Liza Ramos', phase: 'installation', email: null, activeAssignments: 3 }, // no email on record (criterion 2)
];