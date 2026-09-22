import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cx } from '@/components/dashboard/ui';

/*
 * An inline calendar, shown directly in the form (no dropdown, no native
 * <input type="date">, no external library). The grid is drawn as a true
 * lattice of ruled cells — like a tic-tac-toe board — rather than spaced-out
 * floating buttons: the weekday header and every day share one continuous
 * set of grid lines.
 *
 * Three kinds of days are not selectable, each shown differently so they
 * read at a glance:
 *  - Past dates and dates within the required lead time (1 month from
 *    today, since the business needs at least that much notice) — gray,
 *    struck through
 *  - Booked dates, where the business has no open slot — red, struck
 *    through, so they stand out from an ordinary "too soon" date
 *
 * Booked dates are placeholder data until the backend can report real
 * availability from `project_schedules` / `service_requests`.
 */

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

// Placeholder: dates the business already has fully booked. Replace with a
// real availability check once the backend can report it.
const today0 = startOfDay(new Date());
export const sampleBookedDates: string[] = [35, 42, 47, 55, 63, 80].map((offset) => {
    const d = new Date(today0);
    d.setDate(d.getDate() + offset);
    return toISO(d);
});

type Props = {
    id?: string;
    value: string; // ISO yyyy-mm-dd, or ''
    onChange: (iso: string) => void;
    /** Earliest selectable date (ISO). Defaults to one month from today. */
    minDate?: string;
    /** Exact dates that cannot be selected (ISO), e.g. already booked. */
    disabledDates?: string[];
    hasError?: boolean;
    className?: string;
};

// 7 columns × 7 rows: 1 header row of weekday labels + 6 rows of days.
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

export default function DatePicker({ id, value, onChange, minDate, disabledDates = sampleBookedDates, hasError, className }: Props) {
    const min = startOfDay(minDate ? fromISO(minDate) : addMonths(today0, 1));
    const disabledSet = new Set(disabledDates);

    const [viewMonth, setViewMonth] = useState(() => (value ? fromISO(value) : min));

    const isDisabled = (d: Date) => startOfDay(d) < min || disabledSet.has(toISO(d));
    const pick = (d: Date) => {
        if (isDisabled(d)) return;
        onChange(toISO(d));
    };

    // Build a 6-row grid starting on Sunday
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
                    {value ? formatDisplay(value) : 'No date selected yet'}
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
                    const row = 1 + Math.floor(i / COLS); // row 0 is the weekday header
                    const outside = !sameMonth(d, viewMonth);
                    const iso = toISO(d);
                    const booked = disabledSet.has(iso) && startOfDay(d) >= min;
                    const tooSoon = !booked && startOfDay(d) < min;
                    const disabled = booked || tooSoon;
                    const selected = value === iso;
                    const isToday = iso === toISO(today0);

                    return (
                        <GridCell
                            key={d.toISOString()}
                            col={col}
                            row={row}
                            disabled={disabled}
                            title={booked ? 'Fully booked' : tooSoon ? 'Too soon to book' : undefined}
                            onClick={() => pick(d)}
                            className={cx(
                                'font-medium transition',
                                outside && 'bg-neutral-50 text-ink-soft/50',
                                !outside && !disabled && !selected && 'text-ink hover:bg-gold/15',
                                !outside && tooSoon && 'cursor-not-allowed bg-neutral-50 text-ink-soft line-through decoration-ink-soft/70',
                                !outside && booked && 'cursor-not-allowed bg-red-50 text-red-500 line-through decoration-red-400',
                                selected && 'bg-gold font-bold text-white hover:bg-gold-dark',
                                isToday && !selected && 'bg-gold/10 font-bold text-gold-dark',
                            )}
                        >
                            {d.getDate()}
                        </GridCell>
                    );
                })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-ink-soft">
                <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-full border border-gold/60 bg-gold/10" /> Today
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-full bg-neutral-200" /> Too soon / past
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-full bg-red-200" /> Booked
                </span>
            </div>
            <p className="mt-1.5 text-[10px] text-ink-soft">
                Requests need at least 1 month of lead time, so dates before {min.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} are not
                selectable.
            </p>
        </div>
    );
}
