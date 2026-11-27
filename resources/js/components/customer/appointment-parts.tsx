import { Info, MapPin, Video } from 'lucide-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import DatePicker from '@/components/customer/date-picker';
import { MEETING_MODES, addDaysISO, formatLongDate, formatTime, isSunday, meetingModeLabel } from '@/components/customer/project-types';
import type { AppointmentRules, AppointmentSchedule, MeetingMode } from '@/components/customer/project-types';
import { Field, Pill, cx, inputClass, textareaClass } from '@/components/dashboard/ui';

/*
 * Pieces shared by the appointments the customer books: the consultation and the ocular visit. 
 * The rules (days, times, slot length) come from the server, so each appointment only passes its own.
 */

// meetingPlace: face-to-face consultations only (any address; '' otherwise).
export type AppointmentSlot = { date: string; time: string; meetingMode: MeetingMode | ''; meetingPlace: string };
export type AppointmentErrors = Partial<Record<'date' | 'time' | 'meetingMode' | 'meetingPlace' | 'reason' | 'consultation' | 'ocularVisit', string>>;

export const EMPTY_SLOT: AppointmentSlot = { date: '', time: '', meetingMode: '', meetingPlace: '' };

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
 * Calendar and time slots, plus the meeting mode and place when the appointment has them.
 * Used for booking and rescheduling.
 *
 * Laptop: the calendar on the left; the time, how to meet and where on the right.
 * Smaller screens: one column in the order it is filled in (date, time, how, where).
 *
 * A day with every slot taken shows as "Booked" (like the service request calendar)
 * and can't be picked; a taken slot is crossed out. The server checks both again.
 */
export function SlotPicker({
    noun,
    slot,
    setSlot,
    errors,
    availableSlots,
    rules,
    withMeetingMode = false,
    officeAddress,
    placeMax = 255,
    footer,
}: {
    noun: string; // "consultation", "ocular visit"
    slot: AppointmentSlot;
    setSlot: (s: AppointmentSlot) => void;
    errors: AppointmentErrors;
    availableSlots: Record<string, string[]>;
    rules: AppointmentRules;
    withMeetingMode?: boolean;
    /** Face to face: the place saved when the "GR3AT A's office" option is picked. */
    officeAddress?: string;
    placeMax?: number;
    /** E.g. the Book button: sits at the bottom of the right column, level with the bottom of the calendar. */
    footer?: ReactNode;
}) {
    const Noun = noun[0].toUpperCase() + noun.slice(1);
    const lastEnd = formatTime(addMinutes(rules.slotTimes[rules.slotTimes.length - 1] ?? '16:00', rules.slotMinutes));
    const firstStart = formatTime(rules.slotTimes[0] ?? '09:00');

    // Fully booked days (every slot taken), and Sundays with their reason.
    // Days after the latest one are greyed by the calendar itself (maxDate).
    const { bookedDates, unavailableDates } = useMemo(() => {
        const booked: string[] = [];
        const out: Record<string, string> = {};
        for (let d = rules.earliestDate; d <= rules.latestDate; d = addDaysISO(d, 1)) {
            if (isSunday(d)) out[d] = `${Noun}s are held Monday to Saturday.`;
            else if (!availableSlots[d]) booked.push(d);
        }
        return { bookedDates: booked, unavailableDates: out };
    }, [availableSlots, rules, Noun]);

    const open = slot.date ? (availableSlots[slot.date] ?? []) : [];
    const longSlots = rules.slotMinutes > 60;
    const faceToFace = withMeetingMode && slot.meetingMode === 'face_to_face';
    const atOffice = !!officeAddress && slot.meetingPlace === officeAddress;

    return (
        // grid-cols-1 (minmax 0) and min-w-0 keep long one-line text, like the office address, from widening the form on phones.
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
            <Field label="Date" required error={errors.date}>
                <DatePicker
                    value={slot.date}
                    onChange={(date) => setSlot({ ...slot, date, time: '' })}
                    minDate={rules.earliestDate}
                    maxDate={rules.latestDate}
                    afterMaxText={`The ${noun} must be before your event date.`}
                    disabledDates={bookedDates}
                    bookedText="All time slots on this day are taken."
                    unavailableDates={unavailableDates}
                    tooSoonText={`Please book at least ${rules.leadDays} days ahead.`}
                    hint={`Monday to Saturday, ${firstStart} – ${lastEnd}. Book at least ${rules.leadDays} days ahead and before your event date.`}
                    hasError={!!errors.date}
                />
            </Field>

            <div className="flex min-w-0 flex-col gap-5">
                <Field label={slot.date ? `Time on ${formatLongDate(slot.date)}` : 'Time'} required error={errors.time}>
                    <div className={cx('grid gap-2', longSlots ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
                        {rules.slotTimes.map((t) => {
                            // Before a date is picked every slot shows, but none can be picked yet.
                            const taken = !!slot.date && !open.includes(t);
                            const free = !!slot.date && !taken;
                            const selected = slot.time === t;
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    disabled={!free}
                                    aria-pressed={selected}
                                    title={taken ? 'This slot is taken.' : !slot.date ? 'Pick a date first.' : undefined}
                                    onClick={() => setSlot({ ...slot, time: selected ? '' : t })}
                                    className={cx(
                                        'rounded-lg border px-2 py-2.5 text-sm font-semibold transition sm:py-2',
                                        selected
                                            ? 'border-gold bg-gold text-white'
                                            : free
                                              ? 'border-black/15 bg-white text-ink hover:border-gold'
                                              : taken
                                                ? 'cursor-not-allowed border-black/5 bg-black/5 text-ink-soft/60 line-through'
                                                : 'cursor-not-allowed border-black/10 bg-white text-ink-soft/70',
                                    )}
                                >
                                    {formatTime(t)}
                                    {longSlots && <> – {formatTime(addMinutes(t, rules.slotMinutes))}</>}
                                </button>
                            );
                        })}
                    </div>
                    <span className="text-xs text-ink-soft">
                        {slot.date ? '' : 'Pick a date to see which times are free. '}Each {noun} takes about {durationText(rules.slotMinutes)}.
                        {slot.date && ' Crossed-out times are already taken.'}
                    </span>
                </Field>

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
                                        // Switching to online forgets the place.
                                        onClick={() => setSlot({ ...slot, meetingMode: m.value, meetingPlace: m.value === 'online' ? '' : slot.meetingPlace })}
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

                {faceToFace && (
                    <Field label="Where should we meet?" htmlFor={`${noun}-place`} required error={errors.meetingPlace}>
                        {officeAddress && (
                            // A radio look, but clicking it again unselects it.
                            <button
                                type="button"
                                role="radio"
                                aria-checked={atOffice}
                                onClick={() => setSlot({ ...slot, meetingPlace: atOffice ? '' : officeAddress })}
                                className={cx(
                                    'flex h-10 w-full min-w-0 items-center gap-3 rounded-lg border px-3 text-left transition',
                                    atOffice ? 'border-gold bg-gold/10' : 'border-black/15 bg-white hover:border-gold',
                                )}
                            >
                                <span
                                    className={cx(
                                        'flex size-4 shrink-0 items-center justify-center rounded-full border-2',
                                        atOffice ? 'border-gold-dark' : 'border-black/30',
                                    )}
                                >
                                    {atOffice && <span className="size-2 rounded-full bg-gold-dark" />}
                                </span>
                                <span className="min-w-0 truncate text-sm">
                                    <span className="font-bold text-ink">GR3AT A&apos;s office</span>
                                    <span className="text-ink-soft"> · {officeAddress.replace(/^GR3AT A's office, /, '')}</span>
                                </span>
                            </button>
                        )}
                        <input
                            id={`${noun}-place`}
                            className={inputClass}
                            disabled={atOffice}
                            maxLength={placeMax}
                            placeholder={
                                atOffice
                                    ? 'Unselect the office to type another place'
                                    : officeAddress
                                      ? 'Or another place, e.g. Café Lorenzo, SM Fairview, Quezon City'
                                      : 'Café Lorenzo, SM Fairview, Quezon City'
                            }
                            value={atOffice ? '' : slot.meetingPlace}
                            onChange={(e) => setSlot({ ...slot, meetingPlace: e.target.value })}
                        />
                        <span className="text-[11px] text-ink-soft">For another place, like a restaurant or a cafe, include the address.</span>
                    </Field>
                )}

                {footer && <div className="mt-auto flex flex-col pt-1 sm:flex-row sm:justify-end">{footer}</div>}
            </div>
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
                    <Icon className="size-4 shrink-0" />{' '}
                    {place ?? (schedule.meetingPlace ? `${meetingModeLabel(schedule.meetingMode)} · ${schedule.meetingPlace}` : meetingModeLabel(schedule.meetingMode))}
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
