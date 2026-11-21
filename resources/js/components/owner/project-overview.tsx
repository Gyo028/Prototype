import { CheckCircle2, FolderKanban, Hourglass, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { PageHeader, Panel, Pill, cx, inputClass } from '@/components/dashboard/ui';
import { projectStatusTone } from '@/components/project-manager/project-status';
import { formatDate } from '@/components/project-manager/request-details';
import { ONGOING_STATUSES, getSampleOwnerProjects } from '@/data/owner/projects';
import type { OwnerProjectSummary } from '@/data/owner/projects';

/*
 * Backlog #39: the Owner's dashboard overview of all ongoing and completed projects.
 *   - Shows every project with its current status (acceptance criterion 1).
 *   - With no project records at all, shows "No project records available." (acceptance criterion 2).
 * Read only: the Owner monitors projects; the Project Manager updates them.
 * Revision (Nov 19): the status is the step the project is in, Completed or Cancelled.
 */

type Filter = 'Ongoing' | 'Completed' | 'All';
const FILTERS: Filter[] = ['Ongoing', 'Completed', 'All'];
const isOngoing = (p: OwnerProjectSummary) => ONGOING_STATUSES.includes(p.status);

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone: string }) {
    return (
        <Panel className="flex items-center gap-4 p-4">
            <div className={cx('flex size-11 shrink-0 items-center justify-center rounded-xl', tone)}>{icon}</div>
            <div>
                <p className="text-2xl font-bold text-ink">{value}</p>
                <p className="text-sm text-ink-soft">{label}</p>
            </div>
        </Panel>
    );
}

type Props = {
    /** Sent by the controller. Leave it out to use the sample data. */
    projects?: OwnerProjectSummary[];
};

export default function ProjectOverview({ projects }: Props) {
    const all = projects ?? getSampleOwnerProjects();

    const [filter, setFilter] = useState<Filter>('Ongoing');
    const [query, setQuery] = useState('');

    const ongoing = all.filter(isOngoing).length;
    const completed = all.filter((p) => p.status === 'Completed').length;
    const closed = all.filter((p) => p.status === 'Cancelled').length;
    const count = (f: Filter) => (f === 'Ongoing' ? ongoing : f === 'Completed' ? completed : all.length);

    const q = query.trim().toLowerCase();
    const visible = all
        .filter((p) => filter === 'All' || (filter === 'Ongoing' ? isOngoing(p) : p.status === 'Completed'))
        .filter(
            (p) =>
                !q ||
                p.code.toLowerCase().includes(q) ||
                p.customerName.toLowerCase().includes(q) ||
                p.eventType.toLowerCase().includes(q) ||
                p.venue.toLowerCase().includes(q),
        )
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

            return (
        <>
            <PageHeader title="Owner Dashboard" description="An overview of all ongoing and completed projects and their current status." />

            {/* Acceptance criterion 2: no project records at all */}
            {all.length === 0 ? (
                <Panel className="flex flex-col items-center gap-3 px-4 py-14 text-center">
                    <FolderKanban className="size-10 text-ink-soft" />
                    <p className="text-base font-semibold text-ink">No project records available.</p>
                </Panel>
            ) : (
                <>
                    {/* Summary */}
                    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Total projects" value={all.length} icon={<FolderKanban className="size-5" />} tone="bg-gold/15 text-gold-dark" />
                        <StatCard label="Ongoing" value={ongoing} icon={<Hourglass className="size-5" />} tone="bg-amber-100 text-amber-700" />
                        <StatCard label="Completed" value={completed} icon={<CheckCircle2 className="size-5" />} tone="bg-green-100 text-green-700" />
                        <StatCard label="Cancelled" value={closed} icon={<XCircle className="size-5" />} tone="bg-red-100 text-red-700" />
                    </div>

                    {/* Toolbar */}
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                        <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-sm" role="tablist" aria-label="Filter projects">
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

                    {/* Acceptance criterion 1: every project with its current status */}
                    <Panel className="overflow-x-auto p-0">
                        <table className="w-full min-w-[860px] text-left text-sm">
                            <thead className="bg-neutral-200/70 text-xs text-ink-soft uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Project No.</th>
                                    <th className="px-2 py-3 font-medium">Customer</th>
                                    <th className="px-2 py-3 font-medium">Event</th>
                                    <th className="px-2 py-3 font-medium">Event Date</th>
                                    <th className="px-2 py-3 font-medium">Venue</th>
                                    <th className="px-2 py-3 font-medium">Current Step</th>
                                    <th className="px-2 py-3 pr-4 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/10">
                                {visible.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-10 text-center text-ink-soft">
                                            {q ? 'No projects match your search.' : `No ${filter.toLowerCase()} projects.`}
                                        </td>
                                    </tr>
                                ) : (
                                    visible.map((p) => (
                                        <tr key={p.id}>
                                            <td className="px-4 py-3 font-semibold whitespace-nowrap text-ink">{p.code}</td>
                                            <td className="px-2 py-3 text-ink">{p.customerName}</td>
                                            <td className="px-2 py-3 text-ink">{p.eventType}</td>
                                            <td className="px-2 py-3 whitespace-nowrap text-ink">{formatDate(p.eventDate)}</td>
                                            <td className="px-2 py-3 text-ink-soft">{p.venue}</td>
                                            <td className="px-2 py-3 text-ink">{p.currentStep ?? '—'}</td>
                                            <td className="px-2 py-3 pr-4 whitespace-nowrap">
                                                <Pill tone={projectStatusTone[p.status]}>{p.status}</Pill>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </Panel>
                </>
            )}
        </>
    );
}