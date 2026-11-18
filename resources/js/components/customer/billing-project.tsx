import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react';
import { BillStatePill } from '@/components/customer/bill-card';
import type { BillingProject } from '@/components/customer/billing-list';
import { ListCard, ListTable } from '@/components/customer/list-parts';
import { formatDate, peso, statusText, statusTone } from '@/components/customer/project-types';
import type { BillCard } from '@/components/customer/project-types';
import { Pill, cx } from '@/components/dashboard/ui';

/*
 * Customer > Billing & Payments > one project: its totals and its bills.
 * Bills: Bill · Due date · Amount · Status. The whole row opens the bill;
 * a bill that can be paid also gets a Pay button. Why a payment was rejected
 * and other details are on the bill's page.
 */

export default function BillingProjectView({ project: p }: { project: BillingProject }) {
    return (
        <div className="mx-auto w-full max-w-[1150px]">
            <Breadcrumbs items={[{ label: 'Billing & Payments', href: '/customer/billing' }, { label: p.title }]} />

            <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                <header className="flex flex-col gap-3 border-b border-black/10 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{p.code}</p>
                        <h1 className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-bold text-ink sm:text-2xl">
                            <span className="break-words">{p.title}</span>
                            <Pill tone={statusTone({ status: p.status })} className="whitespace-nowrap">
                                {statusText({ status: p.status })}
                            </Pill>
                        </h1>
                    </div>
                    <Link
                        href={`/customer/projects/${p.id}`}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gold bg-white px-3 py-2 text-sm font-bold text-ink hover:bg-gold/10 sm:py-1.5"
                    >
                        <FolderOpen className="size-4" /> Open project
                    </Link>
                </header>

                {/* Three short figures: one row on every screen, smaller on phones. */}
                <dl className="grid grid-cols-3 gap-3 border-b border-black/10 bg-black/[0.015] px-4 py-4 text-sm sm:gap-4 sm:px-5">
                    <div>
                        <dt className="text-xs text-ink-soft">Contract price</dt>
                        <dd className="text-base font-bold text-ink sm:text-xl">{p.contractPrice !== null ? peso(p.contractPrice) : '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-ink-soft">Paid</dt>
                        <dd className="text-base font-bold text-green-700 sm:text-xl">{peso(p.paid)}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-ink-soft">Remaining</dt>
                        <dd className="text-base font-bold text-gold-dark sm:text-xl">{peso(p.remaining)}</dd>
                    </div>
                    {p.contractPrice === null && (
                        <p className="col-span-3 text-xs text-ink-soft">The contract price is set when you approve your design proposal.</p>
                    )}
                </dl>

                <ListTable
                    rows={p.bills}
                    rowKey={(b) => b.id}
                    href={(b) => b.url}
                    columns={[
                        { header: 'Bill', cell: (b) => b.title, className: 'font-semibold text-ink' },
                        { header: 'Due date', cell: (b) => formatDate(b.dueDate), className: (b) => cx('whitespace-nowrap', isLate(b) ? 'font-semibold text-red-700' : 'text-ink') },
                        { header: 'Amount', cell: (b) => peso(b.amount), align: 'right', className: 'font-semibold text-ink' },
                        { header: 'Status', cell: (b) => <BillStatePill bill={b} /> },
                    ]}
                    card={(b) => (
                        <ListCard
                            top={<span className={isLate(b) ? 'text-red-700' : undefined}>Due {formatDate(b.dueDate)}</span>}
                            tag={<BillStatePill bill={b} />}
                            title={b.title}
                            bottom={<span className="font-semibold text-ink">{peso(b.amount)}</span>}
                        />
                    )}
                    // A bill that can be paid gets a Pay button: one tap to the payment form.
                    action={(b) =>
                        b.canPay ? (
                            <Link
                                href={`${b.url}#pay`}
                                className="inline-flex items-center rounded-lg bg-gold px-3 py-1.5 text-xs font-bold whitespace-nowrap text-white hover:bg-gold-dark"
                            >
                                Pay
                            </Link>
                        ) : null
                    }
                />
            </section>
        </div>
    );
}

const isLate = (b: BillCard) => b.state === 'overdue' || (b.state === 'unpaid' && b.pastDue);

/**
 * Billing & Payments › Project › Bill. The last item is the current page.
 * Phones show only a back link to the page above ("‹ Project title"), so a long
 * title doesn't wrap over several lines.
 */
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
    const parent = [...items].reverse().find((i) => i.href);

    return (
        <nav aria-label="Breadcrumb" className="mb-4">
            {parent?.href && (
                <Link href={parent.href} className="flex max-w-full items-center gap-1 text-sm font-bold text-gold-dark hover:underline sm:hidden">
                    <ChevronLeft aria-hidden className="size-4 shrink-0" />
                    <span className="truncate">{parent.label}</span>
                </Link>
            )}
            <ol className="hidden flex-wrap items-center gap-1 text-sm sm:flex">
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
