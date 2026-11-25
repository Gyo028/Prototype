import { router } from '@inertiajs/react';
import { useState } from 'react';
import { PageHeader, Panel, Pill, cx, inputClass } from '@/components/dashboard/ui';
import { projectStatusTone } from '@/components/project-manager/project-status';
import { formatDate } from '@/components/project-manager/request-details';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';
import { PROJECT_STATUSES, getSampleProjects, projectStatus } from '@/data/project-manager/projects';
import type { Project, ProjectStatus } from '@/data/project-manager/projects';
import { requestTitle } from '@/data/project-manager/project-requests';

/*
 * The Projects page: every approved service request is a project.
 * Clicking a project opens its planning wizard.
 * Revision (leader, Nov 19):
 *   - Only 4 columns: Number, Project Title, Date, Status.
 *   - Numbers follow a queue: first come, first served (oldest at the top).
 *   - The status is the step the project is in (Consultation ... Installation), Completed or Cancelled.
 */

type Filter = ProjectStatus | 'All';

const FILTERS: Filter[] = ['All', ...PROJECT_STATUSES];

type Props = {
    /** Sent by the controller (approved requests only). Leave it out to use the sample data. */
    projects?: Project[];
};

export default function ProjectList({ projects }: Props) {
    const allProjects = projects ?? getSampleProjects();

    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('All');

    const count = (f: Filter) => (f === 'All' ? allProjects.length : allProjects.filter((p) => projectStatus(p) === f).length);

    const q = query.trim().toLowerCase();
    const visibleProjects = allProjects
        .filter((p) => filter === 'All' || projectStatus(p) === filter)
        .filter((p) => !q || p.code.toLowerCase().includes(q) || requestTitle(p).toLowerCase().includes(q))
        // Queue: first come, first served. The oldest is at the top.
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

    const openProject = (p: Project) => router.visit(`${PROJECTS_URL}/${p.id}`);

    return (
        <>
            <PageHeader title="Projects" description="Approved service requests, first come, first served. Open a project to continue its planning." />
            
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
                        placeholder="Search by number or project title..."
                        aria-label="Search projects"
                        className={inputClass}
                    />
                </div>
            </div>
            
            {/* Table: click a row to open that project */}
            <Panel className="overflow-x-auto p-0">
                <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-neutral-200/70 text-xs text-ink-soft uppercase">
                        <tr>
                            <th className="px-4 py-3 font-medium">Number</th>
                            <th className="px-2 py-3 font-medium">Project Title</th>
                            <th className="px-2 py-3 font-medium">Date</th>
                            <th className="px-2 py-3 pr-4 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                        {visibleProjects.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-10 text-center text-ink-soft">
                                    {q ? 'No projects match your search.' : 'No projects here.'}
                                </td>
                            </tr>
                        ) : (
                            visibleProjects.map((p) => {
                                const status = projectStatus(p);
                                return (
                                    <tr
                                        key={p.id}
                                        tabIndex={0}
                                        aria-label={`Open ${p.code}`}
                                        onClick={() => openProject(p)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') openProject(p);
                                        }}
                                        className="cursor-pointer transition hover:bg-gold/10 focus-visible:bg-gold/10 focus-visible:outline-none"
                                    >
                                        <td className="px-4 py-3 font-semibold whitespace-nowrap text-ink">{p.code}</td>
                                        <td className="px-2 py-3 text-ink">{requestTitle(p)}</td>
                                        <td className="px-2 py-3 whitespace-nowrap text-ink">{formatDate(p.submittedAt.slice(0, 10))}</td>
                                        <td className="px-2 py-3 pr-4 whitespace-nowrap">
                                            <Pill tone={projectStatusTone[status]}>{status}</Pill>
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