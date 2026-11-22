import { router } from '@inertiajs/react';
import { Banknote, Hourglass, ReceiptText, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { PageHeader, Panel, Pill, cx, inputClass } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import { paymentTone } from '@/components/project-manager/payment-review';
import { formatDate } from '@/components/project-manager/request-details';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';
import { billingStatus, verifiedTotal } from '@/data/project-manager/payments';
import type { BillingStatus, Payment, PaymentType } from '@/data/project-manager/payments';
import { getSampleProjects, isNotProceeding } from '@/data/project-manager/projects';
import type { Project } from '@/data/project-manager/projects';

/*
 * Billing and Payments (revision, Nov 19): one stand-alone page listing every bill and every
 * payment of every project. Read only: the Project Manager still verifies payments, records
 * cash / cheque, adds charges and handles disputes inside the steps
 * (Reservation Fee in Ocular Visit, Payments in Contract). Click a row to open the project.
 */

type BillRow = {
    key: string;
    project: Project;
    type: PaymentType;
    amount: number;
    paid: number;
    status: BillingStatus;
};

type PaymentRow = Payment & { project: Project };

type Tab = 'Billings' | 'Payments';
type BillFilter = 'All' | BillingStatus;
const BILL_FILTERS: BillFilter[] = ['All', 'Unpaid', 'For Verification', 'Paid'];

const billTone: Record<BillingStatus, PillTone> = { Paid: 'green', 'For Verification': 'yellow', Unpaid: 'red' };

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

/** Every bill of one project: the reservation fee (once issued after the consultation), then the other billings. */
function billsOf(p: Project): BillRow[] {
    const rows: BillRow[] = [];
    if (p.consultation && !isNotProceeding(p)) {
        const paid = verifiedTotal(null, p.payments);
        const pending = p.payments.some((x) => x.billingId === null && x.status === 'For Verification');
        rows.push({
            key: `${p.id}-reservation`,
            project: p,
            type: 'Reservation Fee',
            amount: p.reservationFee.amount,
            // A verified reservation fee counts as fully paid, even when its payment record is not listed.
            paid: p.reservationFee.paid ? p.reservationFee.amount : Math.min(paid, p.reservationFee.amount),
            status: p.reservationFee.paid ? 'Paid' : pending ? 'For Verification' : 'Unpaid',
        });
    }
    for (const b of p.billings) {
        rows.push({
            key: `${p.id}-${b.id}`,
            project: p,
            type: b.type,
            amount: b.amount,
            paid: Math.min(b.amount, verifiedTotal(b.id, p.payments)),
            status: billingStatus(b, p.payments),
        });
    }
    return rows;
}

function StatCard({ label, value, icon, tone }: { label: string; value: string | number; icon: ReactNode; tone: string }) {
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
    projects?: Project[];
};

export default function BillingPayments({ projects }: Props) {
    const all = projects ?? getSampleProjects();

    const [tab, setTab] = useState<Tab>('Billings');
    const [filter, setFilter] = useState<BillFilter>('All');
    const [query, setQuery] = useState('');

    const bills = all.flatMap(billsOf);
    const payments: PaymentRow[] = all.flatMap((p) => p.payments.map((x) => ({ ...x, project: p })));

    const totalBilled = bills.reduce((s, b) => s + b.amount, 0);
    const collected = bills.reduce((s, b) => s + b.paid, 0);
    const toVerify = payments.filter((x) => x.status === 'For Verification').length;

    const q = query.trim().toLowerCase();
    const matches = (p: Project, extra = '') => !q || p.code.toLowerCase().includes(q) || extra.toLowerCase().includes(q);

    const visibleBills = bills
        .filter((b) => filter === 'All' || b.status === filter)
        .filter((b) => matches(b.project, b.type))
        .sort((a, b) => a.project.code.localeCompare(b.project.code));

    const visiblePayments = payments
        .filter((x) => matches(x.project, `${x.code} ${x.type}`))
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)); // newest first

    const open = (p: Project) => router.visit(`${PROJECTS_URL}/${p.id}`);
    const rowProps = (p: Project) => ({
        tabIndex: 0,
        onClick: () => open(p),
        onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && open(p),
        className: 'cursor-pointer transition hover:bg-gold/10 focus-visible:bg-gold/10 focus-visible:outline-none',
    });

    return (
        <>
            <PageHeader
                title="Billing and Payments"
                description="Every bill and payment of every project. Open a row to verify payments or record cash in the project's steps."
            />

            <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total billed" value={peso(totalBilled)} icon={<ReceiptText className="size-5" />} tone="bg-gold/15 text-gold-dark" />
                <StatCard label="Collected" value={peso(collected)} icon={<Wallet className="size-5" />} tone="bg-green-100 text-green-700" />
                <StatCard label="Outstanding" value={peso(totalBilled - collected)} icon={<Banknote className="size-5" />} tone="bg-red-100 text-red-700" />
                <StatCard label="Payments to verify" value={toVerify} icon={<Hourglass className="size-5" />} tone="bg-amber-100 text-amber-700" />
            </div>

            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm" role="tablist" aria-label="Billings or payments">
                    {(['Billings', 'Payments'] as Tab[]).map((t) => (
                        <button
                            key={t}
                            type="button"
                            role="tab"
                            aria-selected={tab === t}
                            onClick={() => setTab(t)}
                            className={cx('rounded-lg px-4 py-1.5 text-sm font-semibold transition', tab === t ? 'bg-gold text-white' : 'text-ink-soft hover:bg-gold/10')}
                        >
                            {t} <span className="ml-1 text-xs opacity-80">{t === 'Billings' ? bills.length : payments.length}</span>
                        </button>
                    ))}
                </div>
                {tab === 'Billings' && (
                    <select value={filter} onChange={(e) => setFilter(e.target.value as BillFilter)} aria-label="Filter by status" className={cx(inputClass, 'max-w-[220px]')}>
                        {BILL_FILTERS.map((f) => (
                            <option key={f} value={f}>
                                {f === 'All' ? 'All statuses' : f}
                            </option>
                        ))}
                    </select>
                )}
                <div className="ml-auto w-full max-w-sm">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={tab === 'Billings' ? 'Search by project no. or bill...' : 'Search by project no. or payment no...'}
                        aria-label="Search"
                        className={inputClass}
                    />
                </div>
            </div>

            <Panel className="overflow-x-auto p-0">
                {tab === 'Billings' ? (
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-neutral-200/70 text-xs text-ink-soft uppercase">
                            <tr>
                                <th className="px-4 py-3 font-medium">Project No.</th>
                                <th className="px-2 py-3 font-medium">Bill</th>
                                <th className="px-2 py-3 text-right font-medium">Amount</th>
                                <th className="px-2 py-3 text-right font-medium">Paid</th>
                                <th className="px-2 py-3 text-right font-medium">Balance</th>
                                <th className="px-2 py-3 pr-4 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/10">
                            {visibleBills.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-ink-soft">
                                        No billings found.
                                    </td>
                                </tr>
                            ) : (
                                visibleBills.map((b) => (
                                    <tr key={b.key} aria-label={`Open ${b.project.code}`} {...rowProps(b.project)}>
                                        <td className="px-4 py-3 font-semibold whitespace-nowrap text-ink">{b.project.code}</td>
                                        <td className="px-2 py-3 text-ink">{b.type}</td>
                                        <td className="px-2 py-3 text-right whitespace-nowrap text-ink">{peso(b.amount)}</td>
                                        <td className="px-2 py-3 text-right whitespace-nowrap text-ink">{peso(b.paid)}</td>
                                        <td className="px-2 py-3 text-right whitespace-nowrap text-ink">{peso(b.amount - b.paid)}</td>
                                        <td className="px-2 py-3 pr-4 whitespace-nowrap">
                                            <Pill tone={billTone[b.status]}>{b.status}</Pill>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                                    ) : (
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-neutral-200/70 text-xs text-ink-soft uppercase">
                            <tr>
                                <th className="px-4 py-3 font-medium">Payment No.</th>
                                <th className="px-2 py-3 font-medium">Project No.</th>
                                <th className="px-2 py-3 font-medium">For</th>
                                <th className="px-2 py-3 text-right font-medium">Amount</th>
                                <th className="px-2 py-3 font-medium">Method</th>
                                <th className="px-2 py-3 font-medium">Date Paid</th>
                                <th className="px-2 py-3 pr-4 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/10">
                            {visiblePayments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-ink-soft">
                                        No payments found.
                                    </td>
                                </tr>
                            ) : (
                                visiblePayments.map((x) => (
                                    <tr key={`${x.project.id}-${x.id}`} aria-label={`Open ${x.project.code}`} {...rowProps(x.project)}>
                                        <td className="px-4 py-3 font-semibold whitespace-nowrap text-ink">{x.code}</td>
                                        <td className="px-2 py-3 whitespace-nowrap text-ink">{x.project.code}</td>
                                        <td className="px-2 py-3 text-ink">{x.type}</td>
                                        <td className="px-2 py-3 text-right whitespace-nowrap text-ink">{peso(x.amount)}</td>
                                        <td className="px-2 py-3 text-ink">{x.method}</td>
                                        <td className="px-2 py-3 whitespace-nowrap text-ink">{formatDate(x.paidOn)}</td>
                                        <td className="px-2 py-3 pr-4 whitespace-nowrap">
                                            <Pill tone={paymentTone[x.status]}>{x.status}</Pill>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </Panel>
        </>
    );
}