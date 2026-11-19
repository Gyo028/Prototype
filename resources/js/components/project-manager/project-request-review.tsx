import { router } from '@inertiajs/react';
import { useState } from 'react';
import { PageHeader, Panel, Pill, cx, inputClass } from '@/components/dashboard/ui';
import { formatDate, statusTone } from '@/components/project-manager/request-details';
import { getSampleRequests } from '@/data/project-manager/project-requests';
import type { ProjectRequest, RequestStatus } from '@/data/project-manager/project-requests';

/*
 * Backlog #13 (list): all incoming service requests.
 * Revision (leader, Nov 19):
 *   - Only 4 columns: Number, Project Title, Date, Status.
 *   - Numbers follow a queue: first come, first served (oldest request at the top).
 *   - Clicking a request opens its own page (not a pop-up).
 * The review itself (approve / reject) is on that page: project-request-detail.tsx.
 */

export const REQUESTS_URL = '/project-manager/service-requests';

type Filter = 'All' | RequestStatus;
const FILTERS: Filter[] = ['Pending', 'Approved', 'Rejected', 'All'];

type Props = {
    /** Sent by the controller. Leave it out to use the sample data. */
    requests?: ProjectRequest[];
};

export default function ProjectRequestReview({ requests }: Props) {
    const allRequests = requests ?? getSampleRequests();

    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('Pending');

    const count = (f: Filter) => (f === 'All' ? allRequests.length : allRequests.filter((r) => r.status === f).length);

    const q = query.trim().toLowerCase();
    const visibleRequests = allRequests
        .filter((r) => filter === 'All' || r.status === filter)
        .filter((r) => !q || r.code.toLowerCase().includes(q) || r.eventType.toLowerCase().includes(q))
        // Queue: first come, first served. The oldest request is at the top.
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

    const openRequest = (r: ProjectRequest) => router.visit(`${REQUESTS_URL}/${r.id}`);

    return (
        <>
            <PageHeader
                title="Service Requests"
                description="Requests are listed first come, first served. Open a request to review it."
            />
            
            {/* Toolbar: status tabs on the left, search on the right */}
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
                        aria-label="Search requests"
                        className={inputClass}
                    />
                </div>
            </div>

            {/* Requests table: click a row to open that request's page */}
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
                        {visibleRequests.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-10 text-center text-ink-soft">
                                    {q ? 'No requests match your search.' : `No ${filter === 'All' ? '' : filter.toLowerCase() + ' '}requests.`}
                                </td>
                            </tr>
                        ) : (
                            visibleRequests.map((r) => (
                                <tr
                                    key={r.id}
                                    tabIndex={0}
                                    aria-label={`Open ${r.code}`}
                                    onClick={() => openRequest(r)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') openRequest(r);
                                    }}
                                    className="cursor-pointer transition hover:bg-gold/10 focus-visible:bg-gold/10 focus-visible:outline-none"
                                >
                                    <td className="px-4 py-3 font-semibold whitespace-nowrap text-ink">{r.code}</td>
                                    <td className="px-2 py-3 text-ink">{r.eventType}</td>
                                    <td className="px-2 py-3 whitespace-nowrap text-ink">{formatDate(r.submittedAt.slice(0, 10))}</td>
                                                                        <td className="px-2 py-3 pr-4">
                                        <Pill tone={statusTone[r.status]}>{r.status}</Pill>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Panel>
        </>
    );
}