import { Link } from '@inertiajs/react';
import { ArrowRight, Wallet } from 'lucide-react';
import { formatLongDate, peso } from '@/components/customer/project-types';
import type { BillCard as Bill, BillState } from '@/components/customer/project-types';
import { Pill, cx } from '@/components/dashboard/ui';

/*
 * A bill as a small card with a link to its own page on Billing & Payments,
 * where it is paid or disputed. Used on the project page (reservation fee,
 * down payment, balance) and in the Billing & Payments list.
 */

export const BILL_STATE: Record<BillState, { label: string; tone: 'yellow' | 'blue' | 'green' | 'red' | 'gray' }> = {
    unpaid: { label: 'Unpaid', tone: 'yellow' },
    under_review: { label: 'Under review', tone: 'blue' },
    disputed: { label: 'Disputed', tone: 'red' },
    paid: { label: 'Paid', tone: 'green' },
    overdue: { label: 'Overdue', tone: 'red' },
};

export function BillStatePill({ bill }: { bill: Bill }) {
    const s = BILL_STATE[bill.state];

    return <Pill tone={s.tone}>{bill.state === 'unpaid' && bill.pastDue ? 'Past due' : s.label}</Pill>;
}

/** The line under the amount: due date, paid date or what is happening. */
export function billStatusLine(bill: Bill): string {
    switch (bill.state) {
        case 'paid':
            return bill.paidOn ? `Paid on ${formatLongDate(bill.paidOn)}` : 'Paid';
        case 'under_review':
            return 'Payment sent, waiting for verification';
        case 'disputed':
            return 'On hold while your dispute is reviewed';
        case 'overdue':
            return `Was due ${formatLongDate(bill.dueDate)}`;
        default:
            return `${bill.lastPaymentRejected ? 'Last payment not accepted · ' : ''}Due ${formatLongDate(bill.dueDate)}`;
    }
}

export default function BillCard({ bill, note, className }: { bill: Bill; note?: string; className?: string }) {
    const pay = bill.canPay;

    return (
        <section className={cx('rounded-xl border p-4', pay ? 'border-gold/60 bg-gold/5' : 'border-black/10 bg-white', className)}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-gold-dark">
                        <Wallet className="size-5" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs text-ink-soft">{bill.title}</p>
                        <p className="text-xl leading-tight font-bold text-ink">{peso(bill.amount)}</p>
                        <p className={cx('text-xs', bill.pastDue && bill.state === 'unpaid' ? 'text-red-700' : 'text-ink-soft')}>{billStatusLine(bill)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <BillStatePill bill={bill} />
                    <Link
                        href={bill.url}
                        className={cx(
                            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold',
                            pay ? 'bg-gold text-white hover:brightness-105' : 'border border-black/15 text-ink hover:border-gold',
                        )}
                    >
                        {pay ? 'Pay now' : 'View bill'} <ArrowRight className="size-4" />
                    </Link>
                </div>
            </div>
            {note && <p className="mt-3 text-xs text-ink-soft">{note}</p>}
        </section>
    );
}
