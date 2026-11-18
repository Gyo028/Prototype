import { Link } from '@inertiajs/react';
import { FilePlus, FolderOpen, Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ListCard, ListEmpty, ListPager, ListTable, ListToolbar, pageSlice } from '@/components/customer/list-parts';
import { formatDay, statusText, statusTone } from '@/components/customer/project-types';
import { GoldButton, PageHeader, Panel, Pill } from '@/components/dashboard/ui';
import type { ProjectListItem } from '@/components/customer/project-types';

/*
 * Customer > My Projects.
 * Every request the customer submitted. Approved requests have a project and
 * open its progress page. Pending and rejected requests are listed too, and
 * open what was submitted.
 *
 * Columns: Code · Project title · Date (no time) · Status. What to do next is
 * on the project page; "Action needed" stays as a filter.
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

/** Approved: the project's progress page. Pending or not approved: what was submitted. */
const hrefOf = (item: ProjectListItem) => (item.projectId ? `/customer/projects/${item.projectId}` : `/customer/requests/${item.requestId}`);

const codeOf = (item: ProjectListItem) => item.projectCode ?? item.requestCode;

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

    const { current, visible } = pageSlice(shown, page, PAGE_SIZE);

    return (
        <div className="mx-auto w-full max-w-[1150px]">
            <PageHeader
                title="My Projects"
                description="Your service requests and the projects they became. Open one to see its progress or what you submitted."
                actions={
                    <Link href="/customer/new-request" className="w-full sm:w-auto">
                        <GoldButton className="w-full sm:w-auto">
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
                <ListToolbar
                    filters={FILTERS}
                    value={filter}
                    onChange={changeFilter}
                    count={count}
                    label="Filter projects"
                    query={query}
                    onQuery={changeQuery}
                    placeholder="Search title, venue or code"
                />

                {shown.length === 0 ? (
                    <ListEmpty icon={<FolderOpen className="size-8" />}>
                        {items.length === 0 ? 'No projects yet. Submit a service request to get started.' : 'No projects match this filter.'}
                    </ListEmpty>
                ) : (
                    <ListTable
                        rows={visible}
                        rowKey={(i) => i.requestId}
                        href={hrefOf}
                        columns={[
                            { header: 'Code', cell: codeOf, className: 'whitespace-nowrap font-semibold text-ink-soft' },
                            { header: 'Project title', cell: (i) => i.title, className: 'font-bold text-ink' },
                            { header: 'Date', cell: (i) => formatDay(i), className: 'whitespace-nowrap text-ink' },
                            { header: 'Status', cell: (i) => <Pill tone={statusTone(i)} className="whitespace-nowrap">{statusText(i)}</Pill> },
                        ]}
                        card={(i) => (
                            <ListCard top={codeOf(i)} tag={<Pill tone={statusTone(i)} className="whitespace-nowrap">{statusText(i)}</Pill>} title={i.title} bottom={formatDay(i)} />
                        )}
                    />
                )}

                <ListPager page={current} pageSize={PAGE_SIZE} total={shown.length} onPage={setPage} />
            </Panel>
        </div>
    );
}
