import { Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Receipt, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDate, peso, statusText, statusTone } from '@/components/customer/project-types';
import type { BillCard, BillState, ProjectStatusInfo } from '@/components/customer/project-types';
import { PageHeader, Panel, Pill, cx, inputClass } from '@/components/dashboard/ui';

/*
 * Customer > Billing & Payments.
 *
 * One row per project that has bills, like My Projects: the contract price,
 * what is paid, what remains and the next bill due. Open a project to see its
 * bills; open a bill to pay it, see its payments or dispute it.
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
    nextBill: { title: string; dueDate: string; state: BillState; pastDue: boolean } | null;
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
            return p.bills.every((b) => b.state === 'paid');
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

    const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const start = (current - 1) * PAGE_SIZE;
    const visible = shown.slice(start, start + PAGE_SIZE);

    return (
        <div className="mx-auto w-full max-w-[1150px]">
            <PageHeader title="Billing & Payments" description="Every bill for your projects. Open a bill to pay it, see its payments or dispute it." />

            <Panel className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 p-4">
                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter bills">
                        {FILTERS.map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                role="tab"
                                aria-selected={filter === f.value}
                                onClick={() => {
                                    setFilter(f.value);
                                    setPage(1);
                                }}
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
                            placeholder="Search project or code"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setPage(1);
                            }}
                        />
                    </label>
                </div>

                {shown.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-ink-soft">
                        <Receipt className="size-8" />
                        <p className="text-sm">
                            {projects.length === 0
                                ? 'No bills yet. Your reservation fee bill appears here after your consultation.'
                                : 'No projects match this filter.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-black/[0.03] text-xs tracking-wide text-ink-soft uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Project</th>
                                    <th className="px-4 py-3 text-right font-semibold">Contract price</th>
                                    <th className="px-4 py-3 text-right font-semibold">Paid</th>
                                    <th className="px-4 py-3 text-right font-semibold">Remaining</th>
                                    <th className="px-4 py-3 font-semibold">Next bill due</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((p) => (
                                    <ProjectRow key={p.id} project={p} />
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

function ProjectRow({ project: p }: { project: BillingProject }) {
    const next = p.nextBill;

    return (
        <tr
            className="cursor-pointer border-t border-black/10 transition hover:bg-gold/5"
            // The whole row opens the project's bills; the link in the last cell is there for keyboard users.
            onClick={() => router.visit(p.url)}
        >
            <td className="px-4 py-3">
                <div className="font-bold text-ink">{p.title}</div>
                <div className="text-xs text-ink-soft">{p.code}</div>
                <div className="mt-1">
                    <Pill tone={statusTone({ status: p.status })}>{statusText({ status: p.status })}</Pill>
                </div>
            </td>
            <td className="px-4 py-3 text-right whitespace-nowrap text-ink">{p.contractPrice !== null ? peso(p.contractPrice) : '—'}</td>
            <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-green-700">{peso(p.paid)}</td>
            <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-gold-dark">{peso(p.remaining)}</td>
            <td className="px-4 py-3">
                {next ? (
                    <>
                        <div className="text-ink">{next.title}</div>
                        <div className={cx('text-xs', next.pastDue && next.state === 'unpaid' ? 'text-red-700' : 'text-ink-soft')}>
                            {next.state === 'under_review' ? 'Under review' : next.state === 'disputed' ? 'Disputed' : `Due ${formatDate(next.dueDate)}`}
                        </div>
                    </>
                ) : (
                    <span className="text-ink-soft">—</span>
                )}
            </td>
            <td className="px-4 py-3 text-right">
                <Link
                    href={p.url}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap text-gold-dark hover:underline"
                >
                    Open <ChevronRight className="size-4" />
                </Link>
            </td>
        </tr>
    );
}
