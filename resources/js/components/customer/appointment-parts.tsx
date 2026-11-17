import { Info, MapPin, Video } from 'lucide-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import DatePicker from '@/components/customer/date-picker';
import { MEETING_MODES, addDaysISO, formatLongDate, formatTime, isSunday, meetingModeLabel } from '@/components/customer/project-types';
import type { AppointmentRules, AppointmentSchedule, MeetingMode } from '@/components/customer/project-types';
import { Field, Pill, cx, textareaClass } from '@/components/dashboard/ui';

/*
 * Pieces shared by the appointments the customer books: the consultation and the ocular visit. 
 * The rules (days, times, slot length) come from the server, so each appointment only passes its own.
 */

export type AppointmentSlot = { date: string; time: string; meetingMode: MeetingMode | '' };
export type AppointmentErrors = Partial<Record<'date' | 'time' | 'meetingMode' | 'reason' | 'consultation' | 'ocularVisit', string>>;

export const EMPTY_SLOT: AppointmentSlot = { date: '', time: '', meetingMode: '' };

/** "14:00" + 120 → "16:00" */
export const addMinutes = (hhmm: string, minutes: number) => {
    const [h, m] = hhmm.split(':').map(Number);
    const total = h * 60 + m + minutes;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** "1 hour", "2 hours" */
export const durationText = (minutes: number) => {
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours} hour${hours === 1 ? '' : 's'}` : `${minutes} minutes`;
};

/**
 * Calendar and time slots, plus the meeting mode when the appointment has one.
 * Used for booking and rescheduling.
 */
export function SlotPicker({
    noun,
    slot,
    setSlot,
    errors,
    availableSlots,
    rules,
    withMeetingMode = false,
}: {
    noun: string; // "consultation", "ocular visit"
    slot: AppointmentSlot;
    setSlot: (s: AppointmentSlot) => void;
    errors: AppointmentErrors;
    availableSlots: Record<string, string[]>;
    rules: AppointmentRules;
    withMeetingMode?: boolean;
}) {
    const Noun = noun[0].toUpperCase() + noun.slice(1);
    const lastEnd = formatTime(addMinutes(rules.slotTimes[rules.slotTimes.length - 1] ?? '16:00', rules.slotMinutes));
    const firstStart = formatTime(rules.slotTimes[0] ?? '09:00');

    // Grey days with their reason. Two months past the last day cover what the calendar can show next.
    const unavailableDates = useMemo(() => {
        const out: Record<string, string> = {};
        const until = addDaysISO(rules.latestDate, 62);
        for (let d = rules.earliestDate; d <= until; d = addDaysISO(d, 1)) {
            if (d > rules.latestDate) out[d] = `The ${noun} must be before your event date.`;
            else if (isSunday(d)) out[d] = `${Noun}s are held Monday to Saturday.`;
            else if (!availableSlots[d]) out[d] = 'All time slots on this day are taken.';
        }
        return out;
    }, [availableSlots, rules, noun, Noun]);

    const open = slot.date ? (availableSlots[slot.date] ?? []) : [];
    const longSlots = rules.slotMinutes > 60;

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="grid content-start gap-5">
                {withMeetingMode && (
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
                )}

                <Field label={slot.date ? `Time on ${formatLongDate(slot.date)}` : 'Time'} required error={errors.time}>
                    {!slot.date ? (
                        <p className="rounded-lg border border-dashed border-black/15 p-4 text-center text-xs text-ink-soft">Pick a date first.</p>
                    ) : (
                        <div className={cx('grid gap-2', longSlots ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
                            {rules.slotTimes.map((t) => {
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
                                        {longSlots && <> – {formatTime(addMinutes(t, rules.slotMinutes))}</>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </Field>
                <p className="text-xs text-ink-soft">
                    Each {noun} takes about {durationText(rules.slotMinutes)}.
                </p>
            </div>

            <Field label="Date" required error={errors.date}>
                <DatePicker
                    value={slot.date}
                    onChange={(date) => setSlot({ ...slot, date, time: '' })}
                    minDate={rules.earliestDate}
                    disabledDates={[]}
                    unavailableDates={unavailableDates}
                    tooSoonText={`Please book at least ${rules.leadDays} days ahead.`}
                    hint={`Monday to Saturday, ${firstStart} – ${lastEnd}. Book at least ${rules.leadDays} days ahead and before your event date.`}
                    hasError={!!errors.date}
                />
            </Field>
        </div>
    );
}

/** Date, time, status and (when changed) the reason of one appointment. */
export function AppointmentCard({ schedule, compact = false, place }: { schedule: AppointmentSchedule; compact?: boolean; place?: string }) {
    const tone =
        schedule.status === 'confirmed'
            ? 'green'
            : schedule.status === 'cancelled'
              ? 'red'
              : schedule.status === 'completed'
                ? 'blue'
                : schedule.status === 'pending'
                  ? 'yellow'
                  : 'gray';
    const Icon = schedule.meetingMode === 'online' ? Video : MapPin;
    const statusLabel = schedule.status === 'completed' ? 'Held' : schedule.status[0].toUpperCase() + schedule.status.slice(1);

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
                <Pill tone={tone}>{statusLabel}</Pill>
            </div>
            {(place || schedule.meetingMode) && (
                <div className="flex items-center gap-2 text-sm text-ink-soft">
                    <Icon className="size-4 shrink-0" /> {place ?? meetingModeLabel(schedule.meetingMode)}
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

export function ReasonField({ id, value, onChange, error, max }: { id: string; value: string; onChange: (v: string) => void; error?: string; max: number }) {
    return (
        <Field label="Reason" htmlFor={id} required error={error}>
            <textarea
                id={id}
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

export function Notice({ children, tone = 'info', className }: { children: ReactNode; tone?: 'info' | 'error'; className?: string }) {
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
export function Block({ children, className }: { children: ReactNode; className?: string }) {
    return <section className={cx('rounded-xl border border-black/10 bg-white p-4', className)}>{children}</section>;
}

export function BlockHeader({ title, description, icon, action }: { title: string; description?: string; icon: ReactNode; action?: ReactNode }) {
    return (
        <div className="mb-4 flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-gold-dark">{icon}</span>
            <div className="min-w-0 flex-1">
                <h3 className="leading-tight font-bold text-ink">{title}</h3>
                {description && <p className="text-xs text-ink-soft">{description}</p>}
            </div>
            {action}
        </div>
    );
}
