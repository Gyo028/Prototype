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
    activeAssignments: number; // how many projects they are currently assigned to
};

/** One line of the schedule. */
export type ScheduleActivity = {
    id: string;
    activity: string;
    scheduledDate: string; // 'YYYY-MM-DD'
    targetDate: string; // 'YYYY-MM-DD', target completion date
};

export type PhaseSchedule = {
    headId: number | null;
    headName: string | null;
    activities: ScheduleActivity[];
};

export type ExecutionSchedule = Record<PhaseKey, PhaseSchedule> & {
    savedBy: string;
    savedAt: string; // ISO date-time
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

/* ---------- sample data ---------- */

export const SAMPLE_SET_UP_HEADS: SetUpHead[] = [
    { id: 31, name: 'Mark Reyes', phase: 'fabrication', activeAssignments: 2 },
    { id: 32, name: 'Paolo Garcia', phase: 'fabrication', activeAssignments: 0 },
    { id: 41, name: 'Jun Cruz', phase: 'installation', activeAssignments: 1 },
    { id: 42, name: 'Liza Ramos', phase: 'installation', activeAssignments: 3 },
];