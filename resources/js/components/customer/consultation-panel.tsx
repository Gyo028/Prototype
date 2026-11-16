import { router } from '@inertiajs/react';
import { CalendarCheck, CalendarClock, History, Info, MapPin, Video, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import DatePicker from '@/components/customer/date-picker';
import {
    MEETING_MODES,
    SLOT_TIMES,
    addDaysISO,
    formatLongDate,
    formatTime,
    isSunday,
    meetingModeLabel,
} from '@/components/customer/project-types';
import type { ConsultationInfo, ConsultationRules, ConsultationSchedule, MeetingMode } from '@/components/customer/project-types';
import { DangerButton, Field, GoldButton, OutlineButton, Pill, cx, textareaClass } from '@/components/dashboard/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/*
 * Backlog #15: Schedule a consultation appointment (Plan Project, step 1).
 *
 * The customer picks online or face to face, a date and a 1-hour slot.
 * Monday to Saturday, 9:00 AM – 5:00 PM, at least 7 days ahead and before
 * the event date. A booking is confirmed right away.
 *
 * The customer can reschedule or cancel, with a reason, until the day before
 * the appointment. Earlier bookings stay in the history with the reason.
 */

type Props = {
    projectId: number;
    consultation: ConsultationInfo;
    availableSlots: Record<string, string[]>;
    rules: ConsultationRules;
    /** The decision recorded after the consultation (null until then). */
    decision: 'proceed' | 'hold' | 'cancelled' | null;
};

const DECISION_TEXT: Record<'proceed' | 'hold' | 'cancelled', string> = {
    proceed: 'You decided to go ahead with the project.',
    hold: 'You put the project on hold for now.',
    cancelled: 'You decided not to go ahead with the project.',
};

type Slot = { date: string; time: string; meetingMode: MeetingMode | '' };
type Errors = Partial<Record<'date' | 'time' | 'meetingMode' | 'reason' | 'consultation', string>>;

const EMPTY_SLOT: Slot = { date: '', time: '', meetingMode: '' };

export default function ConsultationPanel({ projectId, consultation, availableSlots, rules, decision }: Props) {
    const base = `/customer/projects/${projectId}/consultation`;
    const { current, history, canBook, bookingBlockedReason, canChange, changeBlockedReason } = consultation;
    // The consultation that took place, shown as the summary; the rest stay in History.
    const held = history.find((s) => s.status === 'completed') ?? null;
    const earlier = history.filter((s) => s !== held);

    const [slot, setSlot] = useState<Slot>(EMPTY_SLOT);
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);
    const [dialog, setDialog] = useState<'reschedule' | 'cancel' | null>(null);
    const [reason, setReason] = useState('');

    const openDialog = (kind: 'reschedule' | 'cancel') => {
        setSlot(kind === 'reschedule' ? { ...EMPTY_SLOT, meetingMode: current?.meetingMode ?? '' } : EMPTY_SLOT);
        setReason('');
        setErrors({});
        setDialog(kind);
    };

    /** Checks the form before sending; the server checks everything again. */
    const checkSlot = (): Errors => {
        const e: Errors = {};
        if (!slot.meetingMode) e.meetingMode = 'Choose online or face to face.';
        if (!slot.date) e.date = 'Pick a date.';
        else if (!slot.time) e.time = 'Pick a time.';
        return e;
    };

    const send = (method: 'post' | 'patch', url: string, data: Record<string, string>, done: string) => {
        setSaving(true);
        router[method](url, data, {
            preserveScroll: true,
            onSuccess: (page) => {
                // A rule broken on the server comes back as an error, not a success.
                const serverErrors = (page.props.errors ?? {}) as Errors;
                if (Object.keys(serverErrors).length > 0) {
                    setErrors(serverErrors);
                    return;
                }
                toast.success(done);
                setSlot(EMPTY_SLOT);
                setReason('');
                setDialog(null);
                setErrors({});
            },
            onError: (serverErrors) => setErrors(serverErrors as Errors),
            onFinish: () => setSaving(false),
        });
    };

    const book = () => {
        const e = checkSlot();
        setErrors(e);
        if (Object.keys(e).length === 0) send('post', base, slot, 'Your consultation is booked.');
    };

    const reschedule = () => {
        const e = checkSlot();
        if (!reason.trim()) e.reason = 'Please give a reason.';
        setErrors(e);
        if (Object.keys(e).length === 0) send('patch', `${base}/reschedule`, { ...slot, reason }, 'Your consultation has been moved.');
    };

    const cancel = () => {
        if (!reason.trim()) return setErrors({ reason: 'Please give a reason.' });
        send('patch', `${base}/cancel`, { reason }, 'Your consultation has been cancelled.');
    };

    return (
        <div className="grid gap-4">
            {errors.consultation && !dialog && <Notice tone="error">{errors.consultation}</Notice>}

            {current ? (
                <Block>
                    <BlockHeader title="Your consultation" description="Booked and confirmed" icon={<CalendarCheck className="size-5" />} />
                    <AppointmentCard schedule={current} />
                    {canChange ? (
                        <div className="mt-5 flex flex-wrap gap-3">
                            <OutlineButton onClick={() => openDialog('reschedule')}>
                                <CalendarClock className="size-4" /> Reschedule
                            </OutlineButton>
                            <DangerButton onClick={() => openDialog('cancel')}>
                                <X className="size-4" /> Cancel
                            </DangerButton>
                        </div>
                    ) : (
                        changeBlockedReason && <Notice className="mt-5">{changeBlockedReason}</Notice>
                    )}
                    {canChange && (
                        <p className="mt-3 text-xs text-ink-soft">
                            You can reschedule or cancel until {rules.changeCutoffDays} day before the appointment.
                        </p>
                    )}
                </Block>
            ) : canBook ? (
                <Block>
                    <BlockHeader
                        title="Book your consultation"
                        description="Meet with our Project Manager to discuss your requirements."
                        icon={<CalendarCheck className="size-5" />}
                    />
                    <SlotPicker slot={slot} setSlot={setSlot} errors={errors} availableSlots={availableSlots} rules={rules} />
                    <div className="mt-6 flex justify-end">
                        <GoldButton onClick={book} disabled={saving}>
                            {saving ? 'Booking…' : 'Book Consultation'}
                        </GoldButton>
                    </div>
                </Block>
            ) : held ? (
                <Block>
                    <BlockHeader title="Consultation held" description="Thank you for meeting with us" icon={<CalendarCheck className="size-5" />} />
                    <AppointmentCard schedule={held} />
                    <Notice className="mt-5">{decision ? DECISION_TEXT[decision] : 'Our Project Manager is recording the outcome of your consultation.'}</Notice>
                </Block>
            ) : (
                bookingBlockedReason && (
                    <Block>
                        <BlockHeader title="Consultation" icon={<CalendarCheck className="size-5" />} />
                        <Notice>{bookingBlockedReason}</Notice>
                    </Block>
                )
            )}

            {earlier.length > 0 && (
                <Block>
                    <BlockHeader title="History" description="Earlier bookings for this project" icon={<History className="size-5" />} />
                    <ul className="grid gap-3">
                        {earlier.map((s) => (
                            <li key={s.id} className="rounded-xl border border-black/10 p-4">
                                <AppointmentCard schedule={s} compact />
                            </li>
                        ))}
                    </ul>
                </Block>
            )}

            <Dialog open={dialog === 'reschedule'} onOpenChange={(open) => !open && setDialog(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Reschedule consultation</DialogTitle>
                        <DialogDescription>
                            {current && `Currently ${formatLongDate(current.date)}, ${formatTime(current.startTime)}. `}
                            Pick a new date and time, and tell us why.
                        </DialogDescription>
                    </DialogHeader>
                    {errors.consultation && <Notice tone="error">{errors.consultation}</Notice>}
                    <SlotPicker slot={slot} setSlot={setSlot} errors={errors} availableSlots={availableSlots} rules={rules} />
                    <ReasonField value={reason} onChange={setReason} error={errors.reason} max={rules.reasonMax} />
                    <DialogFooter>
                        <OutlineButton onClick={() => setDialog(null)}>Back</OutlineButton>
                        <GoldButton onClick={reschedule} disabled={saving}>
                            {saving ? 'Saving…' : 'Move Consultation'}
                        </GoldButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={dialog === 'cancel'} onOpenChange={(open) => !open && setDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel consultation</DialogTitle>
                        <DialogDescription>
                            {current && `${formatLongDate(current.date)}, ${formatTime(current.startTime)}. `}
                            You can book a new one afterwards.
                        </DialogDescription>
                    </DialogHeader>
                    {errors.consultation && <Notice tone="error">{errors.consultation}</Notice>}
                    <ReasonField value={reason} onChange={setReason} error={errors.reason} max={rules.reasonMax} />
                    <DialogFooter>
                        <OutlineButton onClick={() => setDialog(null)}>Keep It</OutlineButton>
                        <DangerButton onClick={cancel} disabled={saving}>
                            {saving ? 'Cancelling…' : 'Cancel Consultation'}
                        </DangerButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** Meeting mode, calendar and time slots. Used for booking and rescheduling. */
function SlotPicker({
    slot,
    setSlot,
    errors,
    availableSlots,
    rules,
}: {
    slot: Slot;
    setSlot: (s: Slot) => void;
    errors: Errors;
    availableSlots: Record<string, string[]>;
    rules: ConsultationRules;
}) {
    // Grey days with their reason. Two months past the last day cover what the calendar can show next.
    const unavailableDates = useMemo(() => {
        const out: Record<string, string> = {};
        const until = addDaysISO(rules.latestDate, 62);
        for (let d = rules.earliestDate; d <= until; d = addDaysISO(d, 1)) {
            if (d > rules.latestDate) out[d] = 'The consultation must be before your event date.';
            else if (isSunday(d)) out[d] = 'Consultations are held Monday to Saturday.';
            else if (!availableSlots[d]) out[d] = 'All time slots on this day are taken.';
        }
        return out;
    }, [availableSlots, rules]);

    const open = slot.date ? (availableSlots[slot.date] ?? []) : [];

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="grid content-start gap-5">
                <Field label="How would you like to meet?" required error={errors.meetingMode}>
                    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Meeting mode">
                        {MEETING_MODES.map((m) => {
                            const selected = slot.meetingMode === m.value;
                            const Icon = m.value === 'online' ? Video : MapPin;
                            return (
                                <button
                                    key={m.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => setSlot({ ...slot, meetingMode: m.value })}
                                    className={cx(
                                        'flex items-start gap-3 rounded-xl border p-3 text-left transition',
                                        selected ? 'border-gold bg-gold/10' : 'border-black/15 bg-white hover:border-gold',
                                    )}
                                >
                                    <Icon className={cx('mt-0.5 size-5 shrink-0', selected ? 'text-gold-dark' : 'text-ink-soft')} />
                                    <span>
                                        <span className="block text-sm font-bold text-ink">{m.label}</span>
                                        <span className="block text-xs text-ink-soft">{m.hint}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </Field>

                <Field label={slot.date ? `Time on ${formatLongDate(slot.date)}` : 'Time'} required error={errors.time}>
                    {!slot.date ? (
                        <p className="rounded-lg border border-dashed border-black/15 p-4 text-center text-xs text-ink-soft">Pick a date first.</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {SLOT_TIMES.map((t) => {
                                const free = open.includes(t);
                                const selected = slot.time === t;
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        disabled={!free}
                                        aria-pressed={selected}
                                        title={free ? undefined : 'This slot is taken.'}
                                        onClick={() => setSlot({ ...slot, time: t })}
                                        className={cx(
                                            'rounded-lg border px-2 py-2 text-sm font-semibold transition',
                                            selected
                                                ? 'border-gold bg-gold text-white'
                                                : free
                                                  ? 'border-black/15 bg-white text-ink hover:border-gold'
                                                  : 'cursor-not-allowed border-black/5 bg-black/5 text-ink-soft/60 line-through',
                                        )}
                                    >
                                        {formatTime(t)}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </Field>
                <p className="text-xs text-ink-soft">Each consultation takes about 1 hour.</p>
            </div>

            <Field label="Date" required error={errors.date}>
                <DatePicker
                    value={slot.date}
                    onChange={(date) => setSlot({ ...slot, date, time: '' })}
                    minDate={rules.earliestDate}
                    disabledDates={[]}
                    unavailableDates={unavailableDates}
                    tooSoonText={`Please book at least ${rules.leadDays} days ahead.`}
                    hint={`Monday to Saturday, 9:00 AM – 5:00 PM. Book at least ${rules.leadDays} days ahead and before your event date.`}
                    hasError={!!errors.date}
                />
            </Field>
        </div>
    );
}

function AppointmentCard({ schedule, compact = false }: { schedule: ConsultationSchedule; compact?: boolean }) {
    const tone = schedule.status === 'confirmed' ? 'green' : schedule.status === 'cancelled' ? 'red' : schedule.status === 'completed' ? 'blue' : 'gray';
    const Icon = schedule.meetingMode === 'online' ? Video : MapPin;

    return (
        <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className={cx('font-bold text-ink', compact ? 'text-sm' : 'text-lg')}>
                    {formatLongDate(schedule.date)}
                    <span className="font-normal text-ink-soft">
                        {' · '}
                        {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}
                    </span>
                </div>
                <Pill tone={tone}>{schedule.status[0].toUpperCase() + schedule.status.slice(1)}</Pill>
            </div>
            {schedule.meetingMode && (
                <div className="flex items-center gap-2 text-sm text-ink-soft">
                    <Icon className="size-4" /> {meetingModeLabel(schedule.meetingMode)}
                </div>
            )}
            {schedule.remarks && (
                <p className="text-sm text-ink">
                    {schedule.remarks}
                    {schedule.changedBy && <span className="text-ink-soft"> — by {schedule.changedBy}</span>}
                </p>
            )}
        </div>
    );
}

function ReasonField({ value, onChange, error, max }: { value: string; onChange: (v: string) => void; error?: string; max: number }) {
    return (
        <Field label="Reason" htmlFor="consultation-reason" required error={error}>
            <textarea
                id="consultation-reason"
                className={textareaClass}
                maxLength={max}
                placeholder="e.g. I have a schedule conflict on that day."
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <span className="text-right text-[11px] text-ink-soft">
                {value.length}/{max}
            </span>
        </Field>
    );
}

function Notice({ children, tone = 'info', className }: { children: React.ReactNode; tone?: 'info' | 'error'; className?: string }) {
    return (
        <div
            role={tone === 'error' ? 'alert' : undefined}
            className={cx(
                'flex items-start gap-2 rounded-lg border p-3 text-sm',
                tone === 'error' ? 'border-red-300 bg-red-50 text-red-800' : 'border-gold/40 bg-gold/10 text-ink',
                className,
            )}
        >
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>{children}</span>
        </div>
    );
}

/** A light inner section; the step card around it is the main panel. */
function Block({ children, className }: { children: React.ReactNode; className?: string }) {
    return <section className={cx('rounded-xl border border-black/10 bg-white p-4', className)}>{children}</section>;
}

function BlockHeader({ title, description, icon }: { title: string; description?: string; icon: React.ReactNode }) {
    return (
        <div className="mb-4 flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-gold-dark">{icon}</span>
            <div>
                <h3 className="font-bold leading-tight text-ink">{title}</h3>
                {description && <p className="text-xs text-ink-soft">{description}</p>}
            </div>
        </div>
    );
}
