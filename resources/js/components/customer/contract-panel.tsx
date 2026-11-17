import { router } from '@inertiajs/react';
import { CheckCircle2, Clock, Download, Eraser, ExternalLink, FileSignature, FileText, FileUp, History, PenLine, Receipt, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import { Block, BlockHeader, Notice } from '@/components/customer/appointment-parts';
import BillCard from '@/components/customer/bill-card';
import { formatDate, formatLongDate, peso } from '@/components/customer/project-types';
import type { ContractInfo, ContractVersion, StepState } from '@/components/customer/project-types';
import { Field, GoldButton, OutlineButton, Pill, cx } from '@/components/dashboard/ui';

/*
 * Review and sign the project contract — Plan Project step 5.
 *
 *  1. The contract PDF is issued when the customer approves the design.
 *  2. The customer signs it here (drawn signature + "I agree"; their name comes
 *     from their account),
 *     or uploads a physically signed copy (PDF, JPG or PNG, up to 10 MB).
 *  3. The Project Manager verifies it, or rejects it with remarks; a rejection
 *     comes back as the next version to sign.
 *  4. Once verified, the down payment and balance show as bills with "Pay now"
 *     (paid on Billing & Payments). Work starts when the down payment is verified too.
 */

type Props = {
    projectId: number;
    contract: ContractInfo;
    stepState: StepState;
};

const STATUS: Record<ContractVersion['status'], { label: string; tone: 'yellow' | 'blue' | 'green' | 'red' }> = {
    issued: { label: 'Waiting for your signature', tone: 'yellow' },
    signed: { label: 'Waiting for verification', tone: 'blue' },
    verified: { label: 'Verified', tone: 'green' },
    rejected: { label: 'Not accepted', tone: 'red' },
};

export default function ContractPanel({ projectId, contract, stepState }: Props) {
    const { current, history, summary } = contract;
    const [serverError, setServerError] = useState<string | null>(null);

    if (!current) {
        return <Notice>Your contract is being prepared. It will appear here once your design is approved.</Notice>;
    }

    return (
        <div className="grid gap-4">
            {serverError && <Notice tone="error">{serverError}</Notice>}

            <Block>
                <BlockHeader
                    title={`Project contract · ${current.code}`}
                    description={`Version ${current.version} · Issued ${formatDate(current.issuedAt)}`}
                    icon={<FileSignature className="size-5" />}
                    action={<Pill tone={STATUS[current.status].tone}>{STATUS[current.status].label}</Pill>}
                />

                {current.executedFile ? (
                    <Section title="Fully signed contract" icon={<CheckCircle2 className="size-4" />}>
                        <FileRow name={current.executedFile.name} extension="pdf" url={current.executedFile.url} viewable />
                        <p className="mt-2 text-xs text-ink-soft">Signed by you and by our Owner. Keep this copy for your records.</p>
                    </Section>
                ) : (
                    <Section title="Contract" icon={<FileText className="size-4" />}>
                        <FileRow name={current.fileName} extension="pdf" url={current.url} viewable />
                    </Section>
                )}

                {summary && (
                    <Section title="Payment summary" icon={<Receipt className="size-4" />}>
                        <PaymentSummary summary={summary} />
                    </Section>
                )}

                {current.signedFile && (
                    <Section title="Your signed copy" icon={<PenLine className="size-4" />}>
                        <FileRow
                            name={current.signedFile.name}
                            extension={current.signedFile.extension ?? 'pdf'}
                            url={current.signedFile.url}
                            viewable
                        />
                        <p className="mt-2 text-xs text-ink-soft">
                            {current.signMethod === 'electronic' ? `Signed electronically by ${current.signerName}` : 'Uploaded'}
                            {current.signedAt && ` on ${formatLongDate(current.signedAt)}`}.
                        </p>
                    </Section>
                )}
            </Block>

            {/* Where things are */}
            {current.status === 'signed' && (
                <StatusCard tone="gold" icon={<Clock className="size-5 text-gold-dark" />} title="Waiting for verification">
                    Our Project Manager is checking your signed contract. You will be able to pay the down payment once it is verified.
                </StatusCard>
            )}
            {current.status === 'verified' && (
                <StatusCard tone="green" icon={<CheckCircle2 className="size-5 text-green-700" />} title="Contract verified">
                    {current.verifiedAt ? `Verified on ${formatLongDate(current.verifiedAt)}. ` : ''}
                    {stepState === 'done' ? 'Thank you! Work on your project has started.' : 'Next, pay your down payment on Billing & Payments.'}
                </StatusCard>
            )}

            {/* Sign */}
            {current.status === 'issued' && contract.canSign && (
                <SignBlock projectId={projectId} contract={contract} previous={history[0] ?? null} onServerError={setServerError} />
            )}
            {current.status === 'issued' && !contract.canSign && contract.signBlockedReason && <Notice>{contract.signBlockedReason}</Notice>}

            {/* Down payment and balance, once verified: paid on Billing & Payments. */}
            {current.status === 'verified' && contract.downPayment && (
                <BillCard
                    bill={contract.downPayment}
                    note={contract.downPayment.state === 'paid' ? undefined : 'Work on your project starts once your down payment is verified.'}
                />
            )}
            {current.status === 'verified' && contract.balance && <BillCard bill={contract.balance} />}

            {history.length > 0 && (
                <Block>
                    <BlockHeader title="Earlier versions" icon={<History className="size-5" />} />
                    <ul className="grid gap-3">
                        {history.map((c) => (
                            <EarlierVersion key={c.id} contract={c} />
                        ))}
                    </ul>
                </Block>
            )}
        </div>
    );
}

/* ---------------- Signing ---------------- */

type Strokes = [number, number][][];

function SignBlock({
    projectId,
    contract,
    previous,
    onServerError,
}: {
    projectId: number;
    contract: ContractInfo;
    previous: ContractVersion | null;
    onServerError: (message: string | null) => void;
}) {
    const [mode, setMode] = useState<'electronic' | 'upload'>('electronic');

    return (
        <Block>
            <BlockHeader title="Sign your contract" description="Read the contract first. Sign it here, or upload a copy you signed on paper." icon={<PenLine className="size-5" />} />

            {previous?.status === 'rejected' && (
                <Notice tone="error" className="mb-4">
                    <span className="font-bold">Your signed copy of version {previous.version} was not accepted.</span>
                    {previous.rejectionReason && <span className="block">Reason: {previous.rejectionReason}</span>}
                    <span className="block">Please sign this version again.</span>
                </Notice>
            )}

            <div role="tablist" className="mb-4 inline-flex rounded-lg border border-black/10 p-1">
                {(
                    [
                        ['electronic', 'Sign electronically', <PenLine key="i" className="size-4" />],
                        ['upload', 'Upload signed copy', <Upload key="i" className="size-4" />],
                    ] as const
                ).map(([value, label, icon]) => (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={mode === value}
                        onClick={() => setMode(value)}
                        className={cx(
                            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold transition',
                            mode === value ? 'bg-gold/20 text-ink' : 'text-ink-soft hover:text-ink',
                        )}
                    >
                        {icon} {label}
                    </button>
                ))}
            </div>

            {mode === 'electronic' ? (
                <ESignForm projectId={projectId} contract={contract} onServerError={onServerError} />
            ) : (
                <UploadForm projectId={projectId} contract={contract} onServerError={onServerError} />
            )}
        </Block>
    );
}

function ESignForm({ projectId, contract, onServerError }: { projectId: number; contract: ContractInfo; onServerError: (m: string | null) => void }) {
    const [strokes, setStrokes] = useState<Strokes>([]);
    const [agree, setAgree] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<'signature' | 'agree', string>>>({});
    const [saving, setSaving] = useState(false);

    const points = strokes.reduce((n, s) => n + s.length, 0);

    const submit = () => {
        const e: typeof errors = {};
        if (points < 8) e.signature = 'Draw your signature in the box.';
        if (!agree) e.agree = 'Please confirm that you have read and agree to the contract.';
        setErrors(e);
        if (Object.keys(e).length > 0) return;

        setSaving(true);
        onServerError(null);
        router.post(
            `/customer/projects/${projectId}/contract/sign`,
            { signature: JSON.stringify(strokes), agree: true },
            {
                preserveScroll: true,
                onSuccess: () => toast.success('Contract signed. We will let you know once it is verified.'),
                onError: (server) => {
                    setErrors(server as typeof errors);
                    if (server.contract) onServerError(server.contract);
                },
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <div className="grid gap-4">
            <Field label="Your signature" required error={errors.signature}>
                <SignaturePad
                    width={contract.pad.width}
                    height={contract.pad.height}
                    strokes={strokes}
                    onChange={(s) => {
                        setStrokes(s);
                        setErrors((x) => ({ ...x, signature: undefined }));
                    }}
                    invalid={!!errors.signature}
                />
            </Field>

            <p className="-mt-2 text-sm text-ink-soft">
                Signing as <span className="font-semibold text-ink">{contract.signerName}</span>. Your name and today's date are printed under your signature.
            </p>

            <div>
                <label className="flex items-start gap-2 text-sm text-ink">
                    <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-[#C99A2E]"
                        checked={agree}
                        onChange={(e) => {
                            setAgree(e.target.checked);
                            setErrors((x) => ({ ...x, agree: undefined }));
                        }}
                    />
                    <span>I have read the contract and agree to its terms. My drawn signature counts as my signature on this contract.</span>
                </label>
                {errors.agree && <p className="mt-1 text-xs text-red-600">{errors.agree}</p>}
            </div>

            <div className="flex justify-end">
                <GoldButton onClick={submit} disabled={saving}>
                    {saving ? 'Signing…' : 'Sign Contract'}
                </GoldButton>
            </div>
        </div>
    );
}

/**
 * A drawing pad. Points are kept in the pad's own coordinates (e.g. 600×200)
 * whatever size it is shown at; the server builds the signature from them.
 */
function SignaturePad({
    width,
    height,
    strokes,
    onChange,
    invalid,
}: {
    width: number;
    height: number;
    strokes: Strokes;
    onChange: (s: Strokes) => void;
    invalid: boolean;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    // The latest strokes, so fast pointer moves between renders aren't lost.
    const latest = useRef(strokes);
    latest.current = strokes;
    const update = (next: Strokes) => {
        latest.current = next;
        onChange(next);
    };

    // Redraw everything whenever the strokes change.
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const ratio = window.devicePixelRatio || 1;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#111111';

        for (const stroke of strokes) {
            ctx.beginPath();
            stroke.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
            if (stroke.length === 1) ctx.lineTo(stroke[0][0] + 0.5, stroke[0][1]);
            ctx.stroke();
        }
    }, [strokes, width, height]);

    const point = (e: ReactPointerEvent<HTMLCanvasElement>): [number, number] => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * width;
        const y = ((e.clientY - rect.top) / rect.height) * height;
        const clamp = (v: number, max: number) => Math.round(Math.min(Math.max(v, 0), max) * 10) / 10;
        return [clamp(x, width), clamp(y, height)];
    };

    return (
        <div>
            <div className={cx('relative overflow-hidden rounded-lg border-2 border-dashed bg-white', invalid ? 'border-red-400' : 'border-black/20')}>
                <canvas
                    ref={canvasRef}
                    aria-label="Signature pad: draw your signature"
                    className="block w-full cursor-crosshair touch-none"
                    style={{ aspectRatio: `${width} / ${height}` }}
                    onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId);
                        drawing.current = true;
                        update([...latest.current, [point(e)]]);
                    }}
                    onPointerMove={(e) => {
                        const all = latest.current;
                        if (!drawing.current || all.length === 0) return;
                        const last = all[all.length - 1];
                        const p = point(e);
                        const [px, py] = last[last.length - 1];
                        if (Math.abs(p[0] - px) + Math.abs(p[1] - py) < 1.5) return; // skip tiny moves
                        update([...all.slice(0, -1), [...last, p]]);
                    }}
                    onPointerUp={() => (drawing.current = false)}
                    onPointerCancel={() => (drawing.current = false)}
                />
                {strokes.length === 0 && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink-soft">Sign here</span>
                )}
                <span aria-hidden className="pointer-events-none absolute right-6 bottom-[22%] left-6 border-b border-black/15" />
            </div>
            <div className="mt-1 flex justify-end">
                <button
                    type="button"
                    onClick={() => update([])}
                    disabled={strokes.length === 0}
                    className="inline-flex items-center gap-1 text-xs font-bold text-gold-dark hover:underline disabled:opacity-40"
                >
                    <Eraser className="size-3.5" /> Clear
                </button>
            </div>
        </div>
    );
}

function UploadForm({ projectId, contract, onServerError }: { projectId: number; contract: ContractInfo; onServerError: (m: string | null) => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const { maxMb, types } = contract.upload;

    const pick = (f: File | undefined) => {
        if (!f) return;
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        if (!types.includes(ext)) return setError('The signed contract must be a PDF, JPG or PNG file.');
        if (f.size > maxMb * 1024 * 1024) return setError(`The signed contract must be ${maxMb} MB or smaller.`);
        setError(undefined);
        setFile(f);
    };

    const clear = () => {
        setFile(null);
        if (fileRef.current) fileRef.current.value = '';
    };

    const submit = () => {
        if (!file) return setError('Choose your signed contract.');

        setSaving(true);
        onServerError(null);
        router.post(
            `/customer/projects/${projectId}/contract/upload`,
            { file },
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Signed contract uploaded. We will let you know once it is verified.');
                    clear();
                },
                onError: (server) => {
                    setError(server.file);
                    if (server.contract) onServerError(server.contract);
                },
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <div className="grid gap-4">
            <ol className="grid list-decimal gap-1 pl-5 text-sm text-ink-soft">
                <li>Download the contract and print it.</li>
                <li>Sign every signature line and write the date.</li>
                <li>Scan it or take a clear photo of each page, then upload it here. A multi-page contract is best as one PDF.</li>
            </ol>

            <Field label="Signed contract" required error={error}>
                {file ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-black/15 px-3 py-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                            <FileText className="size-4 shrink-0 text-gold-dark" />
                            <span className="truncate text-ink">{file.name}</span>
                        </span>
                        <button type="button" aria-label="Remove file" onClick={clear} className="rounded p-1 text-ink-soft hover:bg-black/5">
                            <X className="size-4" />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className={cx(
                            'flex w-full flex-col items-center gap-1 rounded-lg border border-dashed p-4 text-center text-sm transition hover:border-gold hover:bg-gold/5',
                            error ? 'border-red-400' : 'border-black/20',
                        )}
                    >
                        <FileUp className="size-5 text-ink-soft" />
                        <span className="font-semibold text-ink">Choose file</span>
                        <span className="text-xs text-ink-soft">PDF, JPG or PNG · up to {maxMb} MB</span>
                    </button>
                )}
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            </Field>

            <div className="flex justify-end gap-2">
                {file && (
                    <OutlineButton onClick={clear} disabled={saving}>
                        Cancel
                    </OutlineButton>
                )}
                <GoldButton onClick={submit} disabled={saving}>
                    {saving ? 'Uploading…' : 'Upload Signed Contract'}
                </GoldButton>
            </div>
        </div>
    );
}

/* ---------------- Pieces ---------------- */

function PaymentSummary({ summary: s }: { summary: NonNullable<ContractInfo['summary']> }) {
    const row = (label: ReactNode, value: string, strong = false, hint?: string) => (
        <tr className="border-t border-black/5 first:border-t-0">
            <td className="px-3 py-2">
                <span className={cx(strong ? 'font-bold text-ink' : 'text-ink')}>{label}</span>
                {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
            </td>
            <td className={cx('px-3 py-2 text-right whitespace-nowrap', strong ? 'font-bold text-ink' : 'text-ink')}>{value}</td>
        </tr>
    );

    return (
        <div className="overflow-hidden rounded-lg border border-black/10">
            <table className="w-full text-sm">
                <tbody>
                    {row('Total contract price', peso(s.quotationTotal))}
                    {row('Reservation fee paid', `− ${peso(s.reservationFeePaid)}`)}
                    {row('Final billing', peso(s.finalBilling), true)}
                    {row(`Down payment (${s.downPercent}%)`, peso(s.downPayment), false, `Due ${s.downDueDays} days after your contract is verified`)}
                    {row(`Remaining balance (${100 - s.downPercent}%)`, peso(s.balance), false, `Due ${s.balanceDaysBeforeEvent} days before your event`)}
                </tbody>
            </table>
        </div>
    );
}

function StatusCard({ tone, icon, title, children }: { tone: 'green' | 'gold'; icon: ReactNode; title: string; children: ReactNode }) {
    return (
        <section className={cx('rounded-xl border p-4', tone === 'green' ? 'border-green-200 bg-green-50/60' : 'border-gold/50 bg-gold/10')}>
            <h3 className="mb-1 flex items-center gap-2 font-bold text-ink">
                {icon} {title}
            </h3>
            <p className="text-sm text-ink">{children}</p>
        </section>
    );
}

function EarlierVersion({ contract: c }: { contract: ContractVersion }) {
    const s = STATUS[c.status];

    return (
        <li className="rounded-xl border border-black/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-ink">
                    Version {c.version}
                    <span className="font-normal text-ink-soft">
                        {c.signedAt ? ` · signed ${formatDate(c.signedAt)}` : ` · issued ${formatDate(c.issuedAt)}`}
                    </span>
                </span>
                <Pill tone={s.tone}>{s.label}</Pill>
            </div>
            {c.rejectionReason && (
                <div className="mt-2 rounded-lg border border-black/10 bg-black/[0.02] p-3 text-sm">
                    <p className="text-xs font-semibold text-ink-soft">Project Manager's remarks{c.reviewedAt && ` · ${formatDate(c.reviewedAt)}`}</p>
                    <p className="mt-1 whitespace-pre-line text-ink">{c.rejectionReason}</p>
                </div>
            )}
            {c.signedFile && (
                <div className="mt-2 flex gap-3 text-xs font-bold text-gold-dark">
                    <a href={c.signedFile.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                        <ExternalLink className="size-3.5" /> View signed copy
                    </a>
                    <a href={`${c.signedFile.url}&download=1`} className="inline-flex items-center gap-1 hover:underline">
                        <Download className="size-3.5" /> Download
                    </a>
                </div>
            )}
        </li>
    );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
    return (
        <div className="mt-4 first:mt-0">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">
                {icon} {title}
            </h4>
            {children}
        </div>
    );
}

function FileRow({ name, extension, url, viewable }: { name: string; extension: string; url: string; viewable: boolean }) {
    const join = url.includes('?') ? '&' : '?';

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 p-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
                <FileText className="size-5 shrink-0 text-gold-dark" />
                <span className="truncate">{name}</span>
                <span className="text-xs font-normal text-ink-soft uppercase">{extension}</span>
            </span>
            <span className="flex gap-2">
                {viewable && (
                    <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-1.5 text-sm font-bold text-ink hover:border-gold"
                    >
                        <ExternalLink className="size-4" /> View
                    </a>
                )}
                <a
                    href={`${url}${join}download=1`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gold bg-white px-3 py-1.5 text-sm font-bold text-ink hover:bg-gold/10"
                >
                    <Download className="size-4" /> Download
                </a>
            </span>
        </div>
    );
}
