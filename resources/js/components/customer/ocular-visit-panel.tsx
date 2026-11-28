import { router } from '@inertiajs/react';
import {
    Building2,
    CalendarCheck,
    CalendarClock,
    Check,
    ChevronDown,
    Clock,
    DoorOpen,
    Download,
    ExternalLink,
    FileCheck2,
    FileText,
    FileUp,
    History,
    Home,
    Image as ImageIcon,
    Info,
    Palette,
    Ruler,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { AppointmentCard, Block, BlockHeader, EMPTY_SLOT, Notice, ReasonField, SlotPicker, addMinutes } from '@/components/customer/appointment-parts';
import type { AppointmentErrors, AppointmentSlot } from '@/components/customer/appointment-parts';
import { VENUE_OWNERSHIPS, addDaysISO, formatDate, formatLongDate, formatTime, fromISO } from '@/components/customer/project-types';
import type {
    AppointmentSchedule,
    OcularVisitInfo,
    OutcomeFile,
    SiteAccessDocument,
    SiteAccessFile,
    SiteAssessment,
    VenueOwnership,
} from '@/components/customer/project-types';
import { Field, GoldButton, OutlineButton, Pill, cx } from '@/components/dashboard/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PhotoViewer from '@/components/customer/photo-viewer';

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
 *
 * Layout: each state is one edge-to-edge card.
 *  - booking: 4-step guide, calendar left / time, venue and documents right, summary bar with Book
 *  - booked: date tile, time with its status, "Site access documents" button (pop-up with the
 *    requirements and, for a rented venue, each file); then "Before the visit" (with Reschedule)
 *    beside "After the visit"
 *  - held: green date tile, then the site assessment (notes beside the report, photos across)
 * Earlier bookings are folded at the bottom of the card.
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
    const [docsOpen, setDocsOpen] = useState(false);
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
                /* Booked: one card. Date row (status next to the time, documents on the right), then before / after the visit. */
                <section className="overflow-hidden rounded-xl border border-black/10 bg-white">
                    <VisitTopRow
                        visit={current}
                        tone="gold"
                        heading={
                            <>
                                {formatTime(current.startTime)} – {formatTime(current.endTime)}
                                <Pill tone={current.status === 'pending' ? 'yellow' : 'green'} className="ml-2 align-middle">
                                    {current.status === 'pending' ? 'Pending' : 'Confirmed'}
                                </Pill>
                            </>
                        }
                        line={
                            current.status === 'pending'
                                ? 'Confirmed once your site access documents are approved'
                                : thirdParty
                                  ? 'Site access documents approved'
                                  : 'No site access documents needed'
                        }
                        onDocuments={() => setDocsOpen(true)}
                    />
                    <div className="grid grid-cols-1 divide-y divide-black/10 border-t border-black/10 md:grid-cols-2 md:divide-x md:divide-y-0">
                        <div className="p-4">
                            <h4 className="font-bold text-ink">Before the visit</h4>
                            <ul className="mt-2 grid gap-2 text-sm text-ink">
                                {thirdParty && current.status === 'pending' && (
                                    <Tip icon={FileUp}>
                                        Upload your{' '}
                                        <button type="button" onClick={() => setDocsOpen(true)} className="font-bold text-gold-dark hover:underline">
                                            site access documents
                                        </button>{' '}
                                        by {formatDate(addDaysISO(current.date, -rules.changeCutoffDays))}.
                                    </Tip>
                                )}
                                <Tip icon={DoorOpen}>Make sure someone can let our team in.</Tip>
                                <Tip icon={Building2}>Let the venue know we are coming.</Tip>
                            </ul>
                            {canChange ? (
                                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                                    <OutlineButton onClick={openReschedule} className="w-full shrink-0 sm:w-auto">
                                        <CalendarClock className="size-4" /> Reschedule
                                    </OutlineButton>
                                    <p className="text-xs text-ink-soft">
                                        Until {formatDate(addDaysISO(current.date, -rules.changeCutoffDays))}. The visit can&apos;t be cancelled, as we need it
                                        before the design can start.
                                    </p>
                                </div>
                            ) : (
                                changeBlockedReason && <p className="mt-4 text-xs text-ink-soft">{changeBlockedReason}</p>
                            )}
                        </div>
                        <div className="p-4">
                            <h4 className="font-bold text-ink">After the visit</h4>
                            <ul className="mt-2 grid gap-2 text-sm text-ink">
                                <Tip icon={Ruler}>Our Project Manager measures and checks your venue.</Tip>
                                <Tip icon={ImageIcon}>The site assessment report and venue photos appear here.</Tip>
                                <Tip icon={Palette}>Then we start on your design proposal.</Tip>
                            </ul>
                        </div>
                    </div>
                    <HistoryFold earlier={earlier} />
                </section>
            ) : canBook ? (
                /*
                 * One edge-to-edge card: the 4 booking steps across the top, the form
                 * (calendar left; time, venue and documents right) and the summary bar
                 * with the Book button. The "what to do" line is in the page header and
                 * the venue and length are next to the step title, so nothing repeats here.
                 */
                <section className="overflow-hidden rounded-xl border border-black/10 bg-white">
                    <BookingGuide
                        steps={[
                            { title: 'Pick a date and time', hint: `Mon–Sat, at least ${rules.leadDays} days ahead`, done: !!slot.date && !!slot.time },
                            { title: 'Tell us whose venue it is', hint: 'Your own, or rented', done: !!ownership },
                            {
                                title: 'Add site access documents',
                                hint: ownership === 'own_property' ? 'Not needed for your own property' : 'Rented venues only · optional now',
                                done: ownership === 'own_property' || (ownership === 'third_party' && !!files.authorizationLetter && !!files.venuePermit),
                            },
                            { title: 'Book', hint: 'Check your booking below', done: false },
                        ]}
                    />

                    <div className="p-4 sm:p-5">
                        <SlotPicker
                            noun="ocular visit"
                            slot={slot}
                            setSlot={setSlot}
                            errors={errors}
                            availableSlots={availableSlots}
                            rules={rules}
                            labelPrefix="1 · "
                            aside={
                                <>
                                    <Field label="2 · Whose venue is it?" required error={errors.venueOwnership}>
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
                                                        onClick={() => {
                                                            setOwnership(o.value);
                                                            setErrors((e) => ({ ...e, venueOwnership: undefined }));
                                                        }}
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
                                        <div className="grid gap-2">
                                            <div>
                                                <p className="text-sm font-semibold text-ink">3 · Site access documents</p>
                                                <p className="text-xs text-ink-soft">
                                                    So our team can inspect the venue even without you. Optional now: add them until{' '}
                                                    {rules.changeCutoffDays} day before the visit. Your visit is confirmed once both are approved.
                                                </p>
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2">
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

                                    {/* The visit tips fill the bottom of the column, level with the calendar. */}
                                    <p className="mt-auto flex items-start gap-2 rounded-lg bg-black/[0.03] p-3 text-xs text-ink-soft">
                                        <Info className="mt-0.5 size-4 shrink-0" />
                                        <span>
                                            Make sure someone can let our team in on the day, and let the venue know we are coming. You can reschedule
                                            until {rules.changeCutoffDays} day before; the visit can't be cancelled, as we need it before the design can
                                            start.
                                        </span>
                                    </p>
                                </>
                            }
                        />
                    </div>

                    {/* 4 · What the customer picked, with the Book button. */}
                    <div className="flex flex-col gap-3 border-t border-gold/40 bg-gold/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold tracking-wide text-gold-dark uppercase">4 · Your booking</p>
                            <p className="text-sm font-bold text-ink">
                                {bookingSummary(slot, rules.slotMinutes, ownership) ?? 'No date, time or venue picked yet'}
                            </p>
                            {(errors.date || errors.time || errors.venueOwnership) && (
                                <p className="mt-0.5 text-xs text-red-700" role="alert">
                                    {[errors.date, errors.time, errors.venueOwnership].filter(Boolean).join(' ')}
                                </p>
                            )}
                        </div>
                        <GoldButton onClick={book} disabled={saving} className="w-full shrink-0 sm:w-auto">
                            {saving ? 'Booking…' : 'Book Ocular Visit'}
                        </GoldButton>
                    </div>
                </section>
            ) : held ? (
                /* Held: one card. The visit, then the site assessment (notes beside the report, photos across), then earlier bookings. */
                <section className="overflow-hidden rounded-xl border border-black/10 bg-white">
                    <VisitTopRow
                        visit={held}
                        tone="green"
                        heading={
                            <>
                                Visit held
                                <Pill tone="green" className="ml-2 align-middle">
                                    Done
                                </Pill>
                            </>
                        }
                        line={`${formatTime(held.startTime)} – ${formatTime(held.endTime)}${
                            assessment ? ` · assessed ${formatDate(assessment.recordedAt)} by the ${assessment.recordedBy}` : ''
                        }`}
                        onDocuments={() => setDocsOpen(true)}
                    />
                    {assessment ? (
                        <AssessmentSections assessment={assessment} />
                    ) : (
                        <p className="flex items-start gap-2 border-t border-black/10 bg-neutral-50 p-4 text-sm text-ink-soft">
                            <Clock className="mt-0.5 size-4 shrink-0" /> Our team is writing up the site assessment. The report and venue photos will
                            appear here.
                        </p>
                    )}
                    <HistoryFold earlier={earlier} />
                </section>
            ) : (
                bookingBlockedReason && (
                    <Block>
                        <BlockHeader title="Ocular visit" icon={<CalendarCheck className="size-5" />} />
                        <Notice>{bookingBlockedReason}</Notice>
                    </Block>
                )
            )}

            {visit && (
                <DocumentsDialog
                    open={docsOpen}
                    onOpenChange={setDocsOpen}
                    projectId={projectId}
                    venue={venue}
                    thirdParty={thirdParty}
                    documents={documents}
                    canUpload={ocularVisit.canUploadDocuments}
                    rules={documentRules}
                    cutoff={formatDate(addDaysISO(visit.date, -rules.changeCutoffDays))}
                />
            )}

            <Dialog open={rescheduling} onOpenChange={(open) => !open && setRescheduling(false)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto p-4 sm:max-w-3xl sm:p-6">
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

/**
 * The visit card's date row: a date tile on the left; the heading (time and status, or "Visit held")
 * with one line under it; and the Site access documents button on the right (under the text on phones).
 */
function VisitTopRow({
    visit,
    tone,
    heading,
    line,
    onDocuments,
}: {
    visit: AppointmentSchedule;
    tone: 'gold' | 'green';
    heading: ReactNode;
    line: string;
    onDocuments: () => void;
}) {
    const d = fromISO(visit.date);
    const tile = tone === 'green' ? 'border-green-200 bg-green-50 text-green-800' : 'border-gold/40 bg-gold/10 text-gold-dark';

    return (
        <div className="flex items-stretch">
            <div className={cx('flex w-20 shrink-0 flex-col items-center justify-center border-r px-2 py-3 text-center sm:w-24', tile)}>
                <span className="text-[11px] font-bold uppercase">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                <span className="text-3xl leading-tight font-bold text-ink">{d.getDate()}</span>
                <span className="text-[11px] font-semibold uppercase">
                    {d.toLocaleDateString('en-US', { weekday: 'short' })} · {d.getFullYear()}
                </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-base font-bold text-ink sm:text-lg">{heading}</p>
                    <p className="text-sm text-ink-soft">{line}</p>
                    {visit.remarks && (
                        <p className="mt-1 text-xs text-ink-soft">
                            {visit.remarks}
                            {visit.changedBy && ` — by ${visit.changedBy}`}
                        </p>
                    )}
                </div>
                <OutlineButton onClick={onDocuments} className="w-full shrink-0 sm:w-auto">
                    <FileCheck2 className="size-4" /> Site access documents
                </OutlineButton>
            </div>
        </div>
    );
}

/** One line of "Before the visit" / "After the visit". */
function Tip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
    return (
        <li className="flex items-start gap-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-gold-dark" />
            <span>{children}</span>
        </li>
    );
}

/** Earlier bookings of this visit, folded at the bottom of the card. */
function HistoryFold({ earlier }: { earlier: AppointmentSchedule[] }) {
    const [open, setOpen] = useState(false);
    if (earlier.length === 0) return null;

    return (
        <div className="border-t border-black/10 bg-neutral-50">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-ink-soft hover:text-ink"
            >
                <History className="size-4" /> Earlier bookings ({earlier.length})
                <ChevronDown className={cx('ml-auto size-4 transition', open && 'rotate-180')} />
            </button>
            {open && (
                <ul className="grid gap-2 px-4 pb-4">
                    {earlier.map((s) => (
                        <li key={s.id} className="rounded-lg border border-black/10 bg-white p-3">
                            <AppointmentCard schedule={s} compact />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** The site assessment inside the held card: notes beside the report and other files, then the photos across. */
function AssessmentSections({ assessment: a }: { assessment: SiteAssessment }) {
    const [photo, setPhoto] = useState<number | null>(null);
    const files = [...(a.report ? [a.report] : []), ...a.attachments];
    const both = !!a.notes && files.length > 0;

    return (
        <>
            {(a.notes || files.length > 0) && (
                <div
                    className={cx(
                        'grid grid-cols-1 divide-y divide-black/10 border-t border-black/10',
                        both && 'md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:divide-x md:divide-y-0',
                    )}
                >
                    {a.notes && (
                        <div className="p-4">
                            <h4 className="font-bold text-ink">Notes</h4>
                            <p className="mt-1 text-sm whitespace-pre-line text-ink">{a.notes}</p>
                        </div>
                    )}
                    {files.length > 0 && (
                        <div className="p-4">
                            <h4 className="font-bold text-ink">{a.report ? 'Report' : 'Files'}</h4>
                            <ul className="mt-2 grid gap-2">
                                {files.map((f) => (
                                    <li key={f.id}>
                                        <FileRow file={f} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {a.photos.length > 0 && (
                <div className="border-t border-black/10 p-4">
                    <h4 className="font-bold text-ink">Venue photos ({a.photos.length})</h4>
                    <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
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

            <PhotoViewer photos={a.photos} index={photo} onIndex={setPhoto} caption={`Ocular visit on ${formatDate(a.visitDate)}`} />
        </>
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

/**
 * The 4 booking steps across the top of the form. Finished ones turn green;
 * the first unfinished one is gold. Phones: two per row; laptops: one row.
 */
function BookingGuide({ steps }: { steps: { title: string; hint: string; done: boolean }[] }) {
    const next = steps.findIndex((s) => !s.done);

    return (
        // gap-px over a grey background draws the dividers between steps on every layout.
        <ol className="grid grid-cols-1 gap-px border-b border-black/10 bg-black/10 sm:grid-cols-2 lg:grid-cols-4" aria-label="How to book">
            {steps.map((s, i) => {
                const current = i === next;
                return (
                    <li
                        key={s.title}
                        aria-current={current ? 'step' : undefined}
                        className="flex items-start gap-3 bg-neutral-50 px-4 py-3 sm:px-5"
                    >
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

/** "Saturday, December 12, 2026 · 9:00 AM – 11:00 AM · My own property", or null when nothing is picked. */
function bookingSummary(slot: { date: string; time: string }, slotMinutes: number, ownership: VenueOwnership | ''): string | null {
    const parts: string[] = [];
    if (slot.date) parts.push(formatLongDate(slot.date));
    if (slot.time) parts.push(`${formatTime(slot.time)} – ${formatTime(addMinutes(slot.time, slotMinutes))}`);
    if (ownership) parts.push(VENUE_OWNERSHIPS.find((o) => o.value === ownership)?.label ?? '');
    return parts.length > 0 ? parts.join(' · ') : null;
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
                        'flex w-full flex-col items-center gap-1 rounded-lg border border-dashed p-4 text-center text-sm transition hover:border-gold hover:bg-gold/5',
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

/**
 * "Site access documents" pop-up, opened from the visit card: what we need and why,
 * then (rented or third-party venue) each document with its status, upload or replace.
 * Own property: the requirements only, with a note that they aren't needed.
 */
function DocumentsDialog({
    open,
    onOpenChange,
    projectId,
    venue,
    thirdParty,
    documents,
    canUpload,
    rules,
    cutoff,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: number;
    venue: string;
    thirdParty: boolean;
    documents: SiteAccessDocument[];
    canUpload: boolean;
    rules: OcularVisitInfo['documentRules'];
    cutoff: string;
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto p-4 sm:max-w-xl sm:p-6">
                <DialogHeader>
                    <DialogTitle>Site access documents</DialogTitle>
                    <DialogDescription>
                        {thirdParty
                            ? `Needed because ${venue} is a rented or third-party venue, so our team can inspect it even without you.`
                            : `Not needed: you told us ${venue} is your own property.`}
                    </DialogDescription>
                </DialogHeader>

                <div className="rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm">
                    <p className="font-bold text-ink">What we need for a rented or third-party venue</p>
                    <ol className="mt-1 grid gap-1">
                        {BOOKING_FILES.map((d, i) => (
                            <li key={d.field} className="flex gap-2">
                                <span className="font-bold text-gold-dark">{i + 1}.</span>
                                <span>
                                    <span className="font-semibold text-ink">{d.label}</span>
                                    <span className="text-ink-soft"> — {d.hint}</span>
                                </span>
                            </li>
                        ))}
                    </ol>
                    <p className="mt-2 text-xs text-ink-soft">
                        {thirdParty
                            ? `PDF, JPG or PNG, up to ${rules.maxMb} MB each. Upload or replace until ${cutoff}. Your visit is confirmed once both are approved; without them it may be moved.`
                            : 'If the venue is actually rented, please contact our Project Manager so we can ask for these before the visit.'}
                    </p>
                </div>

                {thirdParty && (
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
                )}

                <DialogFooter>
                    <OutlineButton onClick={() => onOpenChange(false)}>Close</OutlineButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
