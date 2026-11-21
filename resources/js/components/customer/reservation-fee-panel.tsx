import { router } from '@inertiajs/react';
import { CheckCircle2, Clock, Download, Eye, FileUp, Info, QrCode, Receipt, Wallet, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatDate, formatLongDate, peso, toISO } from '@/components/customer/project-types';
import type { ReservationFeeInfo, ReservationPayment, StepState } from '@/components/customer/project-types';
import { Field, GoldButton, Pill, cx, inputClass } from '@/components/dashboard/ui';

/*
 * Pay the reservation fee — Plan Project step 2.
 *
 * The bill is 10% of the budget range, due 7 days after it is issued, and is
 * paid in full by GCash. The customer enters the GCash reference number, the
 * date paid and the amount, and uploads the receipt (PDF, JPG or PNG, up to
 * 5 MB). The Project Manager then verifies it; once verified the project is
 * Booked. A rejected payment shows its reason and the customer pays again.
 *
 * If nothing is paid by the due date, the project is cancelled (for now; to be
 * confirmed with the client at the next UAT).
 */

type Props = {
    projectId: number;
    fee: ReservationFeeInfo;
    stepState: StepState;
    /** Where the payment is sent. Defaults to the reservation fee. */
    payUrl?: string;
    /** Wording for another bill paid the same way (the contract's down payment). */
    texts?: Partial<Texts>;
};

type Texts = {
    heading: string;
    dueNote: string;
    pendingNote: string;
    success: string;
};

const RESERVATION_TEXTS: Texts = {
    heading: 'Reservation fee · 10% of your budget',
    dueNote: 'Pay in full by the due date. If it is not paid by then, your project is cancelled and the date is released.',
    pendingNote: 'Our Project Manager will check your payment. Your event date is confirmed once it is verified.',
    success: 'Payment sent. We will let you know once it is verified.',
};

type Form = { reference: string; paymentDate: string; amount: string; receipt: File | null };
type Errors = Partial<Record<keyof Form | 'payment', string>>;

const METHOD_LABEL = { gcash: 'GCash', cash: 'Cash', cheque: 'Cheque' } as const;

export default function ReservationFeePanel({ projectId, fee, stepState, payUrl, texts: customTexts }: Props) {
    const texts = { ...RESERVATION_TEXTS, ...customTexts };
    const { billing, payments, canPay, payBlockedReason, gcash, receipt: receiptRules } = fee;
    const latest = payments[0] ?? null;
    const verified = payments.find((p) => p.status === 'verified') ?? null;
    const pending = payments.find((p) => p.status === 'submitted') ?? null;

    const emptyForm = (): Form => ({ reference: '', paymentDate: '', amount: billing ? billing.amount.toFixed(2) : '', receipt: null });
    const [form, setForm] = useState<Form>(emptyForm);
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

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

    const submit = () => {
        const e: Errors = {};
        if (!form.reference.trim()) e.reference = 'Enter the GCash reference number.';
        if (!form.paymentDate) e.paymentDate = 'Enter the date you paid.';
        if (!form.amount) e.amount = 'Enter the amount you paid.';
        else if (billing && Math.abs(Number(form.amount) - billing.amount) > 0.001) e.amount = `Please pay the full amount of ${peso(billing.amount)}.`;
        if (!form.receipt) e.receipt = 'Upload your payment receipt.';
        setErrors(e);
        if (Object.keys(e).length > 0) return;

        setSaving(true);
        router.post(
            payUrl ?? `/customer/projects/${projectId}/reservation-fee/payments`,
            { reference: form.reference, paymentDate: form.paymentDate, amount: form.amount, receipt: form.receipt },
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(texts.success);
                    setForm(emptyForm());
                    if (fileRef.current) fileRef.current.value = '';
                },
                onError: (serverErrors) => setErrors(serverErrors as Errors),
                onFinish: () => setSaving(false),
            },
        );
    };

    /* ---------- no bill yet ---------- */
    if (!billing) {
        return (
            <Notice>
                {stepState === 'done'
                    ? 'Your reservation fee was paid and verified.'
                    : `Your bill of ${peso(fee.expectedAmount)} (10% of your budget) is being prepared. You will be able to pay it here.`}
            </Notice>
        );
    }

    const unpaid = !verified && billing.status !== 'paid';

    return (
        <div className="grid gap-4">
            {errors.payment && <Notice tone="error">{errors.payment}</Notice>}

            {/* The bill */}
            <section className="rounded-xl border border-black/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-lg bg-gold/20 text-gold-dark">
                            <Wallet className="size-5" />
                        </span>
                        <div>
                            <p className="text-xs text-ink-soft">{texts.heading}</p>
                            <p className="text-2xl font-bold text-ink">{peso(billing.amount)}</p>
                        </div>
                    </div>
                    <BillPill billing={billing} verified={!!verified} pending={!!pending} />
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                        <dt className="text-xs text-ink-soft">Issued</dt>
                        <dd className="font-semibold text-ink">{formatLongDate(billing.issuedAt)}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-ink-soft">Due date</dt>
                        <dd className={cx('font-semibold', unpaid && billing.pastDue ? 'text-red-700' : 'text-ink')}>{formatLongDate(billing.dueDate)}</dd>
                    </div>
                </dl>
                {unpaid && billing.status !== 'overdue' && (
                    <p className="mt-3 text-xs text-ink-soft">{texts.dueNote}</p>
                )}
            </section>

            {/* Paid, or waiting for verification */}
            {verified && <PaymentCard payment={verified} title="Paid and verified" tone="green" />}
            {!verified && pending && (
                <PaymentCard payment={pending} title="Payment sent, waiting for verification" tone="gold">
                    {texts.pendingNote}
                </PaymentCard>
            )}

            {/* Overdue or other reasons it can't be paid (not "already paid" or "waiting"). */}
            {!canPay && !verified && !pending && payBlockedReason && <Notice tone="error">{payBlockedReason}</Notice>}

            {/* Pay */}
            {canPay && (
                <>
                    {latest?.status === 'rejected' && (
                        <Notice tone="error">
                            <span className="font-bold">Your last payment was not accepted.</span>
                            {latest.remarks && <span className="block">Reason: {latest.remarks}</span>}
                            <span className="block">Please check the details and submit your payment again.</span>
                        </Notice>
                    )}

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                        <section className="rounded-xl border border-black/10 p-4">
                            <h3 className="mb-3 flex items-center gap-2 font-bold text-ink">
                                <QrCode className="size-5 text-gold-dark" /> Pay with GCash
                            </h3>
                            <div className="mx-auto w-48">
                                <img src={gcash.qr_image} alt="GCash QR code" className="w-full rounded-lg border border-black/10" />
                                {gcash.is_sample && <p className="mt-1 text-center text-[11px] font-semibold text-red-700">Sample QR, not for real payments</p>}
                            </div>
                            <dl className="mt-4 grid gap-2 text-sm">
                                <div>
                                    <dt className="text-xs text-ink-soft">Account name</dt>
                                    <dd className="font-semibold text-ink">{gcash.account_name}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-ink-soft">GCash number</dt>
                                    <dd className="font-semibold text-ink">{gcash.account_number}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-ink-soft">Amount to send</dt>
                                    <dd className="font-semibold text-ink">{peso(billing.amount)}</dd>
                                </div>
                            </dl>
                            <ol className="mt-4 grid list-decimal gap-1 pl-5 text-xs text-ink-soft">
                                <li>Open GCash and scan the QR code, or send to the number above.</li>
                                <li>Send the exact amount.</li>
                                <li>Save the receipt and note the reference number.</li>
                            </ol>
                        </section>

                        <section className="rounded-xl border border-black/10 p-4">
                            <h3 className="mb-3 flex items-center gap-2 font-bold text-ink">
                                <Receipt className="size-5 text-gold-dark" /> Send your payment details
                            </h3>
                            <div className="grid gap-4">
                                <Field label="GCash reference number" htmlFor="pay-reference" required error={errors.reference}>
                                    <input
                                        id="pay-reference"
                                        className={inputClass}
                                        inputMode="numeric"
                                        placeholder="e.g. 1029 384 756123"
                                        value={form.reference}
                                        onChange={(e) => set('reference', e.target.value)}
                                    />
                                </Field>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label="Date paid" htmlFor="pay-date" required error={errors.paymentDate}>
                                        <input
                                            id="pay-date"
                                            type="date"
                                            className={inputClass}
                                            min={billing.issuedAt}
                                            max={toISO(new Date())}
                                            value={form.paymentDate}
                                            onChange={(e) => set('paymentDate', e.target.value)}
                                        />
                                    </Field>
                                    <Field label="Amount paid (₱)" htmlFor="pay-amount" required error={errors.amount}>
                                        <input
                                            id="pay-amount"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className={inputClass}
                                            value={form.amount}
                                            onChange={(e) => set('amount', e.target.value)}
                                        />
                                    </Field>
                                </div>
                                <Field label="Payment receipt" required error={errors.receipt}>
                                    {form.receipt ? (
                                        <div className="flex items-center justify-between gap-3 rounded-lg border border-black/15 px-3 py-2 text-sm">
                                            <span className="flex min-w-0 items-center gap-2">
                                                <Receipt className="size-4 shrink-0 text-gold-dark" />
                                                <span className="truncate text-ink">{form.receipt.name}</span>
                                            </span>
                                            <button
                                                type="button"
                                                aria-label="Remove receipt"
                                                onClick={() => {
                                                    set('receipt', null);
                                                    if (fileRef.current) fileRef.current.value = '';
                                                }}
                                                className="rounded p-1 text-ink-soft hover:bg-black/5"
                                            >
                                                <X className="size-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => fileRef.current?.click()}
                                            className={cx(
                                                'flex flex-col items-center gap-1 rounded-lg border border-dashed p-4 text-center text-sm transition hover:border-gold hover:bg-gold/5',
                                                errors.receipt ? 'border-red-400' : 'border-black/20',
                                            )}
                                        >
                                            <FileUp className="size-5 text-ink-soft" />
                                            <span className="font-semibold text-ink">Upload receipt</span>
                                            <span className="text-xs text-ink-soft">PDF, JPG or PNG · up to {receiptRules.maxMb} MB</span>
                                        </button>
                                    )}
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        className="hidden"
                                        onChange={(e) => pickFile(e.target.files?.[0])}
                                    />
                                </Field>
                                <div className="flex justify-end">
                                    <GoldButton onClick={submit} disabled={saving}>
                                        {saving ? 'Sending…' : 'Send Payment'}
                                    </GoldButton>
                                </div>
                            </div>
                        </section>
                    </div>
                </>
            )}

            {/* Earlier payments */}
            {payments.filter((p) => p !== verified && p !== pending).length > 0 && (
                <section className="rounded-xl border border-black/10 p-4">
                    <h3 className="mb-3 font-bold text-ink">Payment history</h3>
                    <ul className="grid gap-3">
                        {payments
                            .filter((p) => p !== verified && p !== pending)
                            .map((p) => (
                                <li key={p.id} className="rounded-lg border border-black/10 p-3">
                                    <PaymentLines payment={p} />
                                </li>
                            ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

function BillPill({ billing, verified, pending }: { billing: NonNullable<ReservationFeeInfo['billing']>; verified: boolean; pending: boolean }) {
    if (verified || billing.status === 'paid') return <Pill tone="green">Paid</Pill>;
    if (billing.status === 'overdue') return <Pill tone="red">Overdue</Pill>;
    if (pending) return <Pill tone="blue">Waiting for verification</Pill>;
    return <Pill tone="yellow">Unpaid</Pill>;
}

function PaymentCard({
    payment,
    title,
    tone,
    children,
}: {
    payment: ReservationPayment;
    title: string;
    tone: 'green' | 'gold';
    children?: React.ReactNode;
}) {
    const Icon = tone === 'green' ? CheckCircle2 : Clock;

    return (
        <section className={cx('rounded-xl border p-4', tone === 'green' ? 'border-green-200 bg-green-50/60' : 'border-gold/50 bg-gold/10')}>
            <h3 className="mb-2 flex items-center gap-2 font-bold text-ink">
                <Icon className={cx('size-5', tone === 'green' ? 'text-green-700' : 'text-gold-dark')} /> {title}
            </h3>
            {children && <p className="mb-3 text-sm text-ink">{children}</p>}
            <PaymentLines payment={payment} />
        </section>
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
            <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                <div>
                    <dt className="text-ink-soft">Reference no.</dt>
                    <dd className="font-semibold text-ink">{p.reference}</dd>
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

function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'error' }) {
    return (
        <div
            role={tone === 'error' ? 'alert' : undefined}
            className={cx(
                'flex items-start gap-2 rounded-lg border p-3 text-sm',
                tone === 'error' ? 'border-red-300 bg-red-50 text-red-800' : 'border-gold/40 bg-gold/10 text-ink',
            )}
        >
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>{children}</span>
        </div>
    );
}
