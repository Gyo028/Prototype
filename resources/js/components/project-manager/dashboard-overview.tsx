import { Link, router } from '@inertiajs/react';
import { ClipboardList, Hourglass, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { Panel, cx } from '@/components/dashboard/ui';
import ProjectOverview from '@/components/owner/project-overview';
import { REQUESTS_URL } from '@/components/project-manager/project-request-review';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';
import { toOwnerSummary } from '@/data/owner/projects';
import { getSampleRequests } from '@/data/project-manager/project-requests';
import type { ProjectRequest } from '@/data/project-manager/project-requests';
import { activeStep, getSampleProjects, stepStates } from '@/data/project-manager/projects';
import type { Project } from '@/data/project-manager/projects';

/*
 * Project Manager dashboard (revision, Nov 22): an overview of what is happening on the
 * Project Manager side, like the Owner dashboard.
 *   - To-do cards: pending service requests, projects needing the Project Manager's action,
 *     and payments to verify. Each card opens the page where the work is done.
 *   - Then the project overview (Total / Ongoing / Completed / Cancelled, tabs, search) with only
 *     Number, Project Title, Date and Status, first come, first served. Clicking a project opens it.
 */

const BILLING_URL = '/project-manager/billing-payments';

/** The project's current step is waiting for the Project Manager (not the customer or the Design Specialist). */
export const needsAction = (p: Project) => {
    const key = activeStep(p);
    return key !== null && stepStates(p)[key] === 'current';
};

function TodoCard({ label, value, hint, icon, tone, href }: { label: string; value: number; hint: string; icon: ReactNode; tone: string; href: string }) {
    return (
        <Link href={href} className="block rounded-2xl transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-gold">
            <Panel className={cx('flex h-full items-center gap-4 p-4', value > 0 && 'ring-2 ring-gold/40')}>
                <div className={cx('flex size-11 shrink-0 items-center justify-center rounded-xl', tone)}>{icon}</div>
                <div>
                    <p className="text-2xl font-bold text-ink">{value}</p>
                    <p className="text-sm font-semibold text-ink">{label}</p>
                    <p className="text-xs text-ink-soft">{hint}</p>
                </div>
            </Panel>
        </Link>
    );
}

type Props = {
    /** Sent by the controller. Leave them out to use the sample data. */
    projects?: Project[];
    requests?: ProjectRequest[];
};

export default function DashboardOverview({ projects, requests }: Props) {
    const allProjects = projects ?? getSampleProjects();
    const allRequests = requests ?? getSampleRequests();

    const pending = allRequests.filter((r) => r.status === 'Pending').length;
    const actionNeeded = allProjects.filter(needsAction).length;
    const toVerify = allProjects.flatMap((p) => p.payments).filter((x) => x.status === 'For Verification').length;

    return (
        <ProjectOverview
            title="Project Manager Dashboard"
            description="What needs your attention, and an overview of all projects and their current status."
            projects={allProjects.map(toOwnerSummary)}
            onOpen={(p) => router.visit(`${PROJECTS_URL}/${p.id}`)}
            compact
        >
            <h2 className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">Needs your attention</h2>
            <div className="mb-6 grid gap-3 md:grid-cols-3">
                <TodoCard
                    label="Pending service requests"
                    hint="Waiting for your approval"
                    value={pending}
                    icon={<Inbox className="size-5" />}
                    tone="bg-sky-100 text-sky-700"
                    href={REQUESTS_URL}
                />
                <TodoCard
                    label="Projects needing action"
                    hint="The current step is waiting for you"
                    value={actionNeeded}
                    icon={<ClipboardList className="size-5" />}
                    tone="bg-gold/15 text-gold-dark"
                    href={PROJECTS_URL}
                />
                <TodoCard
                    label="Payments to verify"
                    hint="Customer payments not yet checked"
                    value={toVerify}
                    icon={<Hourglass className="size-5" />}
                    tone="bg-amber-100 text-amber-700"
                    href={BILLING_URL}
                />
            </div>
            <h2 className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">Projects</h2>
        </ProjectOverview>
    );
}