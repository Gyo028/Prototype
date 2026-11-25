import { Link } from '@inertiajs/react';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, FilePlus, Info, Sparkles, UserRound } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { formatDate, formatTime, fromISO } from '@/components/customer/project-types';
import { cx } from '@/components/dashboard/ui';

/*
 * Customer > Dashboard, across all of the customer's projects:
 *
 *   Welcome
 *   Event countdown           the next event, with where the project is
 *   Action needed | Upcoming  what waits on the customer (3 a page) |
 *                             the next 3 consultations and ocular visits
 *
 * A new customer (no requests yet) sees "Start your first project" and how it
 * works instead. Phones: one column in the same order.
 */

export type DashboardStep = { label: string; state: 'done' | 'current' | 'locked' | 'skipped' | 'cancelled' };

export type DashboardData = {
    profileMissing: boolean;
    firstName: string | null;
    hasRequests: boolean;
    countdown: {
        code: string;
        title: string;
        url: string;
        date: string;
        endDate: string;
        startTime: string;
        endTime: string;
        venue: string;
        daysLeft: number;
        steps: DashboardStep[];
        currentStep: string;
        currentNumber: number;
        onHold: boolean;
    } | null;
    actions: {
        projectCode: string;
        projectTitle: string;
        title: string;
        /** Amount and due date for a payment, else a short hint. */
        note: string;
        button: string;
        payment: boolean;
        url: string;
    }[];
    pending: { code: string; title: string; submittedOn: string; url: string }[];
    upcoming: {
        id: number;
        type: 'consultation' | 'ocular_visit';
        date: string;
        startTime: string;
        endTime: string;
        where: string;
        pending: boolean;
        code: string;
        title: string;
        url: string;
    }[];
};

const card = 'rounded-2xl border border-black/10 bg-white shadow-sm';
const goldLink = 'inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-white transition hover:bg-gold-dark';
const outlineLink = 'inline-flex items-center justify-center gap-2 rounded-lg border border-gold bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-gold/10';

export default function CustomerDashboard(props: DashboardData) {
    const name = props.firstName ? `, ${props.firstName}` : '';

    if (!props.hasRequests) {
        return <NewCustomer name={name} profileMissing={props.profileMissing} />;
    }

    return (
        <div className="space-y-5 md:space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-ink md:text-3xl">Welcome back{name}</h1>
                <p className="mt-1 text-sm text-ink-soft md:text-base">Here&apos;s what&apos;s happening with your projects.</p>
            </header>

            {props.countdown && <Countdown event={props.countdown} />}

            {/*
              Same height side by side; rows keep their own height, spare space stays at the bottom.
              grid-cols-1 (minmax(0, 1fr)) on phones: without it the column grows to fit the longest
              single-line text (the truncated project names) and pushes the cards past the screen.
            */}
            <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <ActionNeeded actions={props.actions} pending={props.pending} />
                <Upcoming items={props.upcoming} />
            </div>
        </div>
    );
}

/* ---------------- New customer ---------------- */

const HOW_IT_WORKS = [
    ['Send a service request', 'Your event details, budget and, for standard events, a layout of the decor you like.'],
    ['Consultation', 'Book a 1-hour meeting with our Project Manager, online or face to face.'],
    ['Ocular visit', 'Pay the reservation fee, then we visit the venue to check the space.'],
    ['Design', 'Review the design and quotation. Approve it or ask for changes.'],
    ['Contract', 'Sign the contract online and pay the down payment.'],
    ['Fabrication and installation', 'We build your decor and set it up at the venue, with photos when each is done.'],
    ['Your event', 'Enjoy the day, then tell us how we did.'],
] as const;

function NewCustomer({ name, profileMissing }: { name: string; profileMissing: boolean }) {
    return (
        <div className="space-y-5 md:space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-ink md:text-3xl">Welcome{name}</h1>
                <p className="mt-1 text-sm text-ink-soft md:text-base">Thanks for joining GR3AT A&apos;s. Here&apos;s how we&apos;ll style your event together.</p>
            </header>

            {profileMissing && (
                <p className="flex items-start gap-2 rounded-xl border border-gold/40 bg-cream px-4 py-3 text-sm text-ink">
                    <Info className="mt-0.5 size-4 shrink-0 text-gold-dark" />
                    <span>
                        Your email is verified. Add your contact number in{' '}
                        <Link href="/customer/profile" className="font-bold text-gold-dark underline">
                            My Profile
                        </Link>{' '}
                        to start sending service requests.
                    </span>
                </p>
            )}

            <section className="flex flex-col gap-4 rounded-2xl border border-gold-light bg-cream p-5 md:flex-row md:items-center md:gap-6 md:p-7">
                <div aria-hidden className="hidden size-24 shrink-0 items-center justify-center rounded-2xl border border-gold-light bg-white text-gold-dark md:flex">
                    <Sparkles className="size-10" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold text-ink md:text-2xl">Start your first project</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink md:text-[15px]">
                        Tell us about your event: the date, venue and budget. You can also pick a design theme and arrange its decor in our layout tool to see an
                        estimate. Our Project Manager reviews your request and contacts you to set up a consultation.
                    </p>
                </div>
                {profileMissing ? (
                    <Link href="/customer/profile" className={cx(goldLink, 'min-h-11 shrink-0 px-5 md:min-h-0 md:py-3')}>
                        <UserRound className="size-4" /> Complete My Profile
                    </Link>
                ) : (
                    <Link href="/customer/new-request" className={cx(goldLink, 'min-h-11 shrink-0 px-5 md:min-h-0 md:py-3')}>
                        <FilePlus className="size-4" /> New Service Request
                    </Link>
                )}
            </section>

            <section className={card} aria-labelledby="how-it-works">
                <div className="border-b border-black/10 px-5 py-4">
                    <h2 id="how-it-works" className="text-lg font-bold text-ink">
                        How it works
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-soft">Every project follows the same steps. You&apos;ll see where you are on each project&apos;s page.</p>
                </div>
                <ol className="grid gap-x-8 gap-y-5 p-5 md:grid-cols-2">
                    {HOW_IT_WORKS.map(([title, text], i) => (
                        <li key={title} className="flex items-start gap-3.5">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cream text-sm font-bold text-gold-dark">{i + 1}</span>
                            <span className="min-w-0">
                                <span className="block font-bold text-ink">{title}</span>
                                <span className="mt-0.5 block text-sm leading-relaxed text-ink-soft">{text}</span>
                            </span>
                        </li>
                    ))}
                </ol>
            </section>
        </div>
    );
}

/* ---------------- Event countdown ---------------- */

function Countdown({ event }: { event: NonNullable<DashboardData['countdown']> }) {
    const d = fromISO(event.date);
    const days = event.daysLeft;
    const headline = days === 0 ? `Your ${event.title} is today` : days === 1 ? `Your ${event.title} is tomorrow` : `Your ${event.title} is in ${days} days`;
    const longDate = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const multiDay = event.endDate !== event.date;

    return (
        <section aria-label="Your next event" className="flex flex-col gap-4 rounded-2xl border border-gold-light bg-cream p-5 md:flex-row md:items-center md:gap-6 md:p-6">
            <div
                aria-hidden
                className="flex shrink-0 items-center gap-2 md:size-28 md:flex-col md:justify-center md:gap-0 md:rounded-2xl md:border md:border-gold-light md:bg-white"
            >
                <span className="text-sm font-extrabold tracking-wide text-gold-dark uppercase">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                <span className="text-2xl font-extrabold text-ink md:text-4xl md:leading-tight">{d.getDate()}</span>
                <span className="text-sm font-bold text-gold-dark">{d.toLocaleDateString('en-US', { weekday: 'long' })}</span>
            </div>

            <div className="min-w-0 flex-1">
                <p className="text-xs font-bold tracking-wide text-gold-dark uppercase">Your next event</p>
                <h2 className="mt-1 text-xl font-bold text-ink md:text-2xl">{headline}</h2>
                <p className="mt-1 text-sm text-ink">
                    {multiDay ? `${formatDate(event.date)} – ${formatDate(event.endDate)}` : `${longDate} · ${formatTime(event.startTime)} – ${formatTime(event.endTime)}`}
                    {event.venue && ` · ${event.venue}`}
                </p>

                <div className="mt-3 max-w-md">
                    <div className="flex gap-1" aria-hidden>
                        {event.steps.map((s) => (
                            <span
                                key={s.label}
                                className={cx(
                                    'h-1.5 flex-1 rounded-full',
                                    (s.state === 'done' || s.state === 'skipped') && 'bg-gold',
                                    s.state === 'current' && 'bg-ink',
                                    s.state === 'locked' && 'border border-gold-light bg-white',
                                    s.state === 'cancelled' && 'bg-red-400',
                                )}
                            />
                        ))}
                    </div>
                    <p className="mt-1.5 text-xs text-ink">
                        {event.code} · Now at {event.currentStep} (step {event.currentNumber} of {event.steps.length})
                        {event.onHold && ' · On hold'}
                    </p>
                </div>
            </div>

            <Link href={event.url} className={cx(outlineLink, 'min-h-11 shrink-0 md:min-h-0')}>
                Open project <ChevronRight className="size-4" />
            </Link>
        </section>
    );
}

/* ---------------- Action needed ---------------- */

function SectionHead({ id, title, count, aside }: { id: string; title: string; count?: number; aside?: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-5 py-4">
            <h2 id={id} className="flex items-center gap-2.5 text-lg font-bold text-ink">
                {title}
                {count !== undefined && count > 0 && <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-extrabold text-white">{count}</span>}
            </h2>
            {aside}
        </div>
    );
}

function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-5 py-8 text-center">
            <span className="text-gold-dark">{icon}</span>
            <p className="font-bold text-ink">{title}</p>
            {children && <div className="text-sm text-ink-soft">{children}</div>}
        </div>
    );
}

const PER_PAGE = 3;

function ActionNeeded({ actions, pending }: { actions: DashboardData['actions']; pending: DashboardData['pending'] }) {
    const [page, setPage] = useState(1);
    const pages = Math.max(1, Math.ceil(actions.length / PER_PAGE));
    const current = Math.min(page, pages);
    const shown = actions.slice((current - 1) * PER_PAGE, current * PER_PAGE);

    return (
        <section className={cx(card, 'flex min-w-0 flex-col')} aria-labelledby="action-needed">
            <SectionHead id="action-needed" title="Action needed" count={actions.length} />

            {actions.length > 0 ? (
                <>
                    <ul className="divide-y divide-black/10">
                        {shown.map((a) => (
                            <li key={`${a.projectCode}-${a.title}`} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                                {/* Icon beside the details on every screen; the button goes below on phones. */}
                                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                                    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cream font-bold text-gold-dark">
                                        {a.payment ? '₱' : <ClipboardCheck className="size-5" />}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="font-bold text-ink">{a.title}</p>
                                        <p className="mt-0.5 text-xs font-semibold text-ink-soft">
                                            {a.projectCode} · {a.projectTitle}
                                        </p>
                                        <p className="mt-0.5 text-sm text-ink">{a.note}</p>
                                    </div>
                                </div>
                                <Link href={a.url} className={cx(a.payment ? goldLink : outlineLink, 'min-h-11 shrink-0 sm:min-h-0')}>
                                    {a.button}
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {pages > 1 && (
                        <div className="mt-auto flex items-center justify-center gap-3 border-t border-black/10 px-5 py-3">
                            <button
                                type="button"
                                aria-label="Previous page"
                                disabled={current === 1}
                                onClick={() => setPage(current - 1)}
                                className="flex size-9 items-center justify-center rounded-lg border border-black/15 bg-white disabled:opacity-35"
                            >
                                <ChevronLeft className="size-4" />
                            </button>
                            <span className="text-sm font-bold text-ink" aria-live="polite">
                                {current} / {pages}
                            </span>
                            <button
                                type="button"
                                aria-label="Next page"
                                disabled={current === pages}
                                onClick={() => setPage(current + 1)}
                                className="flex size-9 items-center justify-center rounded-lg border border-black/15 bg-white disabled:opacity-35"
                            >
                                <ChevronRight className="size-4" />
                            </button>
                        </div>
                    )}
                </>
            ) : pending.length > 0 ? (
                <Empty icon={<ClipboardCheck className="size-7" />} title={pending.length === 1 ? 'Your request is being reviewed' : 'Your requests are being reviewed'}>
                    {pending.map((r) => (
                        <p key={r.code}>
                            <Link href={r.url} className="font-semibold text-gold-dark hover:underline">
                                {r.code} · {r.title}
                            </Link>
                            , sent {formatDate(r.submittedOn)}
                        </p>
                    ))}
                    <p className="mt-1">We&apos;ll contact you to schedule your consultation.</p>
                </Empty>
            ) : (
                <Empty icon={<ClipboardCheck className="size-7" />} title="You're all caught up">
                    Nothing needs you right now. We&apos;ll show it here when something does.
                </Empty>
            )}
        </section>
    );
}

/* ---------------- Upcoming ---------------- */

const UPCOMING_LABEL: Record<DashboardData['upcoming'][number]['type'], string> = {
    consultation: 'Consultation',
    ocular_visit: 'Ocular visit',
};

function Upcoming({ items }: { items: DashboardData['upcoming'] }) {
    return (
        <section className={cx(card, 'flex min-w-0 flex-col')} aria-labelledby="upcoming">
            <SectionHead id="upcoming" title="Upcoming" aside={<span className="text-sm text-ink-soft">Next 30 days</span>} />

            {items.length > 0 ? (
                <ul className="divide-y divide-black/10">
                    {items.map((u) => {
                        const d = fromISO(u.date);
                        return (
                            <li key={u.id}>
                                <Link href={u.url} className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-gold/5">
                                    <span className="w-12 shrink-0 rounded-xl border border-black/15 py-1 text-center">
                                        <span className="block text-[11px] font-bold text-gold-dark uppercase">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                                        <span className="block text-lg leading-tight font-extrabold text-ink">{d.getDate()}</span>
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-bold text-ink">
                                            {UPCOMING_LABEL[u.type]}
                                            {u.pending && <span className="ml-2 text-xs font-semibold text-gold-dark">Pending</span>}
                                        </span>
                                        <span className="mt-0.5 block text-xs text-ink-soft">
                                            {d.toLocaleDateString('en-US', { weekday: 'short' })} · {formatTime(u.startTime)} – {formatTime(u.endTime)} · {u.where}
                                        </span>
                                        <span className="block truncate text-xs text-ink-soft">
                                            {u.code} · {u.title}
                                        </span>
                                    </span>
                                    <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-soft" />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <Empty icon={<CalendarDays className="size-7" />} title="Nothing scheduled in the next 30 days">
                    Your consultations and ocular visits show here.
                </Empty>
            )}
        </section>
    );
}
