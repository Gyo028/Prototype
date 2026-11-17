import { router } from '@inertiajs/react';
import {
    Building2,
    CalendarCheck,
    CalendarClock,
    ChevronLeft,
    ChevronRight,
    Download,
    ExternalLink,
    FileCheck2,
    FileText,
    FileUp,
    History,
    Home,
    Image as ImageIcon,
    Ruler,
    X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { AppointmentCard, Block, BlockHeader, EMPTY_SLOT, Notice, ReasonField, SlotPicker, durationText } from '@/components/customer/appointment-parts';
import type { AppointmentErrors, AppointmentSlot } from '@/components/customer/appointment-parts';
import { VENUE_OWNERSHIPS, formatDate, formatLongDate, formatTime } from '@/components/customer/project-types';
import type { OcularVisitInfo, OutcomeFile, SiteAccessDocument, SiteAccessFile, SiteAssessment, VenueOwnership } from '@/components/customer/project-types';
import { Field, GoldButton, OutlineButton, Pill, cx } from '@/components/dashboard/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/*
 * Schedule an ocular visit (Plan Project, step 3).
 *
 * Only when the consultation said a site visit is needed, after the
 * reservation fee is verified. The customer picks a date and a 2-hour slot;
 * the visit is face to face at their venue and is confirmed right away.
 *
 * The customer also says whose venue it is:
 *  - own property: no documents; the visit is confirmed right away
 *  - rented or third-party venue: the authorization letter and venue permit
 *    (optional when booking, PDF/JPG/PNG up to 5 MB each). The visit stays
 *    pending until the Project Manager approves both.
 * The customer can upload or replace the documents, and reschedule with a
 * reason, until the day before. There is no cancel: the visit is needed
 * before the design can start.
 *
 * Once the Project Manager records the site assessment, the
 * report and venue photos are shown here.
 */

type Props = {
    projectId: number;
    venue: string;
    ocularVisit: OcularVisitInfo;
};

type Errors = AppointmentErrors & Partial<Record<'venueOwnership' | 'authorizationLetter' | 'venuePermit' | 'documents', string>>;

/** The booking form's two optional files, by request field. */
const BOOKING_FILES = [
    { field: 'authorizationLetter', type: 'authorization_letter', label: 'Authorization letter', hint: 'Your signed letter allowing our team to inspect the venue.' },
    { field: 'venuePermit', type: 'venue_permit', label: 'Venue permit', hint: "The venue's permit for our team to enter and inspect." },
] as const;

type BookingFileField = (typeof BOOKING_FILES)[number]['field'];

const DOC_STATUS: Record<SiteAccessFile['status'], { label: string; tone: 'yellow' | 'green' | 'red' }> = {
    submitted: { label: 'Waiting for review', tone: 'yellow' },
    approved: { label: 'Approved', tone: 'green' },
    rejected: { label: 'Not accepted', tone: 'red' },
};

/** Checks a picked file against the rules; returns the error or null. */
const fileProblem = (file: File, rules: OcularVisitInfo['documentRules'], label: string) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!rules.types.includes(ext)) return `The ${label.toLowerCase()} must be a PDF, JPG or PNG file.`;
    if (file.size > rules.maxMb * 1024 * 1024) return `The ${label.toLowerCase()} must be ${rules.maxMb} MB or smaller.`;
    return null;
};

export default function OcularVisitPanel({ projectId, venue, ocularVisit }: Props) {
    const base = `/customer/projects/${projectId}/ocular-visit`;
    const { current, history, canBook, bookingBlockedReason, canChange, changeBlockedReason, assessment, availableSlots, rules, documents, documentRules } =
        ocularVisit;
    const held = history.find((s) => s.status === 'completed') ?? null;
    const earlier = history.filter((s) => s !== held);
    const visit = current ?? held;
    const thirdParty = visit?.venueOwnership === 'third_party';

    const [slot, setSlot] = useState<AppointmentSlot>(EMPTY_SLOT);
    const [ownership, setOwnership] = useState<VenueOwnership | ''>('');
    const [files, setFiles] = useState<Record<BookingFileField, File | null>>({ authorizationLetter: null, venuePermit: null });
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);
    const [rescheduling, setRescheduling] = useState(false);
    const [reason, setReason] = useState('');

    const checkSlot = (): Errors => {
        const e: Errors = {};
        if (!slot.date) e.date = 'Pick a date.';
        else if (!slot.time) e.time = 'Pick a time.';
        return e;
    };

    const send = (method: 'post' | 'patch', url: string, data: Record<string, string | File>, done: string) => {
        setSaving(true);
        router[method](url, data, {
            preserveScroll: true,
            forceFormData: method === 'post',
            onSuccess: (page) => {
                // A rule broken on the server comes back as an error, not a success.
                const serverErrors = (page.props.errors ?? {}) as Errors;
                if (Object.keys(serverErrors).length > 0) {
                    setErrors(serverErrors);
                    return;
                }
                toast.success(done);
                setSlot(EMPTY_SLOT);
                setOwnership('');
                setFiles({ authorizationLetter: null, venuePermit: null });
                setReason('');
                setRescheduling(false);
                setErrors({});
            },
            onError: (serverErrors) => setErrors(serverErrors as Errors),
            onFinish: () => setSaving(false),
        });
    };

    const book = () => {
        const e = checkSlot();
        if (!ownership) e.venueOwnership = 'Tell us whose venue it is.';
        setErrors(e);
        if (Object.keys(e).length > 0) return;

        const data: Record<string, string | File> = { date: slot.date, time: slot.time, venueOwnership: ownership };
        if (ownership === 'third_party') {
            for (const { field } of BOOKING_FILES) {
                const f = files[field];
                if (f) data[field] = f;
            }
        }
        send(
            'post',
            base,
            data,
            ownership === 'own_property'
                ? 'Your ocular visit is booked.'
                : 'Your ocular visit is booked. It will be confirmed once your documents are approved.',
        );
    };

    const pickBookingFile = (field: BookingFileField, label: string, file: File | undefined | null) => {
        if (!file) return setFiles((f) => ({ ...f, [field]: null }));
        const problem = fileProblem(file, documentRules, label);
        setErrors((e) => ({ ...e, [field]: problem ?? undefined }));
        if (!problem) setFiles((f) => ({ ...f, [field]: file }));
    };

    const reschedule = () => {
        const e = checkSlot();
        if (!reason.trim()) e.reason = 'Please give a reason.';
        setErrors(e);
        if (Object.keys(e).length === 0)
            send('patch', `${base}/reschedule`, { date: slot.date, time: slot.time, reason }, 'Your ocular visit has been moved.');
    };

    const openReschedule = () => {
        setSlot(EMPTY_SLOT);
        setReason('');
        setErrors({});
        setRescheduling(true);
    };

    return (
        <div className="grid gap-4">
            {errors.ocularVisit && !rescheduling && <Notice tone="error">{errors.ocularVisit}</Notice>}

            {current ? (
                <Block>
                    <BlockHeader
                        title="Your ocular visit"
                        description={
                            current.status === 'pending'
                                ? 'Booked · pending until your site access documents are approved'
                                : 'Booked and confirmed'
                        }
                        icon={<CalendarCheck className="size-5" />}
                    />
                    <AppointmentCard schedule={current} place={venue} />
                    <VenueLine ownership={current.venueOwnership} />
                    <Notice className="mt-4">
                        Our Project Manager will measure and check your venue. Please make sure someone can let our team in, and let the venue know
                        we are coming.
                    </Notice>
                    {canChange ? (
                        <>
                            <div className="mt-5 flex flex-wrap gap-3">
                                <OutlineButton onClick={openReschedule}>
                                    <CalendarClock className="size-4" /> Reschedule
                                </OutlineButton>
                            </div>
                            <p className="mt-3 text-xs text-ink-soft">
                                You can reschedule until {rules.changeCutoffDays} day before the visit. The visit can't be cancelled, as we need it
                                before the design can start.
                            </p>
                        </>
                    ) : (
                        changeBlockedReason && <Notice className="mt-5">{changeBlockedReason}</Notice>
                    )}
                </Block>
            ) : canBook ? (
                <Block>
                    <BlockHeader
                        title="Book your ocular visit"
                        description={`Our Project Manager visits ${venue} to take measurements and check the site.`}
                        icon={<CalendarCheck className="size-5" />}
                    />
                    <SlotPicker noun="ocular visit" slot={slot} setSlot={setSlot} errors={errors} availableSlots={availableSlots} rules={rules} />

                    <div className="mt-6 grid gap-5 border-t border-black/10 pt-5">
                        <Field label="Whose venue is it?" required error={errors.venueOwnership}>
                            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Venue ownership">
                                {VENUE_OWNERSHIPS.map((o) => {
                                    const selected = ownership === o.value;
                                    const Icon = o.value === 'own_property' ? Home : Building2;
                                    return (
                                        <button
                                            key={o.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={selected}
                                            onClick={() => setOwnership(o.value)}
                                            className={cx(
                                                'flex items-start gap-3 rounded-xl border p-3 text-left transition',
                                                selected ? 'border-gold bg-gold/10' : 'border-black/15 bg-white hover:border-gold',
                                            )}
                                        >
                                            <Icon className={cx('mt-0.5 size-5 shrink-0', selected ? 'text-gold-dark' : 'text-ink-soft')} />
                                            <span>
                                                <span className="block text-sm font-bold text-ink">{o.label}</span>
                                                <span className="block text-xs text-ink-soft">{o.hint}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </Field>

                        {ownership === 'third_party' && (
                            <div className="grid gap-4">
                                <Notice>
                                    So our team can inspect the venue even if you can't be there, please add a letter allowing us to inspect it and
                                    the venue's permit. You can add them now or later, until {rules.changeCutoffDays} day before the visit. Your visit
                                    is confirmed once our Project Manager approves both; without them, it may be rescheduled.
                                </Notice>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {BOOKING_FILES.map((d) => (
                                        <FilePicker
                                            key={d.field}
                                            label={d.label}
                                            hint={d.hint}
                                            file={files[d.field]}
                                            error={errors[d.field]}
                                            maxMb={documentRules.maxMb}
                                            onPick={(f) => pickBookingFile(d.field, d.label, f)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-ink-soft">Face to face, at your venue · about {durationText(rules.slotMinutes)}</p>
                        <GoldButton onClick={book} disabled={saving}>
                            {saving ? 'Booking…' : 'Book Ocular Visit'}
                        </GoldButton>
                    </div>
                </Block>
            ) : held ? (
                <Block>
                    <BlockHeader title="Ocular visit held" description="Thank you for having us at your venue" icon={<CalendarCheck className="size-5" />} />
                    <AppointmentCard schedule={held} place={venue} />
                    <VenueLine ownership={held.venueOwnership} />
                    {!assessment && (
                        <Notice className="mt-5">Our team is writing up the site assessment. The report and venue photos will appear here.</Notice>
                    )}
                </Block>
            ) : (
                bookingBlockedReason && (
                    <Block>
                        <BlockHeader title="Ocular visit" icon={<CalendarCheck className="size-5" />} />
                        <Notice>{bookingBlockedReason}</Notice>
                    </Block>
                )
            )}

            {thirdParty && (
                <DocumentsBlock
                    projectId={projectId}
                    documents={documents}
                    canUpload={ocularVisit.canUploadDocuments}
                    rules={documentRules}
                    cutoffDays={rules.changeCutoffDays}
                />
            )}

            {assessment && <AssessmentBlock assessment={assessment} />}

            {earlier.length > 0 && (
                <Block>
                    <BlockHeader title="History" description="Earlier bookings for this visit" icon={<History className="size-5" />} />
                    <ul className="grid gap-3">
                        {earlier.map((s) => (
                            <li key={s.id} className="rounded-xl border border-black/10 p-4">
                                <AppointmentCard schedule={s} compact />
                            </li>
                        ))}
                    </ul>
                </Block>
            )}

            <Dialog open={rescheduling} onOpenChange={(open) => !open && setRescheduling(false)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Reschedule ocular visit</DialogTitle>
                        <DialogDescription>
                            {current && `Currently ${formatLongDate(current.date)}, ${formatTime(current.startTime)}. `}
                            Pick a new date and time, and tell us why.
                        </DialogDescription>
                    </DialogHeader>
                    {errors.ocularVisit && <Notice tone="error">{errors.ocularVisit}</Notice>}
                    <SlotPicker noun="ocular visit" slot={slot} setSlot={setSlot} errors={errors} availableSlots={availableSlots} rules={rules} />
                    <ReasonField id="ocular-reason" value={reason} onChange={setReason} error={errors.reason} max={rules.reasonMax} />
                    <DialogFooter>
                        <OutlineButton onClick={() => setRescheduling(false)}>Back</OutlineButton>
                        <GoldButton onClick={reschedule} disabled={saving}>
                            {saving ? 'Saving…' : 'Move Ocular Visit'}
                        </GoldButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** The site assessment: findings, the report and the venue photos. */
function AssessmentBlock({ assessment: a }: { assessment: SiteAssessment }) {
    const [photo, setPhoto] = useState<number | null>(null);
    const shown = photo === null ? null : a.photos[photo];

    return (
        <Block>
            <BlockHeader
                title="Site assessment"
                description={`Recorded ${formatDate(a.recordedAt)} by the ${a.recordedBy}`}
                icon={<Ruler className="size-5" />}
            />

            {a.notes && <p className="mb-4 text-sm whitespace-pre-line text-ink">{a.notes}</p>}

            {a.report && (
                <div className="mb-4">
                    <h4 className="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">Report</h4>
                    <FileRow file={a.report} />
                </div>
            )}

            {a.photos.length > 0 && (
                <div className="mb-4">
                    <h4 className="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">Venue photos ({a.photos.length})</h4>
                    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {a.photos.map((p, i) => (
                            <li key={p.id}>
                                <button
                                    type="button"
                                    onClick={() => setPhoto(i)}
                                    className="group block w-full overflow-hidden rounded-lg border border-black/10 bg-black/5 hover:border-gold"
                                    aria-label={`View ${p.name}`}
                                >
                                    <img src={p.url} alt={p.name} loading="lazy" className="aspect-[3/2] w-full object-cover transition group-hover:opacity-90" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {a.attachments.length > 0 && (
                <div>
                    <h4 className="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">Other files</h4>
                    <ul className="grid gap-2">
                        {a.attachments.map((f) => (
                            <li key={f.id}>
                                <FileRow file={f} />
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <Dialog open={shown !== null} onOpenChange={(open) => !open && setPhoto(null)}>
                <DialogContent className="sm:max-w-4xl">
                    {shown && photo !== null && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <ImageIcon className="size-5 text-gold-dark" /> {shown.name}
                                </DialogTitle>
                                <DialogDescription>
                                    Photo {photo + 1} of {a.photos.length} · Ocular visit on {formatDate(a.visitDate)}
                                </DialogDescription>
                            </DialogHeader>
                            <img src={shown.url} alt={shown.name} className="max-h-[65vh] w-full rounded-lg bg-black/5 object-contain" />
                            <DialogFooter className="sm:justify-between">
                                <div className="flex gap-2">
                                    <OutlineButton onClick={() => setPhoto((photo - 1 + a.photos.length) % a.photos.length)} disabled={a.photos.length < 2}>
                                        <ChevronLeft className="size-4" /> Previous
                                    </OutlineButton>
                                    <OutlineButton onClick={() => setPhoto((photo + 1) % a.photos.length)} disabled={a.photos.length < 2}>
                                        Next <ChevronRight className="size-4" />
                                    </OutlineButton>
                                </div>
                                <a
                                    href={`${shown.url}?download=1`}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-gold bg-white px-3 py-2 text-sm font-bold text-ink hover:bg-gold/10"
                                >
                                    <Download className="size-4" /> Download
                                </a>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </Block>
    );
}

/** A file with View (PDF and images open in a new tab) and Download. */
function FileRow({ file }: { file: OutcomeFile }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 p-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
                <FileText className="size-5 shrink-0 text-gold-dark" />
                <span className="truncate">{file.name}</span>
                <span className="text-xs font-normal text-ink-soft uppercase">{file.extension}</span>
            </span>
            <span className="flex gap-2">
                {file.viewable && (
                    <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-1.5 text-sm font-bold text-ink hover:border-gold"
                    >
                        <ExternalLink className="size-4" /> View
                    </a>
                )}
                <a
                    href={`${file.url}?download=1`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gold bg-white px-3 py-1.5 text-sm font-bold text-ink hover:bg-gold/10"
                >
                    <Download className="size-4" /> Download
                </a>
            </span>
        </div>
    );
}

/** Under the visit: whose venue it is. */
function VenueLine({ ownership }: { ownership: VenueOwnership | null }) {
    if (!ownership) return null;
    const o = VENUE_OWNERSHIPS.find((x) => x.value === ownership);
    const Icon = ownership === 'own_property' ? Home : Building2;
    return (
        <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
            <Icon className="size-4 shrink-0" /> {o?.label}
            {ownership === 'own_property' && ' · no site access documents needed'}
        </p>
    );
}

/** A file field for the booking form: pick, show the name, remove. */
function FilePicker({
    label,
    hint,
    file,
    error,
    maxMb,
    onPick,
}: {
    label: string;
    hint: string;
    file: File | null;
    error?: string;
    maxMb: number;
    onPick: (file: File | null) => void;
}) {
    const ref = useRef<HTMLInputElement>(null);

    return (
        <Field label={`${label} (optional)`} error={error}>
            {file ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-black/15 px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                        <FileCheck2 className="size-4 shrink-0 text-gold-dark" />
                        <span className="truncate text-ink">{file.name}</span>
                    </span>
                    <button
                        type="button"
                        aria-label={`Remove ${label.toLowerCase()}`}
                        onClick={() => {
                            onPick(null);
                            if (ref.current) ref.current.value = '';
                        }}
                        className="rounded p-1 text-ink-soft hover:bg-black/5"
                    >
                        <X className="size-4" />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => ref.current?.click()}
                    className={cx(
                        'flex flex-col items-center gap-1 rounded-lg border border-dashed p-4 text-center text-sm transition hover:border-gold hover:bg-gold/5',
                        error ? 'border-red-400' : 'border-black/20',
                    )}
                >
                    <FileUp className="size-5 text-ink-soft" />
                    <span className="font-semibold text-ink">Upload {label.toLowerCase()}</span>
                    <span className="text-xs text-ink-soft">{hint}</span>
                    <span className="text-xs text-ink-soft">PDF, JPG or PNG · up to {maxMb} MB</span>
                </button>
            )}
            <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
        </Field>
    );
}

/** The authorization letter and venue permit after booking: status, files, upload or replace. */
function DocumentsBlock({
    projectId,
    documents,
    canUpload,
    rules,
    cutoffDays,
}: {
    projectId: number;
    documents: SiteAccessDocument[];
    canUpload: boolean;
    rules: OcularVisitInfo['documentRules'];
    cutoffDays: number;
}) {
    const [uploading, setUploading] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string | undefined>>({});

    const upload = (doc: SiteAccessDocument, file: File | undefined) => {
        if (!file) return;
        const problem = fileProblem(file, rules, doc.label);
        setErrors((e) => ({ ...e, [doc.type]: problem ?? undefined }));
        if (problem) return;

        setUploading(doc.type);
        router.post(
            `/customer/projects/${projectId}/site-access-documents`,
            { type: doc.type, file },
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: (page) => {
                    const serverErrors = (page.props.errors ?? {}) as Record<string, string>;
                    if (serverErrors.documents || serverErrors.file) {
                        setErrors((e) => ({ ...e, [doc.type]: serverErrors.documents ?? serverErrors.file }));
                        return;
                    }
                    toast.success(`${doc.label} uploaded. Our Project Manager will review it.`);
                },
                onError: (serverErrors) =>
                    setErrors((e) => ({ ...e, [doc.type]: (serverErrors as Record<string, string>).file ?? (serverErrors as Record<string, string>).documents })),
                onFinish: () => setUploading(null),
            },
        );
    };

    return (
        <Block>
            <BlockHeader
                title="Site access documents"
                description="Needed for a rented or third-party venue, so our team can inspect it even without you"
                icon={<FileCheck2 className="size-5" />}
            />
            <ul className="grid gap-3">
                {documents.map((doc) => (
                    <DocumentRow
                        key={doc.type}
                        doc={doc}
                        canUpload={canUpload}
                        uploading={uploading === doc.type}
                        error={errors[doc.type]}
                        maxMb={rules.maxMb}
                        onUpload={(f) => upload(doc, f)}
                    />
                ))}
            </ul>
            {canUpload && (
                <p className="mt-3 text-xs text-ink-soft">
                    You can upload or replace these until {cutoffDays} day before the visit. A new file is reviewed again before your visit is
                    confirmed.
                </p>
            )}
        </Block>
    );
}

function DocumentRow({
    doc,
    canUpload,
    uploading,
    error,
    maxMb,
    onUpload,
}: {
    doc: SiteAccessDocument;
    canUpload: boolean;
    uploading: boolean;
    error?: string;
    maxMb: number;
    onUpload: (file: File | undefined) => void;
}) {
    const ref = useRef<HTMLInputElement>(null);
    const [showHistory, setShowHistory] = useState(false);
    const c = doc.current;

    return (
        <li className="rounded-xl border border-black/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-ink">{doc.label}</span>
                {c ? <Pill tone={DOC_STATUS[c.status].tone}>{DOC_STATUS[c.status].label}</Pill> : <Pill tone="gray">Not uploaded</Pill>}
            </div>

            {c && (
                <div className="mt-2">
                    <SmallFileLinks name={c.name} url={c.url} viewable={c.viewable} meta={`Uploaded ${formatDate(c.uploadedAt.slice(0, 10))}`} />
                </div>
            )}

            {c?.status === 'rejected' && c.remarks && (
                <Notice tone="error" className="mt-2">
                    Reason: {c.remarks}. Please upload a new file.
                </Notice>
            )}

            {error && (
                <p className="mt-2 text-sm text-red-700" role="alert">
                    {error}
                </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
                {canUpload && (
                    <>
                        <OutlineButton onClick={() => ref.current?.click()} disabled={uploading}>
                            <FileUp className="size-4" /> {uploading ? 'Uploading…' : c ? 'Replace' : 'Upload'}
                        </OutlineButton>
                        <span className="text-xs text-ink-soft">PDF, JPG or PNG · up to {maxMb} MB</span>
                        <input
                            ref={ref}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => {
                                onUpload(e.target.files?.[0]);
                                e.target.value = '';
                            }}
                        />
                    </>
                )}
                {doc.history.length > 0 && (
                    <button type="button" onClick={() => setShowHistory((v) => !v)} className="text-xs font-semibold text-gold-dark hover:underline">
                        {showHistory ? 'Hide' : 'Show'} earlier files ({doc.history.length})
                    </button>
                )}
            </div>

            {showHistory && (
                <ul className="mt-3 grid gap-2 border-t border-black/10 pt-3">
                    {doc.history.map((h) => (
                        <li key={h.id} className="grid gap-1">
                            <SmallFileLinks
                                name={h.name}
                                url={h.url}
                                viewable={h.viewable}
                                meta={`Replaced ${formatDate(h.replacedAt ?? h.uploadedAt.slice(0, 10))} · ${DOC_STATUS[h.status].label}`}
                            />
                            {h.status === 'rejected' && h.remarks && <p className="text-xs text-ink-soft">Reason: {h.remarks}</p>}
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}

function SmallFileLinks({ name, url, viewable, meta }: { name: string; url: string; viewable: boolean; meta: string }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-gold-dark" />
                <span className="truncate text-ink">{name}</span>
                <span className="text-xs text-ink-soft">{meta}</span>
            </span>
            <span className="flex gap-3 text-xs font-semibold">
                {viewable && (
                    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gold-dark hover:underline">
                        <ExternalLink className="size-3.5" /> View
                    </a>
                )}
                <a href={`${url}?download=1`} className="inline-flex items-center gap-1 text-gold-dark hover:underline">
                    <Download className="size-3.5" /> Download
                </a>
            </span>
        </div>
    );
}
