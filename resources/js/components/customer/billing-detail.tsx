import { Link, router } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Download,
    ExternalLink,
    FileText,
    FileUp,
    FolderOpen,
    ListChecks,
    X,
    XCircle,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { BillStatePill } from '@/components/customer/bill-card';
import BillPaymentPanel from '@/components/customer/bill-payment-panel';
import { Breadcrumbs } from '@/components/customer/billing-project';
import type { Texts } from '@/components/customer/bill-payment-panel';
import { formatDate, formatLongDate, fromISO, peso } from '@/components/customer/project-types';
import type { BillCard, ProjectStatusInfo, ReservationFeeInfo } from '@/components/customer/project-types';
import { Field, GoldButton, OutlineButton, cx, textareaClass } from '@/components/dashboard/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/*
 * Customer > Billing & Payments > one bill. One container, like the project page:
 *
 *  - header: the bill, its status and Open project, with a band filling the rest
 *    of the row: what to do now (pay ₱X by the due date) or where things stand
 *  - what the amount is based on ("10% of your initial quotation ₱68,075.00"),
 *    with "View full quotation" (the line items in a pop-up)
 *  - the dispute's status, once there is one
 *  - paying it (BillPaymentPanel): steps, QR Ph, details, Send payment
 *
 * Disputing: any bill not yet paid, with no payment under review, once, from
 * the Dispute bill button beside Send payment. The reason is required
 * (20–1,000 characters) and a proof file optional (PDF, JPG or PNG, up to 5 MB).
 * While the dispute is open the bill can't be paid and can't go overdue. The
 * Project Manager resolves it: upheld or adjusted (corrected amount) or
 * rejected, with remarks and a new due date.
 */

type QuotationItem = { name: string; note: string | null; quantity: number; unitPrice: number | null; subtotal: number | null };

/** What the bill is a share of; null for additional charges. */
export type BillBasis = {
    percent: number;
    label: string; // "your initial quotation", "your budget", "your contract price"
    amount: number;
    quotation: { title: string; source: string; items: QuotationItem[]; total: number; note: string | null } | null;
} | null;

export type BillDetail = BillCard & { issuedAt: string; status: string; description: string | null; texts: Texts; basis: BillBasis };

export type DisputeInfo = {
    status: 'pending' | 'reviewed' | 'resolved' | null;
    details: string | null;
    submittedAt: string | null;
    proof: { name: string; url: string } | null;
    resolution: 'upheld' | 'rejected' | 'adjusted' | null;
    remarks: string | null;
    resolvedAt: string | null;
    canDispute: boolean;
    blockedReason: string | null;
    rules: { min: number; max: number; proofMaxMb: number; proofTypes: string[] };
};

type Props = {
    project: { id: number; code: string; title: string; status: ProjectStatusInfo; billingUrl: string };
    bill: BillDetail;
    payment: ReservationFeeInfo;
    dispute: DisputeInfo;
};

/** "Thu, Dec 3" */
const shortDay = (iso: string) => fromISO(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export default function BillingDetail({ project, bill, payment, dispute }: Props) {
    const [quotationOpen, setQuotationOpen] = useState(false);
    const [disputing, setDisputing] = useState(false);
    const disputeOpen = dispute.status === 'pending' || dispute.status === 'reviewed';
    // A payment waiting for verification or verified: "Your payment" shows what it is based on.
    const sent = payment.payments.some((p) => p.status === 'submitted' || p.status === 'verified');

    return (
        <div className="mx-auto w-full max-w-[1150px]">
            <Breadcrumbs
                items={[
                    { label: 'Billing & Payments', href: '/customer/billing' },
                    { label: project.title, href: project.billingUrl },
                    { label: bill.title },
                ]}
            />

            <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                {/* The bill, then the band filling the row to the edge (full width under it on phones). */}
                <div className="flex flex-col border-b border-black/10 md:flex-row md:items-stretch">
                    {/* Details (code, title, issued, status) with Open project on the right, centered against them. */}
                    <div className="flex min-w-0 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 md:w-1/2 md:shrink-0 lg:px-6">
                        <div className="min-w-0">
                            <p className="truncate text-xs font-semibold tracking-wide text-ink-soft uppercase">
                                {project.code} · {project.title}
                            </p>
                            <h1 className="mt-1 text-xl font-bold text-ink sm:text-2xl">{bill.title}</h1>
                            <p className="mt-0.5 text-sm text-ink-soft">Issued {formatDate(bill.issuedAt)}</p>
                            <div className="mt-2">
                                <BillStatePill bill={bill} />
                            </div>
                        </div>
                        <Link
                            href={`/customer/projects/${project.id}`}
                            className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gold bg-white px-3 py-2 text-sm font-bold whitespace-nowrap text-ink hover:bg-gold/10 sm:w-auto sm:py-1.5"
                        >
                            <FolderOpen className="size-4" /> Open project
                        </Link>
                    </div>
                    <BillBand bill={bill} payment={payment} disputeOpen={disputeOpen} />
                </div>

                {/* What the amount is based on, with the full quotation. Additional charges: what it is for. */}
                {/* Once a payment is sent this moves into "Your payment", so the amount shows once. */}
                {(bill.basis || bill.description) && !sent && (
                    <div className="flex flex-col gap-3 border-b border-black/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
                        <BasisLine bill={bill} />
                        {bill.basis?.quotation && (
                            <OutlineButton onClick={() => setQuotationOpen(true)} className="w-full shrink-0 sm:w-auto">
                                <ListChecks className="size-4" /> View full quotation
                            </OutlineButton>
                        )}
                    </div>
                )}

                {dispute.status && <DisputeStatus dispute={dispute} amount={bill.amount} />}

                <BillPaymentPanel
                    payment={payment}
                    payUrl={`/customer/billing/${bill.id}/payments`}
                    onDispute={dispute.canDispute ? () => setDisputing(true) : undefined}
                    hideBlockedReason={disputeOpen}
                    billName={{ title: bill.title, project: `${project.code} · ${project.title}` }}
                    basis={<BasisCaption bill={bill} onQuotation={() => setQuotationOpen(true)} />}
                />
            </section>

            {bill.basis?.quotation && (
                <QuotationDialog
                    open={quotationOpen}
                    onOpenChange={setQuotationOpen}
                    basis={bill.basis}
                    billTitle={bill.title}
                    billAmount={bill.amount}
                />
            )}
            {dispute.canDispute && <DisputeDialog open={disputing} onOpenChange={setDisputing} billId={bill.id} dispute={dispute} />}
        </div>
    );
}

/**
 * The header band: gold "What to do now" while the customer can pay, grey while
 * waiting (payment under review, dispute open), green once paid, red when overdue.
 * Status only: Open project sits with the bill's details on the left.
 */
function BillBand({ bill, payment, disputeOpen }: { bill: BillDetail; payment: ReservationFeeInfo; disputeOpen: boolean }) {
    const paid = bill.state === 'paid';
    const overdue = bill.state === 'overdue';
    const waiting = bill.state === 'under_review' || disputeOpen;

    const { tone, Icon, label, title, detail } = paid
        ? {
              tone: 'border-green-300 bg-green-50/70',
              Icon: CheckCircle2,
              label: 'Where things stand',
              title: 'Paid and verified',
              detail: bill.paidOn ? `Verified on ${formatLongDate(bill.paidOn)}.` : '',
          }
        : overdue
          ? {
                tone: 'border-red-300 bg-red-50',
                Icon: XCircle,
                label: 'Where things stand',
                title: 'This bill is overdue',
                detail: payment.payBlockedReason ?? '',
            }
          : disputeOpen
            ? {
                  tone: 'border-black/15 bg-black/[0.03]',
                  Icon: Clock,
                  label: 'Where things stand',
                  title: 'On hold while your dispute is reviewed',
                  detail: "It can't be paid and won't go overdue until it is resolved.",
              }
            : waiting
              ? {
                    tone: 'border-black/15 bg-black/[0.03]',
                    Icon: Clock,
                    label: 'Where things stand',
                    title: 'Payment sent, waiting for verification',
                    detail: bill.texts.pendingNote,
                }
              : {
                    tone: 'border-gold bg-gold/10',
                    Icon: AlertCircle,
                    label: 'What to do now',
                    title: `Pay ${peso(bill.amount)} by ${shortDay(bill.dueDate)}`,
                    detail: bill.texts.dueNote,
                };

    return (
        <div
            className={cx(
                'flex min-w-0 flex-1 flex-col gap-3 border-t-[3px] px-4 py-3 sm:flex-row sm:items-center sm:px-5 md:border-t-0 md:border-l-[3px] lg:px-6',
                tone,
            )}
        >
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <Icon
                    className={cx(
                        'mt-0.5 size-5 shrink-0',
                        paid ? 'text-green-700' : overdue ? 'text-red-600' : waiting ? 'text-ink-soft' : 'text-gold-dark',
                    )}
                />
                <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">{label}</p>
                    <p className={cx('font-bold', !paid && !waiting && bill.pastDue ? 'text-red-700' : 'text-ink')}>{title}</p>
                    {detail && <p className="text-sm text-ink-soft">{detail}</p>}
                </div>
            </div>
        </div>
    );
}

/** "10% of your initial quotation ₱68,075.00 = ₱6,807.50", noting an amount adjusted after a dispute. */
function BasisLine({ bill }: { bill: BillDetail }) {
    const b = bill.basis;

    if (!b) {
        // Additional charge: what it is for.
        return (
            <p className="text-sm text-ink">
                <span className="text-ink-soft">For: </span>
                {bill.description}
            </p>
        );
    }

    const adjusted = Math.abs((b.amount * b.percent) / 100 - bill.amount) > 0.01;

    return (
        <div className="min-w-0 text-sm">
            <p className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-ink-soft">
                    {b.percent}% of {b.label}
                </span>
                <span className="font-semibold text-ink">{peso(b.amount)}</span>
                <span className="text-ink-soft">=</span>
                <span className="text-base font-bold text-ink sm:text-lg">{peso(bill.amount)}</span>
            </p>
            {adjusted && <p className="text-xs text-ink-soft">The amount was adjusted after your dispute.</p>}
        </div>
    );
}

/** Under the amount in "Your payment": "10% of your budget ₱500,000", with View full quotation when there is one. */
function BasisCaption({ bill, onQuotation }: { bill: BillDetail; onQuotation: () => void }) {
    const b = bill.basis;

    if (!b) {
        return bill.description ? <span>For: {bill.description}</span> : null;
    }

    const adjusted = Math.abs((b.amount * b.percent) / 100 - bill.amount) > 0.01;

    return (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>
                {b.percent}% of {b.label} {peso(b.amount)}
                {adjusted && ' · adjusted after your dispute'}
            </span>
            {b.quotation && (
                <button type="button" onClick={onQuotation} className="inline-flex items-center gap-1 font-bold text-gold-dark hover:underline">
                    <ListChecks className="size-3.5" /> View full quotation
                </button>
            )}
        </span>
    );
}

/** The quotation the bill is based on: every item, the total, and this bill's share. */
function QuotationDialog({
    open,
    onOpenChange,
    basis,
    billTitle,
    billAmount,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    basis: NonNullable<BillBasis>;
    billTitle: string;
    billAmount: number;
}) {
    const q = basis.quotation!;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
                <DialogHeader>
                    <DialogTitle>{q.title}</DialogTitle>
                    <DialogDescription>{q.source}</DialogDescription>
                </DialogHeader>

                {/* Laptops: a table. Phones: one row per item with its numbers under the name. */}
                <div className="overflow-hidden rounded-lg border border-black/10">
                    <table className="w-full text-sm">
                        <thead className="hidden bg-neutral-50 text-xs text-ink-soft sm:table-header-group">
                            <tr>
                                <th className="px-3 py-2 text-left font-semibold">Item</th>
                                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                                <th className="px-3 py-2 text-right font-semibold">Unit price</th>
                                <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/10">
                            {q.items.map((item, i) => (
                                <tr key={i} className="align-top">
                                    <td className="px-3 py-2">
                                        <span className="block font-semibold text-ink">{item.name}</span>
                                        {item.note && <span className="block text-xs text-ink-soft">{item.note}</span>}
                                        <span className="block text-xs text-ink-soft sm:hidden">
                                            {item.quantity} × {item.unitPrice === null ? 'to be priced' : peso(item.unitPrice)}
                                        </span>
                                    </td>
                                    <td className="hidden px-3 py-2 text-right text-ink sm:table-cell">{item.quantity}</td>
                                    <td className="hidden px-3 py-2 text-right whitespace-nowrap text-ink sm:table-cell">
                                        {item.unitPrice === null ? '—' : peso(item.unitPrice)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap text-ink">
                                        {item.subtotal === null ? '—' : peso(item.subtotal)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t border-black/10">
                            <tr>
                                <td className="px-3 py-2 font-bold text-ink sm:hidden">Total</td>
                                <td colSpan={3} className="hidden px-3 py-2 font-bold text-ink sm:table-cell">
                                    Total
                                </td>
                                <td className="px-3 py-2 text-right font-bold whitespace-nowrap text-ink">{peso(q.total)}</td>
                            </tr>
                            <tr className="bg-gold/10">
                                <td className="px-3 py-2 font-bold text-gold-dark sm:hidden">
                                    {billTitle} ({basis.percent}%)
                                </td>
                                <td colSpan={3} className="hidden px-3 py-2 font-bold text-gold-dark sm:table-cell">
                                    {billTitle} ({basis.percent}%)
                                </td>
                                <td className="px-3 py-2 text-right font-bold whitespace-nowrap text-gold-dark">{peso(billAmount)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {q.note && <p className="text-xs text-ink-soft">{q.note}</p>}

                <DialogFooter>
                    <OutlineButton onClick={() => onOpenChange(false)}>Close</OutlineButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ---------------- Dispute ---------------- */

const RESOLUTION: Record<NonNullable<DisputeInfo['resolution']>, string> = {
    upheld: 'Your dispute was accepted',
    adjusted: 'The bill was adjusted',
    rejected: 'Your dispute was not accepted',
};

/** The dispute inside the bill card: open (on hold) or resolved, with what the customer sent. */
function DisputeStatus({ dispute: d, amount }: { dispute: DisputeInfo; amount: number }) {
    const resolved = d.status === 'resolved';

    return (
        <section className={cx('flex items-start gap-3 border-b border-black/10 px-4 py-4 sm:px-5 lg:px-6', resolved ? 'bg-white' : 'bg-red-50/60')}>
            {resolved ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-700" />
            ) : (
                <Clock className="mt-0.5 size-5 shrink-0 text-red-700" />
            )}
            <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">
                    {resolved && d.resolution
                        ? RESOLUTION[d.resolution]
                        : d.status === 'reviewed'
                          ? 'Your dispute is being reviewed'
                          : 'Dispute sent'}
                </p>
                {resolved ? (
                    <div className="text-sm text-ink">
                        {d.remarks && <p className="whitespace-pre-line">{d.remarks}</p>}
                        <p className="mt-1 text-ink-soft">
                            {d.resolution === 'rejected' ? `The amount stays at ${peso(amount)}.` : `The bill is now ${peso(amount)}.`}
                            {d.resolvedAt && ` Resolved ${formatLongDate(d.resolvedAt)}.`}
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-ink-soft">Our Project Manager is checking it.</p>
                )}
                <div className="mt-2 rounded-lg border border-black/10 bg-white p-3 text-sm">
                    <p className="text-xs font-semibold text-ink-soft">Your dispute{d.submittedAt && ` · ${formatLongDate(d.submittedAt)}`}</p>
                    <p className="mt-1 whitespace-pre-line text-ink">{d.details}</p>
                    {d.proof && (
                        <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-gold-dark">
                            <a href={d.proof.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                                <ExternalLink className="size-3.5" /> {d.proof.name}
                            </a>
                            <a href={`${d.proof.url}?download=1`} className="inline-flex items-center gap-1 hover:underline">
                                <Download className="size-3.5" /> Download
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

/** "Dispute bill" pop-up, opened from beside Send payment. */
function DisputeDialog({
    open,
    onOpenChange,
    billId,
    dispute,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    billId: number;
    dispute: DisputeInfo;
}) {
    const { min, max, proofMaxMb, proofTypes } = dispute.rules;
    const [details, setDetails] = useState('');
    const [proof, setProof] = useState<File | null>(null);
    const [errors, setErrors] = useState<Partial<Record<'details' | 'proof' | 'dispute', string>>>({});
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const pick = (f: File | undefined) => {
        if (!f) return;
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        if (!proofTypes.includes(ext)) return setErrors((e) => ({ ...e, proof: 'The proof must be a PDF, JPG or PNG file.' }));
        if (f.size > proofMaxMb * 1024 * 1024) return setErrors((e) => ({ ...e, proof: `The proof must be ${proofMaxMb} MB or smaller.` }));
        setErrors((e) => ({ ...e, proof: undefined }));
        setProof(f);
    };

    const clearProof = () => {
        setProof(null);
        if (fileRef.current) fileRef.current.value = '';
    };

    const submit = () => {
        const text = details.trim();
        if (text.length < min)
            return setErrors({ details: text ? `Please explain in at least ${min} characters.` : 'Tell us what is wrong with this bill.' });

        setSaving(true);
        router.post(
            `/customer/billing/${billId}/dispute`,
            { details: text, proof },
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Dispute sent. This bill is on hold until it is resolved.');
                    onOpenChange(false);
                },
                onError: (server) => setErrors(server as typeof errors),
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto p-4 sm:max-w-xl sm:p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="size-5 text-gold-dark" /> Dispute this bill
                    </DialogTitle>
                    <DialogDescription>
                        Tell us what is wrong. A bill can be disputed once, and can&apos;t be paid while the dispute is open.
                    </DialogDescription>
                </DialogHeader>

                {errors.dispute && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errors.dispute}</p>}

                <div className="grid gap-4">
                    <Field label="What is wrong with this bill?" htmlFor="dispute-details" required error={errors.details}>
                        <textarea
                            id="dispute-details"
                            rows={4}
                            maxLength={max}
                            value={details}
                            onChange={(e) => {
                                setDetails(e.target.value);
                                setErrors((x) => ({ ...x, details: undefined }));
                            }}
                            placeholder="e.g. The down payment should be based on the revised quotation of ₱200,000, not ₱210,400."
                            className={cx(textareaClass, errors.details && 'border-red-500')}
                        />
                        <span className="mt-1 block text-right text-xs text-ink-soft">
                            {details.trim().length}/{max}
                        </span>
                    </Field>

                    <Field label="Proof (optional)" error={errors.proof}>
                        {proof ? (
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-black/15 px-3 py-2 text-sm">
                                <span className="flex min-w-0 items-center gap-2">
                                    <FileText className="size-4 shrink-0 text-gold-dark" />
                                    <span className="truncate text-ink">{proof.name}</span>
                                </span>
                                <button
                                    type="button"
                                    aria-label="Remove proof"
                                    onClick={clearProof}
                                    className="rounded p-1 text-ink-soft hover:bg-black/5"
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="flex w-full items-center gap-3 rounded-lg border border-dashed border-black/20 p-3 text-left text-sm transition hover:border-gold hover:bg-gold/5"
                            >
                                <FileUp className="size-5 shrink-0 text-ink-soft" />
                                <span>
                                    <span className="block font-semibold text-ink">Attach a file</span>
                                    <span className="block text-xs text-ink-soft">PDF, JPG or PNG · up to {proofMaxMb} MB</span>
                                </span>
                            </button>
                        )}
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => pick(e.target.files?.[0])}
                        />
                    </Field>
                </div>

                <DialogFooter>
                    <OutlineButton onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </OutlineButton>
                    <GoldButton onClick={submit} disabled={saving}>
                        {saving ? 'Sending…' : 'Send Dispute'}
                    </GoldButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
