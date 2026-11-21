import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cx } from '@/components/dashboard/ui';



const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_LABELS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromISO = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
};
const startOfDay = (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
};
const addMonths = (d: Date, n: number) => {
    const c = new Date(d);
    c.setMonth(c.getMonth() + n);
    return c;
};
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const formatDisplay = (iso: string) => fromISO(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const formatShort = (iso: string) => fromISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const daysBetween = (a: string, b: string) => Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
const addDays = (iso: string, n: number) => {
    const c = fromISO(iso);
    c.setDate(c.getDate() + n);
    return toISO(c);
};

/** "Dec 10 – Dec 14, 2026 (5 days)" */
export const formatRange = (start: string, end: string) => {
    const days = daysBetween(start, end) + 1;
    return `${formatShort(start)} – ${formatShort(end)}, ${fromISO(end).getFullYear()} (${days} days)`;
};

//sample dates
const today0 = startOfDay(new Date());
export const sampleBookedDates: string[] = [35, 42, 47, 55, 63, 80].map((offset) => {
    const d = new Date(today0);
    d.setDate(d.getDate() + offset);
    return toISO(d);
});

type Props = {
    id?: string;
    value: string;
    /** Single date (default) or a range picked in the same calendar. */
    mode?: 'single' | 'range';
    /** Range mode: the last day, or '' while it is still to be picked. */
    endValue?: string;
    /** Range mode: called with the first day and the last day ('' until the last day is picked). */
    onRangeChange?: (start: string, end: string) => void;
    /** Range mode: the run must be at least / at most this many days (counting both ends). */
    minDays?: number;
    maxDays?: number;
    /** Replaces the small note under the calendar (the default one talks about the booking lead time). */
    hint?: string;
    onChange: (iso: string) => void;
    minDate?: string;
    /** How many months ahead a request must be; sets the earliest day when minDate is not given, and the tooltip text. */
    leadMonths?: number;
    disabledDates?: string[];
    /** Days that can't be picked for other reasons, shown grey with this reason as the tooltip (e.g. Sundays, fully booked days). */
    unavailableDates?: Record<string, string>;
    /** Replaces the "too soon" tooltip, which by default talks about the request lead time. */
    tooSoonText?: string;
    hasError?: boolean;
    className?: string;
};

// Range shading uses inline colours (gold #C9A013) so it never depends on generated opacity classes.
const RUN_BG = 'rgba(201, 160, 19, 0.22)';
const PREVIEW_END_BG = 'rgba(201, 160, 19, 0.45)';
// Booked days: a muted rose.
const BOOKED_BG = '#F6DADA';
const BOOKED_TEXT = '#9B3B3B';
// Every other day that can't be picked (past, too soon, outside the run, another month): grey.
const GREY_BG = '#EEEEEE';
const GREY_TEXT = '#A3A3A3';

const COLS = 7;
const TOTAL_ROWS = 7;

function GridCell({
    col,
    row,
    className,
    children,
    ...rest
}: {
    col: number;
    row: number;
    className?: string;
    children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            type="button"
            {...rest}
            className={cx(
                'flex aspect-square items-center justify-center text-sm',
                col < COLS - 1 && 'border-r',
                row < TOTAL_ROWS - 1 && 'border-b',
                'border-black/15',
                className,
            )}
        >
            {children}
        </button>
    );
}

export default function DatePicker({
    id,
    value,
    mode = 'single',
    endValue = '',
    onRangeChange,
    minDays = 2,
    maxDays,
    hint,
    onChange,
    minDate,
    leadMonths = 1,
    disabledDates = sampleBookedDates,
    unavailableDates,
    tooSoonText,
    hasError,
    className,
}: Props) {
    const isRange = mode === 'range';
    const [hover, setHover] = useState('');
    // Styled tooltip for days that can't be picked: the reason and the cell it points at.
    const [tip, setTip] = useState<{ text: string; col: number; row: number } | null>(null);
    // The last day is being picked once a first day is set and no last day is.
    const picking = isRange && !!value && !endValue;
    const firstEnd = picking ? addDays(value, minDays - 1) : '';
    const lastEnd = picking && maxDays ? addDays(value, maxDays - 1) : '';
    // While picking, the hovered day previews the run.
    const previewEnd = picking && hover && hover >= firstEnd && (!lastEnd || hover <= lastEnd) ? hover : '';

    const min = startOfDay(minDate ? fromISO(minDate) : addMonths(today0, leadMonths));
    const leadText = `${leadMonths} month${leadMonths === 1 ? '' : 's'}`;
    const disabledSet = new Set(disabledDates);

    const [viewMonth, setViewMonth] = useState(() => (value ? fromISO(value) : min));

    const isDisabled = (d: Date) => startOfDay(d) < min || disabledSet.has(toISO(d));
    const pick = (d: Date) => {
        if (isDisabled(d)) return;
        const iso = toISO(d);

        if (!isRange) {
            onChange(iso);
            return;
        }

        if (iso === endValue) {
            onRangeChange?.(value, ''); // clicking the last day again clears it; the first day stays
            return;
        }

        if (iso === value) {
            onRangeChange?.('', ''); // clicking the first day again clears the selection
            return;
        }

        if (picking && iso >= firstEnd && (!lastEnd || iso <= lastEnd)) {
            onRangeChange?.(value, iso); // second click: the last day
        } else if (!picking || iso < value) {
            onRangeChange?.(iso, ''); // first click, a restart, or an earlier day than the first
        }
        // Otherwise the day is out of the allowed run and the click is ignored.
    };

    const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    const days: Date[] = Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        return d;
    });

    const canGoPrev = firstOfMonth > new Date(min.getFullYear(), min.getMonth(), 1);

    return (
        <div id={id} className={cx('w-full rounded-xl border bg-white p-3', hasError ? 'border-red-400' : 'border-black/15', className)}>
            {/* Selected date readout */}
            <div className="mb-2 flex items-center gap-2 border-b border-black/10 pb-2">
                <CalendarDays className="size-4 shrink-0 text-gold-dark" />
                <span className={cx('text-sm', value ? 'font-bold text-ink' : 'text-ink-soft')}>
                    {isRange
                        ? value && endValue
                            ? formatRange(value, endValue)
                            : value
                              ? `${formatShort(value)} – pick the last day`
                              : 'Pick the first day'
                        : value
                          ? formatDisplay(value)
                          : 'No date selected yet'}
                </span>
            </div>

            <div className="mb-2 flex items-center justify-between">
                <button
                    type="button"
                    aria-label="Previous month"
                    disabled={!canGoPrev}
                    onClick={() => setViewMonth((m) => addMonths(m, -1))}
                    className="rounded p-1.5 hover:bg-black/5 disabled:opacity-30"
                >
                    <ChevronLeft className="size-4" />
                </button>
                <span className="text-sm font-bold text-ink">
                    {MONTH_LABELS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                </span>
                <button type="button" aria-label="Next month" onClick={() => setViewMonth((m) => addMonths(m, 1))} className="rounded p-1.5 hover:bg-black/5">
                    <ChevronRight className="size-4" />
                </button>
            </div>

            {/* One continuous ruled grid: the weekday row, then 6 rows of days — like a tic-tac-toe lattice */}
            <div className="relative" onMouseLeave={() => setTip(null)}>
                <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-black/15">
                    {DAY_LABELS.map((label, col) => (
                        <div
                            key={label}
                            className={cx(
                                'flex aspect-square items-center justify-center bg-neutral-100 text-[11px] font-bold text-ink-soft',
                                col < COLS - 1 && 'border-r border-black/15',
                                'border-b border-black/15',
                            )}
                        >
                            {label}
                        </div>
                    ))}

                    {days.map((d, i) => {
                        const col = i % COLS;
                        const row = 1 + Math.floor(i / COLS);
                        const outside = !sameMonth(d, viewMonth);
                        const iso = toISO(d);
                        const past = startOfDay(d) < today0;
                        const booked = !past && disabledSet.has(iso);
                        const tooSoon = !past && !booked && startOfDay(d) < min;
                        // While picking the last day, days before the earliest or after the latest allowed one are out.
                        const outOfRun = !past && !booked && !tooSoon && picking && iso > value && (iso < firstEnd || (!!lastEnd && iso > lastEnd));
                        const otherReason = !past && !booked && !tooSoon ? unavailableDates?.[iso] : undefined;
                        const unavailable = past || booked || tooSoon || outOfRun || !!otherReason;

                        // Why the day can't be picked, shown in the tooltip. Days of another month only say where to go.
                        const runText = maxDays ? `A project runs ${minDays} to ${maxDays} days.` : `A project runs at least ${minDays} days.`;
                        const reason = past
                            ? 'This date has passed.'
                            : outside
                              ? `Switch to ${MONTH_LABELS[d.getMonth()]} to pick this date.`
                              : booked
                                ? 'This date is already booked.'
                                : tooSoon
                                  ? (tooSoonText ?? `Requests need at least ${leadText}' notice.`)
                                  : otherReason
                                    ? otherReason
                                    : outOfRun
                                    ? runText
                                    : '';
                        const blocked = unavailable || outside;

                        const rangeEnd = isRange ? endValue || previewEnd : '';
                        const isStart = isRange ? value === iso : false;
                        const isEnd = isRange && !!rangeEnd && rangeEnd === iso;
                        const inRun = isRange && !!value && !!rangeEnd && iso > value && iso < rangeEnd;
                        // Picked days stay highlighted even when they show as edge days of another month.
                        const selected = isRange ? isStart || (isEnd && !!endValue) : value === iso;
                        const highlighted = selected || inRun || isEnd;
                        const isToday = iso === toISO(today0);

                        const background = selected
                            ? undefined
                            : isEnd
                              ? PREVIEW_END_BG
                              : inRun
                                ? RUN_BG
                                : booked && !outside
                                  ? BOOKED_BG
                                  : outside || unavailable
                                    ? GREY_BG
                                    : undefined;
                        const textColor = highlighted ? undefined : booked && !outside ? BOOKED_TEXT : outside || unavailable ? GREY_TEXT : undefined;

                        return (
                            <GridCell
                                key={d.toISOString()}
                                col={col}
                                row={row}
                                // Not the disabled attribute: disabled buttons swallow hover, and the reason must show on hover.
                                aria-disabled={blocked || undefined}
                                aria-label={reason ? `${formatDisplay(iso)}. ${reason}` : undefined}
                                tabIndex={blocked ? -1 : undefined}
                                onClick={() => !blocked && pick(d)}
                                onMouseEnter={() => {
                                    setTip(reason ? { text: reason, col, row } : null);
                                    if (picking) setHover(blocked ? '' : iso);
                                }}
                                onMouseLeave={() => picking && setHover('')}
                                aria-pressed={isRange ? isStart || isEnd || inRun : undefined}
                                style={background || textColor ? { backgroundColor: background, color: textColor } : undefined}
                                className={cx(
                                    'font-medium transition',
                                    outside && 'cursor-default',
                                    !outside && unavailable && 'cursor-not-allowed',
                                    !outside && !unavailable && !selected && 'text-ink hover:bg-gold/15',
                                    (inRun || (isEnd && !selected)) && 'font-bold text-ink',
                                    selected && 'bg-gold font-bold text-white hover:bg-gold-dark',
                                    !outside && isToday && !selected && !unavailable && !inRun && !isEnd && 'bg-gold/10 font-bold text-gold-dark',
                                )}
                            >
                                {d.getDate()}
                            </GridCell>
                        );
                    })}
                </div>

                {tip && (
                    <div
                        role="tooltip"
                        className="pointer-events-none absolute z-10 w-max rounded-md px-2.5 py-1.5 leading-snug font-medium text-white shadow-lg"
                        style={{
                            backgroundColor: '#2B2B2B',
                            maxWidth: '11rem',
                            fontSize: '11px',
                            top: `calc(${(tip.row / TOTAL_ROWS) * 100}% - 6px)`,
                            // Edge columns align to the cell's side so the bubble stays inside the calendar.
                            left: tip.col === 0 ? '0%' : tip.col === COLS - 1 ? 'auto' : `${((tip.col + 0.5) / COLS) * 100}%`,
                            right: tip.col === COLS - 1 ? '0%' : 'auto',
                            transform: tip.col === 0 || tip.col === COLS - 1 ? 'translateY(-100%)' : 'translate(-50%, -100%)',
                        }}
                    >
                        {tip.text}
                    </div>
                )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-ink-soft">
                <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-full border border-gold/60 bg-gold/10" /> Today
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: GREY_BG, border: `1px solid ${GREY_TEXT}` }} /> Not available
                </span>
                {disabledSet.size > 0 && (
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: BOOKED_BG, border: `1px solid ${BOOKED_TEXT}40` }} /> Booked
                    </span>
                )}
                {isRange && (
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: PREVIEW_END_BG }} /> Your dates
                    </span>
                )}
            </div>
            <p className="mt-1.5 text-[10px] text-ink-soft">
                {hint ??
                    `Requests need at least ${leadText} of lead time, so dates before ${min.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} are not selectable.`}
            </p>
        </div>
    );
}
