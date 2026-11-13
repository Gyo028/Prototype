import { router } from '@inertiajs/react';
import { useState } from 'react';
import { PageHeader, Panel, Pill, cx, inputClass } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import { formatDate } from '@/components/project-manager/request-details';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';
import { STEPS, activeStep, getSampleProjects, projectStatus, stepStates } from '@/data/project-manager/projects';
import type { Project, ProjectStatus } from '@/data/project-manager/projects';

/*
 * The Projects page: every approved service request is a project.
 * Clicking a project opens its planning wizard.
 */

type Filter = ProjectStatus | 'All';

const FILTERS: Filter[] = ['In Progress', 'Completed', 'Not Proceeding', 'All'];

const statusTone: Record<ProjectStatus, PillTone> = {
    'In Progress': 'yellow',
    Completed: 'green',
    'Not Proceeding': 'red',
};

/** "Step 2 of 5 · Site Assessment" and whether the Project Manager or someone else has to act. */
function progressOf(p: Project) {
    const key = activeStep(p);
    if (!key) return null;
    const index = STEPS.findIndex((s) => s.key === key);
    const waiting = stepStates(p)[key] === 'waiting';
    return { label: `Step ${index + 1} of ${STEPS.length} · ${STEPS[index].title}`, waiting };
}

type Props = {
    /** Sent by the controller (approved requests only). Leave it out to use the sample data. */
    projects?: Project[];
};

export default function ProjectList({ projects }: Props) {
    const allProjects = projects ?? getSampleProjects();

    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('In Progress');

    const count = (f: Filter) => (f === 'All' ? allProjects.length : allProjects.filter((p) => projectStatus(p) === f).length);

    const q = query.trim().toLowerCase();
    const visibleProjects = allProjects
        .filter((p) => filter === 'All' || projectStatus(p) === filter)
        .filter(
            (p) =>
                !q ||
                p.code.toLowerCase().includes(q) ||
                p.customer.name.toLowerCase().includes(q) ||
                p.eventType.toLowerCase().includes(q) ||
                p.venue.toLowerCase().includes(q),
        )
        // Nearest event first.
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

    const openProject = (p: Project) => router.visit(`${PROJECTS_URL}/${p.id}`);

    return (
        <>
            <PageHeader title="Projects" description="Approved service requests. Open a project to continue its planning step by step." />

            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-sm" role="tablist" aria-label="Filter by status">
                    {FILTERS.map((f) => (
                        <button
                            key={f}
                            type="button"
                            role="tab"
                            aria-selected={filter === f}
                            onClick={() => setFilter(f)}
                            className={cx(
                                'rounded-lg px-4 py-1.5 text-sm font-semibold transition',
                                filter === f ? 'bg-gold text-white' : 'text-ink-soft hover:bg-gold/10',
                            )}
                        >
                            {f} <span className="ml-1 text-xs opacity-80">{count(f)}</span>
                        </button>
                    ))}
                </div>

                <div className="ml-auto w-full max-w-sm">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by project no., customer, event or venue..."
                        aria-label="Search projects"
                        className={inputClass}
                    />
                </div>
            </div>

            {/* Table */}
            <Panel className="overflow-x-auto p-0">
                <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="bg-neutral-200/70 text-xs text-ink-soft uppercase">
                        <tr>
                            <th className="px-4 py-3 font-medium">Project No.</th>
                            <th className="px-2 py-3 font-medium">Customer</th>
                            <th className="px-2 py-3 font-medium">Event</th>
                            <th className="px-2 py-3 font-medium">Event Date</th>
                            <th className="px-2 py-3 font-medium">Current Step</th>
                            <th className="px-2 py-3 pr-4 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                        {visibleProjects.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-ink-soft">
                                    {q ? 'No projects match your search.' : 'No projects here.'}
                                </td>
                            </tr>
                        ) : (
                            visibleProjects.map((p) => {
                                const progress = progressOf(p);
                                const status = projectStatus(p);
                                return (
                                    <tr
                                        key={p.id}
                                        tabIndex={0}
                                        aria-label={`Open ${p.code} for ${p.customer.name}`}
                                        onClick={() => openProject(p)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') openProject(p);
                                        }}
                                        className="cursor-pointer transition hover:bg-gold/10 focus-visible:bg-gold/10 focus-visible:outline-none"
                                    >
                                        <td className="px-4 py-3 font-semibold text-ink">{p.code}</td>
                                        <td className="px-2 py-3 text-ink">{p.customer.name}</td>
                                        <td className="px-2 py-3 text-ink">{p.eventType}</td>
                                        <td className="px-2 py-3 text-ink">{formatDate(p.eventDate)}</td>
                                        <td className="px-2 py-3">
                                            {progress ? (
                                                <div className="flex flex-col items-start gap-1">
                                                    <span className="text-ink">{progress.label}</span>
                                                    {progress.waiting ? (
                                                        <Pill tone="blue">Waiting</Pill>
                                                    ) : (
                                                        <Pill tone="cream">Action needed</Pill>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-ink-soft">{status === 'Completed' ? 'All steps complete' : '—'}</span>
                                            )}
                                        </td>
                                        <td className="px-2 py-3 pr-4">
                                            <Pill tone={statusTone[status]}>{status}</Pill>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </Panel>
        </>
    );
}
