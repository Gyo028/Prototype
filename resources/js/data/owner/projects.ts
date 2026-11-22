    /*
 * Owner: overview of all projects (backlog #39, "Monitor Business Operations" use case).
 *
 * The Owner only views projects (no editing), so the Owner pages use a small summary of
 * each project instead of the full Project used by the Project Manager wizard.
 * The SAMPLE data is built from the Project Manager's sample projects, so both sides
 * show the same projects while the backend is not ready yet.
 */

import { PROJECT_STATUSES, STEPS, activeStep, getSampleProjects, projectStatus } from '@/data/project-manager/projects';
import type { Project, ProjectStatus } from '@/data/project-manager/projects';

export type OwnerProjectStatus = ProjectStatus; // In Progress, Rescheduled, Completed, Cancelled, Not Proceeding

export type OwnerProjectSummary = {
    id: number;
    code: string; // e.g. "REQ-0013"
    customerName: string;
    eventType: string;
    eventDate: string; // 'YYYY-MM-DD'
    submittedAt: string; // ISO date-time the service request was submitted (Project Manager dashboard)
    venue: string;
    status: OwnerProjectStatus;
    currentStep: string | null; // e.g. "Step 6 of 8 · Contract"; null when completed or closed
};

/** Ongoing = still being worked on (every status except Completed and Cancelled). */
export const ONGOING_STATUSES: OwnerProjectStatus[] = PROJECT_STATUSES.filter((s) => s !== 'Completed' && s !== 'Cancelled');

/** Turns a full project into the summary the Owner sees. */
export function toOwnerSummary(p: Project): OwnerProjectSummary {
    const key = activeStep(p);
    const index = key ? STEPS.findIndex((s) => s.key === key) : -1;
    return {
        id: p.id,
        code: p.code,
        customerName: p.customer.name,
        eventType: p.eventType,
        eventDate: p.eventDate,
        submittedAt: p.submittedAt,
        venue: p.venue,
        status: projectStatus(p),
        currentStep: index >= 0 ? `Step ${index + 1} of ${STEPS.length} · ${STEPS[index].title}` : null,
    };
}

export const getSampleOwnerProjects = (): OwnerProjectSummary[] => getSampleProjects().map(toOwnerSummary);