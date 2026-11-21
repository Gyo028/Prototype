import { Link, router } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, Clock, Download, ExternalLink, FileText, FileUp, FolderOpen, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { BillStatePill } from '@/components/customer/bill-card';
import BillPaymentPanel from '@/components/customer/bill-payment-panel';
import { Breadcrumbs } from '@/components/customer/billing-project';
import type { Texts } from '@/components/customer/bill-payment-panel';
import { formatDate, formatLongDate, peso } from '@/components/customer/project-types';
import type { BillCard, ProjectStatusInfo, ReservationFeeInfo } from '@/components/customer/project-types';
import { Field, GoldButton, OutlineButton, cx, textareaClass } from '@/components/dashboard/ui';

/*
 * Customer > Billing & Payments > one bill.
 *
 *  - Pay it by GCash (in full), and see its payments.
 *  - Dispute it: any bill not yet paid, with no payment under review, once.
 *    The reason is required (20–1,000 characters) and a proof file optional
 *    (PDF, JPG or PNG, up to 5 MB). While the dispute is open the bill can't
 *    be paid and can't go overdue. The Project Manager resolves it: upheld or
 *    adjusted (corrected amount) or rejected, with remarks and a new due date.
 */

export type BillDetail = BillCard & { issuedAt: string; status: string; description: string | null; texts: Texts };

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

export default function BillingDetail({ project, bill, payment, dispute }: Props) {
    const unpaid = bill.state !== 'paid';
    const billing = payment.billing;

    return (
        <div className="mx-auto w-full max-w-[1000px]">
            <Breadcrumbs
                items={[
                    { label: 'Billing & Payments', href: '/customer/billing' },
                    { label: project.title, href: project.billingUrl },
                    { label: bill.title },
                ]}
            />

            {/* One container: the bill, then paying it, its payments and the dispute. */}
            <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                <header className="flex flex-col gap-3 border-b border-black/10 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                    <div className="min-w-0">
                        <p className="truncate text-xs font-semibold tracking-wide text-ink-soft uppercase">
                            {project.code} · {project.title}
                        </p>
                        <h1 className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-bold text-ink sm:text-2xl">
                            {bill.title} <BillStatePill bill={bill} />
                        </h1>
                        <p className="mt-0.5 text-sm text-ink-soft">{bill.texts.heading}</p>
                    </div>
                    <Link
                        href={`/customer/projects/${project.id}`}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gold bg-white px-3 py-2 text-sm font-bold text-ink hover:bg-gold/10 sm:py-1.5"
                    >
                        <FolderOpen className="size-4" /> Open project
                    </Link>
                </header>

                {/* Amount, issued, due: one row on every screen (short dates on phones), the amount biggest. */}
                <dl className="grid grid-cols-3 gap-3 border-b border-black/10 bg-black/[0.015] px-4 py-4 text-sm sm:gap-4 sm:px-5">
                    <div>
                        <dt className="text-xs text-ink-soft">Amount</dt>
                        <dd className="text-base font-bold text-ink sm:text-xl">{peso(bill.amount)}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-ink-soft">Issued</dt>
                        <dd className="font-semibold text-ink">
                            <span className="sm:hidden">{formatDate(bill.issuedAt)}</span>
                            <span className="hidden sm:inline">{formatLongDate(bill.issuedAt)}</span>
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-ink-soft">Due date</dt>
                        <dd className={cx('font-semibold', unpaid && bill.pastDue ? 'text-red-700' : 'text-ink')}>
                            <span className="sm:hidden">{formatDate(bill.dueDate)}</span>
                            <span className="hidden sm:inline">{formatLongDate(bill.dueDate)}</span>
                        </dd>
                    </div>
                    {unpaid && billing?.status !== 'overdue' && bill.state !== 'disputed' && <p className="col-span-3 text-xs text-ink-soft">{bill.texts.dueNote}</p>}
                </dl>

                <div className="grid gap-4 p-4 sm:p-5">
                    {dispute.status && <DisputeStatus dispute={dispute} amount={bill.amount} />}

                    <BillPaymentPanel payment={payment} payUrl={`/customer/billing/${bill.id}/payments`} texts={bill.texts} showSummary={false} />

                    {dispute.canDispute && <DisputeForm billId={bill.id} dispute={dispute} />}
                </div>
            </section>
        </div>
    );
}

/* ---------------- Dispute ---------------- */

const RESOLUTION: Record<NonNullable<DisputeInfo['resolution']>, string> = {
    upheld: 'Your dispute was accepted',
    adjusted: 'The bill was adjusted',
    rejected: 'Your dispute was not accepted',
};

function DisputeStatus({ dispute: d, amount }: { dispute: DisputeInfo; amount: number }) {
    const resolved = d.status === 'resolved';

    return (
        <section className={cx('rounded-xl border p-4', resolved ? 'border-black/10 bg-white' : 'border-red-200 bg-red-50/60')}>
            <h3 className="mb-2 flex items-center gap-2 font-bold text-ink">
                {resolved ? <CheckCircle2 className="size-5 text-green-700" /> : <Clock className="size-5 text-red-700" />}
                {resolved && d.resolution ? RESOLUTION[d.resolution] : d.status === 'reviewed' ? 'Your dispute is being reviewed' : 'Dispute sent'}
            </h3>
            {!resolved && <p className="mb-3 text-sm text-ink">This bill is on hold: it can't be paid and won't go overdue until our Project Manager resolves your dispute.</p>}
            {resolved && (
                <div className="mb-3 text-sm text-ink">
                    {d.remarks && <p className="whitespace-pre-line">{d.remarks}</p>}
                    <p className="mt-1 text-ink-soft">
                        {d.resolution === 'rejected' ? `The amount stays at ${peso(amount)}.` : `The bill is now ${peso(amount)}.`}
                        {d.resolvedAt && ` Resolved ${formatLongDate(d.resolvedAt)}.`}
                    </p>
                </div>
            )}
            <div className="rounded-lg border border-black/10 bg-white p-3 text-sm">
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
        </section>
    );
}

function DisputeForm({ billId, dispute }: { billId: number; dispute: DisputeInfo }) {
    const { min, max, proofMaxMb, proofTypes } = dispute.rules;
    const [open, setOpen] = useState(false);
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
        if (text.length < min) return setErrors({ details: text ? `Please explain in at least ${min} characters.` : 'Tell us what is wrong with this bill.' });

        setSaving(true);
        router.post(
            `/customer/billing/${billId}/dispute`,
            { details: text, proof },
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => toast.success('Dispute sent. This bill is on hold until it is resolved.'),
                onError: (server) => setErrors(server as typeof errors),
                onFinish: () => setSaving(false),
            },
        );
    };

    if (!open) {
        return (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-4">
                <p className="text-sm text-ink">
                    <span className="font-bold">Something wrong with this bill?</span>{' '}
                    <span className="text-ink-soft">You can dispute it before paying. The bill is put on hold while we review it.</span>
                </p>
                <OutlineButton onClick={() => setOpen(true)} className="w-full sm:w-auto">
                    <AlertTriangle className="size-4" /> Dispute this bill
                </OutlineButton>
            </section>
        );
    }

    return (
        <section className="rounded-xl border border-black/10 bg-white p-4">
            <h3 className="mb-1 flex items-center gap-2 font-bold text-ink">
                <AlertTriangle className="size-5 text-gold-dark" /> Dispute this bill
            </h3>
            <p className="mb-4 text-sm text-ink-soft">Tell us what is wrong. A bill can be disputed once, and can't be paid while the dispute is open.</p>

            {errors.dispute && <p className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errors.dispute}</p>}

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
                            <button type="button" aria-label="Remove proof" onClick={clearProof} className="rounded p-1 text-ink-soft hover:bg-black/5">
                                <X className="size-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-black/20 p-4 text-center text-sm transition hover:border-gold hover:bg-gold/5"
                        >
                            <FileUp className="size-5 text-ink-soft" />
                            <span className="font-semibold text-ink">Attach a file</span>
                            <span className="text-xs text-ink-soft">PDF, JPG or PNG · up to {proofMaxMb} MB</span>
                        </button>
                    )}
                    <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
                </Field>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <OutlineButton onClick={() => setOpen(false)} disabled={saving}>
                        Cancel
                    </OutlineButton>
                    <GoldButton onClick={submit} disabled={saving}>
                        {saving ? 'Sending…' : 'Send Dispute'}
                    </GoldButton>
                </div>
            </div>
        </section>
    );
}
