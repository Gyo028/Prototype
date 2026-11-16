import { Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, FilePlus, FolderOpen, Info, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { GoldButton, PageHeader, Panel, Pill, cx, inputClass } from '@/components/dashboard/ui';
import { formatDate, formatWhen, statusText, statusTone } from '@/components/customer/project-types';
import type { ProjectListItem } from '@/components/customer/project-types';

/*
 * Customer > My Projects.
 * Every request the customer submitted. Approved requests have a project and
 * open its folder (stage tabs). Pending and rejected requests are listed too,
 * so the customer can see what they sent.
 */

/** Requests and projects per page. */
const PAGE_SIZE = 10;

type Filter = 'all' | 'action' | 'active' | 'pending' | 'closed';

const FILTERS: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'action', label: 'Action needed' },
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Awaiting review' },
    { value: 'closed', label: 'Closed' },
];

const needsAction = (item: ProjectListItem) => !!item.nextAction?.actionNeeded;

const inFilter = (item: ProjectListItem, f: Filter) => f === 'all' || (f === 'action' ? needsAction(item) : groupOf(item) === f);

const groupOf = (item: ProjectListItem): Exclude<Filter, 'all' | 'action'> => {
    if (!item.status) return item.requestStatus === 'rejected' ? 'closed' : 'pending';
    return item.status.terminal ? 'closed' : 'active';
};

export default function MyProjects({ items, profileMissing }: { items: ProjectListItem[]; profileMissing: boolean }) {
    const [filter, setFilter] = useState<Filter>('all');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);

    // A new filter or search starts again from the first page.
    const changeFilter = (f: Filter) => {
        setFilter(f);
        setPage(1);
    };
    const changeQuery = (q: string) => {
        setQuery(q);
        setPage(1);
    };

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter(
            (i) =>
                inFilter(i, filter) &&
                (!q || [i.title, i.venue, i.requestCode, i.projectCode ?? ''].some((v) => v.toLowerCase().includes(q))),
        );
    }, [items, filter, query]);

    const count = (f: Filter) => items.filter((i) => inFilter(i, f)).length;

    const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const start = (current - 1) * PAGE_SIZE;
    const visible = shown.slice(start, start + PAGE_SIZE);

    return (
        <div className="mx-auto w-full max-w-[1150px]">
            <PageHeader
                title="My Projects"
                description="Your service requests and the projects they became. Open one to see its progress or what you submitted."
                actions={
                    <Link href="/customer/new-request">
                        <GoldButton>
                            <FilePlus className="size-4" /> New Service Request
                        </GoldButton>
                    </Link>
                }
            />

            {profileMissing && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    Your customer profile is not set up yet, so there are no projects to show.
                </div>
            )}

            <Panel className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 p-4">
                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter projects">
                        {FILTERS.map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                role="tab"
                                aria-selected={filter === f.value}
                                onClick={() => changeFilter(f.value)}
                                className={cx(
                                    'rounded-full border px-3 py-1 text-xs font-bold transition',
                                    filter === f.value ? 'border-gold bg-gold text-white' : 'border-black/15 bg-white text-ink hover:border-gold',
                                )}
                            >
                                {f.label} ({count(f.value)})
                            </button>
                        ))}
                    </div>
                    <label className="relative w-full sm:w-64">
                        <span className="sr-only">Search projects</span>
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
                        <input
                            className={cx(inputClass, 'pl-9')}
                            placeholder="Search title, venue or code"
                            value={query}
                            onChange={(e) => changeQuery(e.target.value)}
                        />
                    </label>
                </div>

                {shown.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-ink-soft">
                        <FolderOpen className="size-8" />
                        <p className="text-sm">{items.length === 0 ? 'No projects yet. Submit a service request to get started.' : 'No projects match this filter.'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-black/[0.03] text-xs uppercase tracking-wide text-ink-soft">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Project</th>
                                    <th className="px-4 py-3 font-semibold">Date</th>
                                    <th className="px-4 py-3 font-semibold">Venue</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((item) => (
                                    <Row key={item.requestId} item={item} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {shown.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 px-4 py-3">
                        <p className="text-xs text-ink-soft">
                            Showing {start + 1}–{Math.min(start + PAGE_SIZE, shown.length)} of {shown.length}
                        </p>
                        {pages > 1 && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    aria-label="Previous page"
                                    disabled={current === 1}
                                    onClick={() => setPage(current - 1)}
                                    className="rounded border border-black/15 bg-white p-1.5 disabled:opacity-40"
                                >
                                    <ChevronLeft className="size-4" />
                                </button>
                                {Array.from({ length: pages }).map((_, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        aria-label={`Page ${i + 1}`}
                                        aria-current={current === i + 1 ? 'page' : undefined}
                                        onClick={() => setPage(i + 1)}
                                        className={cx(
                                            'size-8 rounded border text-xs font-bold',
                                            current === i + 1 ? 'border-gold bg-gold text-white' : 'border-black/15 bg-white',
                                        )}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    aria-label="Next page"
                                    disabled={current === pages}
                                    onClick={() => setPage(current + 1)}
                                    className="rounded border border-black/15 bg-white p-1.5 disabled:opacity-40"
                                >
                                    <ChevronRight className="size-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </Panel>
        </div>
    );
}

function Row({ item }: { item: ProjectListItem }) {
    // Approved: the project's progress page. Pending or not approved: what was submitted.
    const href = item.projectId ? `/customer/projects/${item.projectId}` : `/customer/requests/${item.requestId}`;

    return (
        <tr
            className="cursor-pointer border-t border-black/10 transition hover:bg-gold/5"
            // The whole row opens it; the link in the last cell is there for keyboard users.
            onClick={() => router.visit(href)}
        >
            <td className="px-4 py-3">
                <div className="font-bold text-ink">{item.title}</div>
                <div className="text-xs text-ink-soft">
                    {item.projectCode ?? item.requestCode} · {item.requestType === 'custom' ? 'Custom Project' : 'Standard Event Styling'}
                </div>
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-ink">{formatWhen(item)}</td>
            <td className="max-w-64 truncate px-4 py-3 text-ink" title={item.venue}>
                {item.venue}
            </td>
            <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                    <Pill tone={statusTone(item)}>{statusText(item)}</Pill>
                    {item.status?.onHold && <Pill tone="yellow">On Hold</Pill>}
                    {needsAction(item) && <Pill tone="purple">Action needed</Pill>}
                </div>
                {item.nextAction ? (
                    <div className={cx('mt-1 text-xs', needsAction(item) ? 'font-semibold text-ink' : 'text-ink-soft')}>{item.nextAction.title}</div>
                ) : (
                    !item.status && <div className="mt-1 text-[11px] text-ink-soft">Submitted {formatDate(item.requestDate)}</div>
                )}
            </td>
            <td className="px-4 py-3 text-right">
                <Link
                    href={href}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap text-gold-dark hover:underline"
                >
                    {item.projectId ? 'Open' : 'View request'} <ChevronRight className="size-4" />
                </Link>
            </td>
        </tr>
    );
}
