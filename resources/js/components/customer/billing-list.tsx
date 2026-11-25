import { Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ListCard, ListEmpty, ListPager, ListTable, ListToolbar, pageSlice } from '@/components/customer/list-parts';
import { formatDate } from '@/components/customer/project-types';
import type { BillCard, BillKind, BillState, ProjectStatusInfo } from '@/components/customer/project-types';
import { PageHeader, Panel, cx } from '@/components/dashboard/ui';

/*
 * Customer > Billing & Payments.
 *
 * One row per project that has bills, like My Projects:
 * Code · Project title · Billing type (of the next bill) · Due. The contract
 * price, what is paid and what remains are on the project's billing page.
 * "Fully paid" only once the contract is verified and nothing remains;
 * before that, all bills paid so far is "Nothing due". Open a project to see its bills;
 * open a bill to pay it, see its payments or dispute it.
 */

export type BillingProject = {
    id: number;
    code: string;
    title: string;
    status: ProjectStatusInfo;
    url: string; // the project's billing page
    contractPrice: number | null;
    paid: number;
    remaining: number;
    /** The contract is verified and nothing remains. Before the contract, all bills paid is "Nothing due". */
    fullyPaid: boolean;
    nextBill: { kind: BillKind; title: string; dueDate: string; state: BillState; pastDue: boolean } | null;
    bills: BillCard[];
};

/** Projects per page. */
const PAGE_SIZE = 10;

type Filter = 'all' | 'unpaid' | 'under_review' | 'disputed' | 'paid';

const FILTERS: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'unpaid', label: 'Has unpaid' },
    { value: 'under_review', label: 'Under review' },
    { value: 'disputed', label: 'Disputed' },
    { value: 'paid', label: 'Fully paid' },
];

/** A project is in a filter when one of its bills is in that state ("Fully paid": all of them). */
const inFilter = (p: BillingProject, f: Filter): boolean => {
    const has = (...states: BillState[]) => p.bills.some((b) => states.includes(b.state));
    switch (f) {
        case 'unpaid':
            return has('unpaid', 'overdue');
        case 'under_review':
            return has('under_review');
        case 'disputed':
            return has('disputed');
        case 'paid':
            return p.fullyPaid;
        default:
            return true;
    }
};

export default function BillingList({ projects }: { projects: BillingProject[] }) {
    const [filter, setFilter] = useState<Filter>('all');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return projects.filter((p) => inFilter(p, filter) && (!q || [p.title, p.code].some((v) => v.toLowerCase().includes(q))));
    }, [projects, filter, query]);

    const count = (f: Filter) => projects.filter((p) => inFilter(p, f)).length;

    const { current, visible } = pageSlice(shown, page, PAGE_SIZE);

    return (
        <div className="mx-auto w-full max-w-[1150px]">
            <PageHeader title="Billing & Payments" description="Every bill for your projects. Open a bill to pay it, see its payments or dispute it." />

            {/* p-0! wins over the card's own p-6, so the table reaches the card's edges. */}
            <Panel className="overflow-hidden p-0!">
                <ListToolbar
                    filters={FILTERS}
                    value={filter}
                    onChange={(f) => {
                        setFilter(f);
                        setPage(1);
                    }}
                    count={count}
                    label="Filter bills"
                    query={query}
                    onQuery={(q) => {
                        setQuery(q);
                        setPage(1);
                    }}
                    allLabel="All projects"
                    placeholder="Search project or code"
                />

                {shown.length === 0 ? (
                    <ListEmpty icon={<Receipt className="size-8" />}>
                        {projects.length === 0 ? 'No bills yet. Your reservation fee bill appears here after your consultation.' : 'No projects match this filter.'}
                    </ListEmpty>
                ) : (
                    <ListTable
                        rows={visible}
                        rowKey={(p) => p.id}
                        href={(p) => p.url}
                        columns={[
                            { header: 'Code', cell: (p) => p.code, className: 'whitespace-nowrap font-semibold text-ink-soft' },
                            { header: 'Project title', cell: (p) => p.title, className: 'font-bold text-ink' },
                            { header: 'Billing type', cell: billingType, className: 'whitespace-nowrap text-ink' },
                            { header: 'Due', cell: (p) => nextDue(p).text, className: (p) => cx('whitespace-nowrap', nextDue(p).late ? 'font-semibold text-red-700' : 'text-ink') },
                        ]}
                        card={(p) => (
                            <ListCard
                                top={p.code}
                                tag={<span className={cx('text-xs font-semibold', nextDue(p).late ? 'text-red-700' : 'text-ink-soft')}>{nextDue(p).text}</span>}
                                title={p.title}
                                bottom={billingType(p)}
                            />
                        )}
                    />
                )}

                <ListPager page={current} pageSize={PAGE_SIZE} total={shown.length} onPage={setPage} />
            </Panel>
        </div>
    );
}

/** The type of the next bill to pay, e.g. "Down payment". */
function billingType(p: BillingProject): string {
    if (!p.nextBill) return '—';
    // An additional charge's title is its reason; the column shows the type.
    return p.nextBill.kind === 'additional_charge' ? 'Additional charge' : p.nextBill.title;
}

/** The "Due" cell: one short line. */
function nextDue(p: BillingProject): { text: string; late: boolean } {
    const next = p.nextBill;
    if (!next) return { text: p.fullyPaid ? 'Fully paid' : 'Nothing due', late: false };
    if (next.state === 'under_review') return { text: 'Under review', late: false };
    if (next.state === 'disputed') return { text: 'Disputed', late: false };
    const late = next.state === 'overdue' || next.pastDue;
    return { text: late ? `Overdue · ${formatDate(next.dueDate)}` : formatDate(next.dueDate), late };
}
