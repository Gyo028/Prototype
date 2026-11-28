import { router } from '@inertiajs/react';
import {
    AlertTriangle,
    Check,
    ChevronDown,
    Clock,
    Copy,
    Download,
    Eye,
    FileText,
    FileUp,
    History,
    Info,
    Replace,
    Smartphone,
    Trash2,
    XCircle,
    ZoomIn,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { formatDate, peso, toISO } from '@/components/customer/project-types';
import type { ReservationFeeInfo, ReservationPayment } from '@/components/customer/project-types';
import { Field, GoldButton, OutlineButton, Pill, cx, inputClass } from '@/components/dashboard/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/*
 * Paying a bill, on its own page in Billing & Payments (reservation fee, down
 * payment, remaining balance, additional charge). Sits edge to edge inside the
 * bill's card, below the header, like the ocular visit booking:
 *
 *  - can pay: the 3 steps across the top (scan, enter details, send), the
 *    QR Ph code with how to use it on the left and the details on the right
 *    (the receipt shown as a thumbnail), then Send payment (and Dispute bill
 *    beside it when the bill can be disputed). Send payment opens "Send this
 *    payment?" with the details and the receipt; Confirm and send posts it.
 *  - sent or paid: "Your payment", what was sent (the header band says whether it
 *    is waiting or paid)
 *  - can't pay (overdue…): the reason
 * Earlier payments (not accepted ones) are folded at the bottom.
 *
 * Paid in full in one payment by QR Ph (any bank or e-wallet app): the customer
 * enters the reference number and the date paid (any past date, so they can pay
 * now and send the details later), and uploads the receipt (PDF, JPG or PNG,
 * up to 5 MB). The amount is always the bill's full amount. The
 * Project Manager then verifies it; a rejected payment shows its reason and the
 * customer pays again.
 */

type Props = {
    payment: ReservationFeeInfo;
    /** Where the payment is sent, e.g. /customer/billing/12/payments. */
    payUrl: string;
    /** Opens the dispute pop-up; only passed while the bill can be disputed. */
    onDispute?: () => void;
    /** Hide the "can't pay" reason (the page already explains it, e.g. an open dispute). */
    hideBlockedReason?: boolean;
    /** Under the amount in "Your payment" once sent, e.g. "10% of your budget ₱500,000" with View full quotation. */
    basis?: ReactNode;
    /** Named at the top of the confirmation pop-up: "Reservation fee" and "PRJ-26-0022 · ATM Casing". */
    billName: { title: string; project: string };
};

export type Texts = {
    heading: string;
    dueNote: string;
    pendingNote: string;
};

type Form = { reference: string; paymentDate: string; receipt: File | null };
type Errors = Partial<Record<keyof Form | 'amount' | 'payment', string>>;

const METHOD_LABEL = { qr_ph: 'QR Ph', cash: 'Cash', cheque: 'Cheque' } as const;

const EMPTY: Form = { reference: '', paymentDate: '', receipt: null };

export default function BillPaymentPanel({ payment, payUrl, onDispute, hideBlockedReason = false, billName, basis }: Props) {
    const { billing, payments, canPay, payBlockedReason, qrPh, receipt: receiptRules } = payment;
    const latest = payments[0] ?? null;
    const verified = payments.find((p) => p.status === 'verified') ?? null;
    const pending = payments.find((p) => p.status === 'submitted') ?? null;
    const earlier = payments.filter((p) => p !== verified && p !== pending);

    const [form, setForm] = useState<Form>(EMPTY);
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [viewing, setViewing] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const receiptUrl = useObjectUrl(form.receipt);

    if (!billing) {
        return null;
    }

    const set = <K extends keyof Form>(key: K, value: Form[K]) => {
        setForm((f) => ({ ...f, [key]: value }));
        setErrors((e) => ({ ...e, [key]: undefined }));
    };

    const pickFile = (file: File | undefined) => {
        if (!file) return;
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        if (!receiptRules.types.includes(ext)) {
            setErrors((e) => ({ ...e, receipt: 'The receipt must be a PDF, JPG or PNG file.' }));
            return;
        }
        if (file.size > receiptRules.maxMb * 1024 * 1024) {
            setErrors((e) => ({ ...e, receipt: `The receipt must be ${receiptRules.maxMb} MB or smaller.` }));
            return;
        }
        set('receipt', file);
    };

    const clearReceipt = () => {
        set('receipt', null);
        if (fileRef.current) fileRef.current.value = '';
    };

    /** Send payment: check the fields, then ask to confirm in the pop-up. */
    const review = () => {
        const e: Errors = {};
        if (!form.reference.trim()) e.reference = 'Enter the reference number from your payment receipt.';
        if (!form.paymentDate) e.paymentDate = 'Enter the date you paid.';
        if (!form.receipt) e.receipt = 'Upload your payment receipt.';
        setErrors(e);
        if (Object.keys(e).length === 0) setConfirming(true);
    };

    /** Confirm and send. */
    const send = () => {
        setSaving(true);
        router.post(
            payUrl,
            // Always the full amount: partial payments aren't accepted (the server checks it too).
            { reference: form.reference, paymentDate: form.paymentDate, amount: billing.amount.toFixed(2), receipt: form.receipt },
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Payment sent. We will let you know once it is verified.');
                    setConfirming(false);
                    setForm(EMPTY);
                    if (fileRef.current) fileRef.current.value = '';
                },
                onError: (serverErrors) => {
                    setConfirming(false);
                    setErrors(serverErrors as Errors);
                },
                onFinish: () => setSaving(false),
            },
        );
    };

    // The guide follows what is filled in: scan (until anything is entered), details, then send.
    const anyDetail = !!form.reference.trim() || !!form.paymentDate || !!form.receipt;
    const allDetails = !!form.reference.trim() && !!form.paymentDate && !!form.receipt;

    return (
        <div>
            {errors.payment && <Row tone="red" icon={XCircle} title={errors.payment} />}

            {/* Sent or paid: the header band says where it stands; here only what was sent. */}
            {(verified ?? pending) && <SentPayment payment={(verified ?? pending)!} amount={billing.amount} basis={basis} />}

            {/* Overdue or other reasons it can't be paid (not "already paid" or "waiting"). */}
            {!canPay && !verified && !pending && payBlockedReason && !hideBlockedReason && <Row tone="red" icon={XCircle} title={payBlockedReason} />}

            {canPay && (
                <>
                    {latest?.status === 'rejected' && (
                        <Row tone="red" icon={XCircle} title="Your last payment was not accepted">
                            {latest.remarks && <p className="text-sm text-ink">Reason: {latest.remarks}</p>}
                            <p className="text-sm text-ink-soft">Please check the details and send your payment again.</p>
                        </Row>
                    )}

                    <Guide
                        steps={[
                            { title: 'Scan the QR Ph code', hint: 'With any bank or e-wallet app', done: anyDetail },
                            { title: 'Enter your payment details', hint: 'Reference number, date, receipt', done: allDetails },
                            { title: 'Send payment', hint: 'We verify it and let you know', done: false },
                        ]}
                    />

                    <div id="pay" className="grid scroll-mt-24 grid-cols-1 divide-y divide-black/10 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                        {/*
                         * 1 · The QR and how to use it. A QR Ph code isn't a link: the phone's camera app won't
                         * open a payment app, so it's scanned from inside the bank or e-wallet app. A phone
                         * can't scan its own screen, so on the same phone: save the QR and use "Upload QR".
                         */}
                        <section className="p-4 sm:p-5">
                            <p className="mb-3 text-sm font-semibold text-ink">1 · Scan with your bank or e-wallet app</p>
                            {/* The QR big and centered, so it's easy to scan from another phone; the account under it. */}
                            <div className="flex flex-col items-center text-center">
                                <img src={qrPh.qr_image} alt="QR Ph code" className="size-44 rounded-xl border border-black/10 sm:size-48" />
                                {qrPh.is_sample && <p className="mt-1 text-[11px] font-semibold text-red-700">Sample QR, not for real payments</p>}
                                <p className="mt-2 font-bold text-ink">{qrPh.account_name}</p>
                                <p className="text-xs text-ink-soft">QR Ph · GCash, Maya, BPI, BDO and more</p>
                                <div className="mt-2 flex flex-wrap justify-center gap-2">
                                    <a
                                        href={qrPh.qr_image}
                                        download
                                        className="inline-flex items-center gap-1 rounded-md border border-black/15 px-2 py-1 text-xs font-bold text-gold-dark hover:border-gold"
                                    >
                                        <Download className="size-3.5" /> Save QR
                                    </a>
                                    <CopyButton text={billing.amount.toFixed(2)} label={`Copy ${peso(billing.amount)}`} />
                                </div>
                            </div>
                            <ol className="mt-4 grid gap-2 text-sm text-ink">
                                <HowTo n={1}>
                                    Open your app and tap <b>Scan QR</b>. Your phone&apos;s camera app won&apos;t open it.
                                </HowTo>
                                <HowTo n={2}>
                                    Scan this code, enter <b>{peso(billing.amount)}</b>, check the name shows {qrPh.account_name}, and pay.
                                </HowTo>
                                <HowTo n={3}>Screenshot the receipt and note the reference number.</HowTo>
                            </ol>
                            <p className="mt-3 flex items-start gap-2 text-xs text-ink-soft">
                                <Smartphone className="mt-0.5 size-4 shrink-0" />
                                <span>
                                    On this phone? Tap Save QR, then use <b>Upload QR</b> in your app&apos;s scanner.
                                </span>
                            </p>
                        </section>

                        {/* 2 · What the customer paid: one heading for the panel, plain field labels. */}
                        <section className="flex flex-col gap-4 p-4 sm:p-5">
                            <p className="-mb-1 text-sm font-semibold text-ink">2 · Your payment details</p>
                            <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:gap-3">
                                <Field label="Reference number" htmlFor="pay-reference" required error={errors.reference}>
                                    <input
                                        id="pay-reference"
                                        className={inputClass}
                                        inputMode="numeric"
                                        placeholder="From your app's receipt"
                                        value={form.reference}
                                        onChange={(e) => set('reference', e.target.value)}
                                    />
                                </Field>
                                {/* Any past date: the customer may pay today and send the details later. Not in the future. */}
                                <Field label="Date paid" htmlFor="pay-date" required error={errors.paymentDate}>
                                    <input
                                        id="pay-date"
                                        type="date"
                                        className={inputClass}
                                        max={toISO(new Date())}
                                        value={form.paymentDate}
                                        onChange={(e) => set('paymentDate', e.target.value)}
                                    />
                                </Field>
                            </div>
                            <Field label="Payment receipt" required error={errors.receipt}>
                                <div className="flex justify-center py-2">
                                    {form.receipt && receiptUrl ? (
                                        <div className="flex w-full max-w-sm items-center gap-3 rounded-lg border border-black/15 p-2">
                                            <button
                                                type="button"
                                                onClick={() => setViewing(true)}
                                                aria-label="View receipt"
                                                className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/10 bg-neutral-100"
                                            >
                                                {isPdf(form.receipt) ? (
                                                    <FileText className="size-6 text-gold-dark" />
                                                ) : (
                                                    <img src={receiptUrl} alt="" className="max-h-full max-w-full object-contain" />
                                                )}
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-ink">{form.receipt.name}</p>
                                                <p className="text-xs text-ink-soft">{fileSize(form.receipt.size)}</p>
                                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold">
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewing(true)}
                                                        className="inline-flex items-center gap-1 text-gold-dark hover:underline"
                                                    >
                                                        <ZoomIn className="size-3.5" /> View
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => fileRef.current?.click()}
                                                        className="inline-flex items-center gap-1 text-gold-dark hover:underline"
                                                    >
                                                        <Replace className="size-3.5" /> Change
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={clearReceipt}
                                                        className="inline-flex items-center gap-1 text-red-700 hover:underline"
                                                    >
                                                        <Trash2 className="size-3.5" /> Remove
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => fileRef.current?.click()}
                                            className={cx(
                                                'flex w-full max-w-xs flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center text-sm transition hover:border-gold hover:bg-gold/5',
                                                errors.receipt ? 'border-red-400' : 'border-black/20',
                                            )}
                                        >
                                            <FileUp className="size-7 text-ink-soft" />
                                            <span className="font-semibold text-ink">Upload receipt</span>
                                            <span className="text-xs text-ink-soft">
                                                Screenshot or PDF · JPG, PNG or PDF · up to {receiptRules.maxMb} MB
                                            </span>
                                        </button>
                                    )}
                                </div>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="hidden"
                                    onChange={(e) => pickFile(e.target.files?.[0])}
                                />
                            </Field>
                            <p className="mt-auto flex items-start gap-2 rounded-lg bg-black/[0.03] p-3 text-xs text-ink-soft">
                                <Info className="mt-0.5 size-4 shrink-0" />
                                Pay the exact amount in one payment. Partial payments can&apos;t be accepted.
                            </p>
                        </section>
                    </div>

                    {/* 3 · Send payment (opens the confirmation), with Dispute bill beside it when allowed. */}
                    <div className="flex flex-col gap-3 border-t border-black/10 bg-neutral-50 px-4 py-3 sm:px-5 md:flex-row md:items-center md:justify-between">
                        {errors.amount ? (
                            <p className="text-xs text-red-700" role="alert">
                                {errors.amount}
                            </p>
                        ) : (
                            <p className="text-xs text-ink-soft">
                                {onDispute ? 'Something wrong with the amount? Dispute it before paying.' : 'Check your details, then send.'}
                            </p>
                        )}
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end md:shrink-0">
                            <GoldButton onClick={review} disabled={saving} className="w-full sm:order-2 sm:w-auto">
                                Send Payment
                            </GoldButton>
                            {onDispute && (
                                <OutlineButton onClick={onDispute} disabled={saving} className="w-full sm:order-1 sm:w-auto">
                                    <AlertTriangle className="size-4 text-gold-dark" /> Dispute bill
                                </OutlineButton>
                            )}
                        </div>
                    </div>

                    {form.receipt && receiptUrl && (
                        <>
                            <ConfirmDialog
                                open={confirming}
                                onOpenChange={(open) => !saving && setConfirming(open)}
                                billName={billName}
                                amount={billing.amount}
                                reference={form.reference.trim()}
                                paymentDate={form.paymentDate}
                                receipt={form.receipt}
                                receiptUrl={receiptUrl}
                                onFullSize={() => setViewing(true)}
                                onSend={send}
                                saving={saving}
                            />
                            <ReceiptViewer open={viewing} onOpenChange={setViewing} name={form.receipt.name} url={receiptUrl} />
                        </>
                    )}
                </>
            )}

            {earlier.length > 0 && <EarlierPayments payments={earlier} />}
        </div>
    );
}

/** One full-width row inside the bill card: a status with its icon, a note, and details. */
function Row({
    tone,
    icon: Icon,
    title,
    note,
    children,
}: {
    tone: 'green' | 'gold' | 'red';
    icon: typeof Clock;
    title: string;
    note?: string;
    children?: ReactNode;
}) {
    const tones = {
        green: 'bg-green-50/70 text-green-700',
        gold: 'bg-gold/10 text-gold-dark',
        red: 'bg-red-50 text-red-700',
    } as const;

    return (
        <section
            role={tone === 'red' ? 'alert' : undefined}
            className={cx('flex items-start gap-3 border-b border-black/10 px-4 py-4 sm:px-5', tones[tone])}
        >
            <Icon className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{title}</p>
                {note && <p className="text-sm text-ink-soft">{note}</p>}
                {children && <div className="mt-2">{children}</div>}
            </div>
        </section>
    );
}

/** The 3 payment steps across the top. Finished ones turn green; the first unfinished one is gold. */
function Guide({ steps }: { steps: { title: string; hint: string; done: boolean }[] }) {
    const next = steps.findIndex((s) => !s.done);

    return (
        // gap-px over a grey background draws the dividers between steps on every layout.
        <ol className="grid grid-cols-1 gap-px border-b border-black/10 bg-black/10 sm:grid-cols-3" aria-label="How to pay">
            {steps.map((s, i) => {
                const current = i === next;
                return (
                    <li key={s.title} aria-current={current ? 'step' : undefined} className="flex items-start gap-3 bg-neutral-50 px-4 py-3 sm:px-5">
                        <span
                            className={cx(
                                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                                s.done ? 'bg-green-600 text-white' : current ? 'bg-gold text-white' : 'bg-black/10 text-ink-soft',
                            )}
                        >
                            {s.done ? <Check className="size-3.5" /> : i + 1}
                        </span>
                        <span className="min-w-0">
                            <span className={cx('block text-sm font-bold', s.done || current ? 'text-ink' : 'text-ink-soft')}>{s.title}</span>
                            <span className="block text-xs text-ink-soft">{s.hint}</span>
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

/**
 * "Your payment", once sent: two panels. Left: the amount with what it's based on, then
 * paid by · reference no. and date paid · sent (or verified) in two columns. Right: the
 * receipt itself, at its own shape, with Full size. The header band and pill already say
 * whether it is waiting or paid. Phones: the details, then the receipt.
 */
function SentPayment({ payment: p, amount, basis }: { payment: ReservationPayment; amount: number; basis?: ReactNode }) {
    const [viewing, setViewing] = useState(false);
    const items = [
        { label: 'Paid by', value: METHOD_LABEL[p.method] },
        { label: 'Reference no.', value: p.reference },
        { label: 'Date paid', value: formatDate(p.paymentDate) },
        p.verifiedAt ? { label: 'Verified', value: formatDate(p.verifiedAt) } : { label: 'Sent', value: formatDate(p.submittedAt.slice(0, 10)) },
    ];

    return (
        <section className="grid grid-cols-1 divide-y divide-black/10 md:grid-cols-[minmax(0,1fr)_18rem] md:divide-x md:divide-y-0">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:px-6">
                <div>
                    <h3 className="font-bold text-ink">Your payment</h3>
                    <p className="mt-1 text-2xl leading-tight font-bold text-ink">{peso(amount)}</p>
                    {basis && <div className="text-xs text-ink-soft">{basis}</div>}
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-black/10 pt-3 text-sm">
                    {items.map((i) => (
                        <div key={i.label} className="min-w-0">
                            <dt className="text-xs text-ink-soft">{i.label}</dt>
                            <dd className="font-semibold break-all text-ink">{i.value}</dd>
                        </div>
                    ))}
                </dl>
            </div>

            <div className="px-4 py-4 sm:px-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="font-bold text-ink">Receipt</h3>
                    {p.receiptUrl && (
                        <button
                            type="button"
                            onClick={() => setViewing(true)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-gold-dark hover:underline"
                        >
                            <ZoomIn className="size-3.5" /> Full size
                        </button>
                    )}
                </div>
                {p.receiptUrl ? (
                    <>
                        <ReceiptFrame name={p.receiptName ?? 'receipt'} url={p.receiptUrl} className="h-52 sm:h-56" />
                        <ReceiptViewer open={viewing} onOpenChange={setViewing} name={p.receiptName ?? 'Receipt'} url={p.receiptUrl} />
                    </>
                ) : (
                    <p className="flex h-24 items-center justify-center rounded-lg border border-dashed border-black/15 text-sm text-ink-soft">
                        No receipt attached
                    </p>
                )}
            </div>
        </section>
    );
}

/** Earlier payments (not accepted ones), folded at the bottom of the card. */
function EarlierPayments({ payments }: { payments: ReservationPayment[] }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="border-t border-black/10 bg-neutral-50">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-ink-soft hover:text-ink sm:px-5"
            >
                <History className="size-4" /> Earlier payments ({payments.length})
                <ChevronDown className={cx('ml-auto size-4 transition', open && 'rotate-180')} />
            </button>
            {open && (
                <ul className="grid gap-2 px-4 pb-4 sm:px-5">
                    {payments.map((p) => (
                        <li key={p.id} className="rounded-lg border border-black/10 bg-white p-3">
                            <PaymentLines payment={p} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** One payment's details: amount, method, reference, dates, receipt and the reason if rejected. */
function PaymentLines({ payment: p }: { payment: ReservationPayment }) {
    const tone = p.status === 'verified' ? 'green' : p.status === 'rejected' ? 'red' : 'blue';
    const label = p.status === 'verified' ? 'Verified' : p.status === 'rejected' ? 'Not accepted' : 'Waiting for verification';

    return (
        <div className="grid gap-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-ink">
                    {peso(p.amount)} · {METHOD_LABEL[p.method]}
                </span>
                <Pill tone={tone}>{label}</Pill>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                <div>
                    <dt className="text-ink-soft">Reference no.</dt>
                    <dd className="font-semibold break-all text-ink">{p.reference}</dd>
                </div>
                <div>
                    <dt className="text-ink-soft">Date paid</dt>
                    <dd className="font-semibold text-ink">{formatDate(p.paymentDate)}</dd>
                </div>
                <div>
                    <dt className="text-ink-soft">{p.verifiedAt ? 'Verified' : 'Sent'}</dt>
                    <dd className="font-semibold text-ink">{formatDate(p.verifiedAt ?? p.submittedAt.slice(0, 10))}</dd>
                </div>
            </dl>
            {p.status === 'rejected' && p.remarks && <p className="text-xs text-red-700">Reason: {p.remarks}</p>}
            {p.receiptUrl && (
                <div className="flex gap-3 text-xs font-bold text-gold-dark">
                    <a href={p.receiptUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:underline">
                        <Eye className="size-3.5" /> View receipt
                    </a>
                    <a href={`${p.receiptUrl}?download=1`} className="inline-flex items-center gap-1 hover:underline">
                        <Download className="size-3.5" /> Download
                    </a>
                </div>
            )}
        </div>
    );
}

/** One line of "how to pay", numbered. */
function HowTo({ n, children }: { n: number; children: ReactNode }) {
    return (
        <li className="flex items-start gap-2 [&_b]:font-bold">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gold text-[11px] font-bold text-white">{n}</span>
            <span>{children}</span>
        </li>
    );
}

/** A temporary URL for a picked file, released when the file changes or the page closes. */
function useObjectUrl(file: File | null): string | null {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!file) {
            setUrl(null);
            return;
        }
        const u = URL.createObjectURL(file);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [file]);

    return url;
}

const isPdfName = (name: string) => name.toLowerCase().endsWith('.pdf');
const isPdf = (file: File) => file.type === 'application/pdf' || isPdfName(file.name);

const fileSize = (bytes: number) =>
    bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * The receipt in a grey frame, scaled to fit and never stretched or cropped: a tall phone
 * screenshot fills the height, a wide photo the width. A PDF shows its first page.
 */
function ReceiptFrame({ name, url, className }: { name: string; url: string; className?: string }) {
    return (
        <div className={cx('flex items-center justify-center overflow-hidden rounded-lg border border-black/10 bg-neutral-100 p-2', className)}>
            {isPdfName(name) ? (
                <iframe src={`${url}#toolbar=0&navpanes=0`} title="Receipt" className="size-full rounded bg-white" />
            ) : (
                <img src={url} alt="Your payment receipt" className="max-h-full max-w-full rounded object-contain" />
            )}
        </div>
    );
}

/**
 * Step 3: "Send this payment?" before it is sent. Left: the bill, then amount · paid by and
 * reference number · date paid. Right: the receipt. Phones: details first, receipt under them,
 * Go back and Confirm side by side.
 */
function ConfirmDialog({
    open,
    onOpenChange,
    billName,
    amount,
    reference,
    paymentDate,
    receipt,
    receiptUrl,
    onFullSize,
    onSend,
    saving,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    billName: { title: string; project: string };
    amount: number;
    reference: string;
    paymentDate: string;
    receipt: File;
    receiptUrl: string;
    onFullSize: () => void;
    onSend: () => void;
    saving: boolean;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
                <DialogHeader>
                    <DialogTitle>Send this payment?</DialogTitle>
                    <DialogDescription className="sr-only">Check your payment details and receipt before sending.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_13rem] sm:gap-6">
                    <div className="grid content-start gap-4">
                        <div className="border-b border-black/10 pb-3">
                            <p className="text-base font-bold text-ink">{billName.title}</p>
                            <p className="text-sm text-ink-soft">{billName.project}</p>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                            <div>
                                <dt className="text-xs text-ink-soft">Amount</dt>
                                <dd className="text-lg font-bold text-ink">{peso(amount)}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-ink-soft">Paid by</dt>
                                <dd className="font-bold text-ink">QR Ph</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-ink-soft">Reference number</dt>
                                <dd className="font-bold break-all text-ink">{reference}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-ink-soft">Date paid</dt>
                                <dd className="font-bold text-ink">{formatDate(paymentDate)}</dd>
                            </div>
                        </dl>
                        <p className="flex items-start gap-2 rounded-lg bg-gold/10 p-3 text-xs text-ink-soft">
                            <Info className="mt-0.5 size-4 shrink-0 text-gold-dark" />
                            Check that the receipt shows this amount and reference number. Our Project Manager verifies them before your bill is
                            marked paid.
                        </p>
                    </div>

                    <div>
                        <ReceiptFrame name={receipt.name} url={receiptUrl} className="h-52 sm:h-64" />
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-ink-soft">{receipt.name}</span>
                            <button
                                type="button"
                                onClick={onFullSize}
                                className="inline-flex shrink-0 items-center gap-1 font-bold text-gold-dark hover:underline"
                            >
                                <ZoomIn className="size-3.5" /> Full size
                            </button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-row gap-2 sm:justify-end">
                    <OutlineButton onClick={() => onOpenChange(false)} disabled={saving} className="flex-1 sm:flex-none">
                        Go back
                    </OutlineButton>
                    <GoldButton onClick={onSend} disabled={saving} className="flex-1 sm:flex-none">
                        {saving ? 'Sending…' : 'Confirm and send'}
                    </GoldButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** A receipt at full size: the one picked before sending, or the one sent. */
function ReceiptViewer({ open, onOpenChange, name, url }: { open: boolean; onOpenChange: (open: boolean) => void; name: string; url: string }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="p-4 sm:max-w-3xl sm:p-6">
                <DialogHeader>
                    <DialogTitle className="truncate pr-6">{name}</DialogTitle>
                    <DialogDescription className="sr-only">Your payment receipt at full size.</DialogDescription>
                </DialogHeader>
                <ReceiptFrame name={name} url={url} className="h-[70vh]" />
            </DialogContent>
        </Dialog>
    );
}

/** Copies the amount so it can be pasted into the bank or e-wallet app. */
function CopyButton({ text, label }: { text: string; label: string }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Couldn't copy. Please type the amount in your app.");
        }
    };

    return (
        <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-black/15 px-2 py-1 text-xs font-bold text-gold-dark hover:border-gold"
        >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? 'Copied' : label}
        </button>
    );
}
