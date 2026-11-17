import { Link, router } from '@inertiajs/react';
import { ChevronRight, FolderOpen } from 'lucide-react';
import { BillStatePill, billStatusLine } from '@/components/customer/bill-card';
import type { BillingProject } from '@/components/customer/billing-list';
import { formatDate, peso, statusText, statusTone } from '@/components/customer/project-types';
import type { BillCard } from '@/components/customer/project-types';
import { Pill, cx } from '@/components/dashboard/ui';

/*
 * Customer > Billing & Payments > one project: its totals and its bills.
 * Open a bill to pay it, see its payments or dispute it.
 */

export default function BillingProjectView({ project: p }: { project: BillingProject }) {
    return (
        <div className="mx-auto w-full max-w-[1150px]">
            <Breadcrumbs items={[{ label: 'Billing & Payments', href: '/customer/billing' }, { label: p.title }]} />

            <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{p.code}</p>
                        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-bold text-ink">
                            {p.title} <Pill tone={statusTone({ status: p.status })}>{statusText({ status: p.status })}</Pill>
                        </h1>
                    </div>
                    <Link
                        href={`/customer/projects/${p.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gold bg-white px-3 py-1.5 text-sm font-bold text-ink hover:bg-gold/10"
                    >
                        <FolderOpen className="size-4" /> Open project
                    </Link>
                </header>

                <dl className="grid gap-4 border-b border-black/10 bg-black/[0.015] px-5 py-4 text-sm sm:grid-cols-3">
                    <div>
                        <dt className="text-xs text-ink-soft">Contract price</dt>
                        <dd className="text-xl font-bold text-ink">{p.contractPrice !== null ? peso(p.contractPrice) : '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-ink-soft">Paid</dt>
                        <dd className="text-xl font-bold text-green-700">{peso(p.paid)}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-ink-soft">Remaining</dt>
                        <dd className="text-xl font-bold text-gold-dark">{peso(p.remaining)}</dd>
                    </div>
                    {p.contractPrice === null && (
                        <p className="text-xs text-ink-soft sm:col-span-3">The contract price is set when you approve your design proposal.</p>
                    )}
                </dl>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-black/[0.03] text-xs tracking-wide text-ink-soft uppercase">
                            <tr>
                                <th className="px-5 py-3 font-semibold">Bill</th>
                                <th className="px-4 py-3 font-semibold">Due date</th>
                                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {p.bills.map((b) => (
                                <BillRow key={b.id} bill={b} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

function BillRow({ bill: b }: { bill: BillCard }) {
    const late = b.state === 'overdue' || (b.state === 'unpaid' && b.pastDue);

    return (
        <tr className="cursor-pointer border-t border-black/10 transition hover:bg-gold/5" onClick={() => router.visit(b.url)}>
            <td className="px-5 py-3 font-semibold text-ink">{b.title}</td>
            <td className={cx('px-4 py-3 whitespace-nowrap', late ? 'text-red-700' : 'text-ink')}>{formatDate(b.dueDate)}</td>
            <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-ink">{peso(b.amount)}</td>
            <td className="px-4 py-3">
                <BillStatePill bill={b} />
                {/* The due date has its own column, so only say more when there is more to say. */}
                {(b.state !== 'unpaid' || b.lastPaymentRejected) && <div className="mt-1 text-xs text-ink-soft">{billStatusLine(b)}</div>}
            </td>
            <td className="px-5 py-3 text-right">
                <Link
                    href={b.url}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap text-gold-dark hover:underline"
                >
                    {b.canPay ? 'Pay' : 'View'} <ChevronRight className="size-4" />
                </Link>
            </td>
        </tr>
    );
}

/** Billing & Payments › Project › Bill. The last item is the current page. */
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
    return (
        <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex flex-wrap items-center gap-1 text-sm">
                {items.map((item, i) => (
                    <li key={i} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight aria-hidden className="size-4 text-ink-soft" />}
                        {item.href ? (
                            <Link href={item.href} className="font-bold text-gold-dark hover:underline">
                                {item.label}
                            </Link>
                        ) : (
                            <span aria-current="page" className="font-semibold text-ink">
                                {item.label}
                            </span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}
