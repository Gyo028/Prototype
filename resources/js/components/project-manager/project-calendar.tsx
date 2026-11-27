import { router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { OutlineButton, PageHeader, Panel, cx } from '@/components/dashboard/ui';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';

/*
 * Adviser revision G1 (Nov 27): the Calendar page.
 * A month view of the event date of every approved service request (= every project);
 * cancelled projects are not sent. Clicking an event opens the project page.
 * Claude's choices: a custom request with a start and end date shows on every day in between;
 * each event is coloured by the project's current step.
 */

export type CalendarEvent = {
    id: number;
    code: string; // PRJ number
    title: string; // event type (standard) or the typed title (custom)
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    statusName: string; // Consultation, Ocular Visit, Design, Contract, Fabrication, Installation, Completed
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Colours per step (same idea as the status pills). */
const STEP_COLOURS: Record<string, string> = {
    Consultation: 'bg-neutral-100 text-neutral-800 border-neutral-300',
    'Ocular Visit': 'bg-sky-100 text-sky-900 border-sky-300',
    Design: 'bg-purple-100 text-purple-900 border-purple-300',
    Contract: 'bg-amber-50 text-amber-900 border-amber-300',
    Fabrication: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    Installation: 'bg-orange-100 text-orange-900 border-orange-300',
    Completed: 'bg-green-100 text-green-900 border-green-300',
};

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function ProjectCalendar({ events }: { events: CalendarEvent[] }) {
    const today = new Date();
    const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

    // 6 rows × 7 days, starting on the Sunday on or before the 1st.
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const days = Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
    });

    const eventsOn = (day: string) => events.filter((e) => e.startDate <= day && day <= e.endDate);
    const thisMonth = events.filter((e) => {
        const from = ymd(first);
        const to = ymd(new Date(month.getFullYear(), month.getMonth() + 1, 0));
        return e.startDate <= to && e.endDate >= from;
    }).length;

    const move = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));
    const todayYmd = ymd(today);

    return (
        <>
            <PageHeader title="Calendar" description="The event dates of all approved projects. Click an event to open its project." />

            <Panel className="p-4 sm:p-6">
                {/* Month navigation */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-ink">{month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</h2>
                        <p className="text-xs text-ink-soft">
                            {thisMonth} {thisMonth === 1 ? 'event' : 'events'} this month
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <OutlineButton onClick={() => move(-1)} aria-label="Previous month">
                            <ChevronLeft className="size-4" />
                        </OutlineButton>
                        <OutlineButton onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</OutlineButton>
                        <OutlineButton onClick={() => move(1)} aria-label="Next month">
                            <ChevronRight className="size-4" />
                        </OutlineButton>
                    </div>
                </div>

                {/* Month grid; scrolls sideways on small screens */}
                <div className="overflow-x-auto">
                    <div className="grid min-w-[700px] grid-cols-7 overflow-hidden rounded-xl border border-black/10">
                        {WEEKDAYS.map((w) => (
                            <div key={w} className="border-b border-black/10 bg-black/5 px-2 py-2 text-center text-xs font-bold tracking-wide text-ink-soft uppercase">
                                {w}
                            </div>
                        ))}

                        {days.map((d) => {
                            const day = ymd(d);
                            const inMonth = d.getMonth() === month.getMonth();
                            const list = eventsOn(day);

                            return (
                                <div key={day} className={cx('min-h-28 border-r border-b border-black/10 p-1.5 [&:nth-child(7n)]:border-r-0', !inMonth && 'bg-black/[0.02]')}>
                                    <p
                                        className={cx(
                                            'mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                                            day === todayYmd ? 'bg-gold text-white' : inMonth ? 'text-ink' : 'text-ink-soft/50',
                                        )}
                                    >
                                        {d.getDate()}
                                    </p>
                                    <div className="grid gap-1">
                                        {list.map((e) => (
                                            <button
                                                key={e.id}
                                                type="button"
                                                onClick={() => router.visit(`${PROJECTS_URL}/${e.id}`)}
                                                title={`${e.code} · ${e.title} · ${e.statusName}`}
                                                className={cx(
                                                    'truncate rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight font-semibold transition hover:brightness-95',
                                                    STEP_COLOURS[e.statusName] ?? STEP_COLOURS.Consultation,
                                                )}
                                            >
                                                {e.code} · {e.title}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {Object.entries(STEP_COLOURS).map(([name, colour]) => (
                        <span key={name} className={cx('rounded-md border px-2 py-0.5 font-semibold', colour)}>
                            {name}
                        </span>
                    ))}
                </div>
            </Panel>
        </>
    );
}