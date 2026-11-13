import { CheckCircle2, Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Project } from '@/data/project-manager/projects';

/*
 * Small pieces shared by every wizard step.
 */

export const PROJECTS_URL = '/project-manager/projects';

/** What every step receives from the wizard. */
export type StepProps = {
    project: Project;
    /** True while the page runs on sample data (no backend yet). */
    usingSample: boolean;
    managerName: string;
    /** Sample mode only: hand the updated project back to the wizard. */
    onSaved: (project: Project) => void;
};

/** The title and short explanation at the top of each step. */
export function StepIntro({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="mb-4">
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            <p className="text-sm text-ink-soft">{children}</p>
        </div>
    );
}

/** Shown when the step is waiting on the customer or the Design Specialist. */
export function WaitingNotice({ children }: { children: ReactNode }) {
    return (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-ink">
            <Clock className="mt-0.5 size-5 shrink-0 text-sky-600" />
            <div>{children}</div>
        </div>
    );
}

/** Shown when a step has been completed. */
export function CompletedNotice({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-ink">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />
            <div>{children}</div>
        </div>
    );
}
