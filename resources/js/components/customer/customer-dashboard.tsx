import { Link } from '@inertiajs/react';
import { ArrowRight, Check, ImageIcon, Plus } from 'lucide-react';
import { Panel, Pill, cx } from '@/components/dashboard/ui';

/*
 * Customer dashboard (Figma "Customer Dashboard"): summary cards, actions that
 * need attention, project progress, billing summary, recent notifications and
 * the upcoming appointment. Appointments are scheduled from the project itself
 * (My Projects), so the dashboard only shows the next one.
 *
 * All data below is placeholder until the database is connected.
 */

/* ------------------------------------------------------------------ */
/* Placeholder data                                                   */
/* ------------------------------------------------------------------ */

const STAGES = ['Booking', 'Design', 'Fabrication', 'Setup', 'Completed'];

type Project = {
    id: number;
    name: string;
    eventDate: string; // ISO date
    venue?: string;
    type: string;
    theme: string;
    /** Index of the stage in progress: earlier stages are done, later ones are not started */
    stage: number;
    status: string;
};

const projects: Project[] = [
    { id: 1, name: 'Santos Wedding', eventDate: '2026-11-14', venue: 'Grand Palace Events Hall', type: 'Wedding', theme: 'Rustic Garden', stage: 2, status: 'In Progress' },
    { id: 2, name: 'Mary Birthday Styling', eventDate: '2026-11-28', type: 'Birthday Party', theme: 'Pastel Balloons', stage: 1, status: 'In Progress' },
];

const actions = [
    { id: 1, title: 'Design Approval Needed', detail: 'Santos Wedding backdrop proposal v2', button: 'Review Design', href: '/customer/projects' },
    { id: 2, title: 'Final Billing Due', detail: '₱60,000 due on Nov 13, 2026', button: 'Pay Now', href: '/customer/billing' },
];

const payment = { total: 85000, paid: 25000 };

const notifications = [
    { id: 1, title: 'Design proposal ready for review', detail: 'Santos Wedding backdrop proposal v2', time: 'Today, 9:14 AM', dot: 'bg-gold' },
    { id: 2, title: 'Payment Reminder', detail: '₱60,000 final billing is due on Nov 13, 2026', time: 'Yesterday, 3:15 PM', dot: 'bg-red-300' },
    { id: 3, title: 'Ocular visit confirmed', detail: 'Santos Wedding, Oct 5, 2026 at 10:00 AM', time: '2 days ago', dot: 'bg-teal-300' },
];

const appointment = { title: 'Ocular Visit: Santos Wedding', when: 'Oct 5, 2026 — 10:00 AM', booked: 'Booked Sep 19, 2026' };

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;
const formatDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function ProgressTracker({ stage }: { stage: number }) {
    return (
        <ol className="flex items-start" aria-label="Project progress">
            {STAGES.map((label, i) => {
                const done = i < stage;
                const current = i === stage;
                return (
                    <li key={label} className="relative flex flex-1 flex-col items-center">
                        {/* connector to the previous step */}
                        {i > 0 && (
                            <span
                                className={cx(
                                    'absolute top-3 right-1/2 h-0.5 w-full -translate-y-1/2',
                                    i <= stage ? 'bg-gold' : 'bg-neutral-300',
                                )}
                            />
                        )}
                        <span
                            className={cx(
                                'relative z-10 flex size-6 items-center justify-center rounded-full text-white',
                                done && 'bg-gold',
                                current && 'bg-ink',
                                !done && !current && 'bg-neutral-300',
                            )}
                        >
                            {(done || current) && <Check className="size-3.5" strokeWidth={3} />}
                        </span>
                        <span className="mt-1.5 text-[10px] text-ink-soft">{label}</span>
                    </li>
                );
            })}
        </ol>
    );
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function CustomerDashboard() {
    const nextEvent = [...projects].sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];
    const outstanding = payment.total - payment.paid;

    return (
        <div className="space-y-5">
            {/* Summary cards + Start Project */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="grid flex-1 gap-4 sm:grid-cols-3">
                    <Panel className="p-5">
                        <p className="text-sm text-ink">Active Projects</p>
                        <p className="mt-1 text-2xl font-bold text-gold-dark">{projects.length}</p>
                    </Panel>
                    <Panel className="p-5">
                        <p className="text-sm text-ink">Next Event</p>
                        <p className="mt-1 text-xl font-bold text-gold-dark">
                            {nextEvent ? formatDate(nextEvent.eventDate) : '—'}
                        </p>
                    </Panel>
                    <Panel className="p-5">
                        <p className="text-sm text-ink">Outstanding Balance</p>
                        <p className="mt-1 text-xl font-bold text-gold-dark">{peso(outstanding)}</p>
                    </Panel>
                </div>

                <Link
                    href="/customer/new-request"
                    className="inline-flex items-center gap-1.5 self-end rounded-md bg-gold px-4 py-2 text-sm font-bold text-white transition hover:bg-gold-dark"
                >
                    Start Project <Plus className="size-4" />
                </Link>
            </div>

            {/* My projects */}
            <Panel className="p-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-ink">My projects</h2>
                    <Link href="/customer/projects" className="inline-flex items-center gap-2 text-sm font-bold text-gold underline">
                        View all <ArrowRight className="size-4 no-underline" />
                    </Link>
                </div>

                {projects.length > 0 ? (
                    <ul className="mt-4 divide-y divide-black/10 border-t border-black/10">
                        {projects.map((p) => (
                            <li key={p.id} className="flex flex-col gap-4 py-5 md:flex-row md:items-center">
                                <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded bg-neutral-200 text-neutral-400">
                                    <ImageIcon className="size-8" />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-bold text-ink">{p.name}</p>
                                            <p className="text-sm text-ink">
                                                {[formatDate(p.eventDate), p.venue, p.type, p.theme].filter(Boolean).join(' — ')}
                                            </p>
                                        </div>
                                        <Pill tone="cream" className="shrink-0 rounded-sm">
                                            {p.status}
                                        </Pill>
                                    </div>
                                    <div className="mt-4">
                                        <ProgressTracker stage={p.stage} />
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-4 text-sm text-ink-soft">No projects yet. Use Start Project to submit your first request.</p>
                )}
            </Panel>

            {/* Bottom row */}
            <div className="grid gap-5 lg:grid-cols-3">
                {/* Payment summary */}
                <Panel className="flex flex-col p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="font-bold text-ink">Billing Summary</h2>
                        <Link href="/customer/billing" className="text-[11px] font-bold text-gold underline">
                            View details
                        </Link>
                    </div>
                    <dl className="mt-4 flex-1 divide-y divide-black/10 border-t border-black/10 text-xs font-bold text-ink">
                        <div className="flex justify-between py-2.5">
                            <dt>Total Amount</dt>
                            <dd>{peso(payment.total)}</dd>
                        </div>
                        <div className="flex justify-between py-2.5">
                            <dt>Total Paid</dt>
                            <dd>{peso(payment.paid)}</dd>
                        </div>
                        <div className="flex justify-between py-2.5">
                            <dt>Outstanding Balance</dt>
                            <dd>{peso(outstanding)}</dd>
                        </div>
                    </dl>
                    <Link
                        href="/customer/billing"
                        className="mt-5 block rounded-md bg-gold py-2.5 text-center text-sm font-bold text-white transition hover:bg-gold-dark"
                    >
                        Pay Now
                    </Link>
                </Panel>

                {/* Recent notifications */}
                <Panel className="p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="font-bold text-ink">Recent Notifications</h2>
                        <Link href="/customer/notifications" className="text-[11px] font-bold text-gold underline">
                            View all
                        </Link>
                    </div>
                    <ul className="mt-4 space-y-4">
                        {notifications.map((n) => (
                            <li key={n.id} className="flex items-start gap-3">
                                <span className={cx('mt-1.5 size-3 shrink-0 rounded-full', n.dot)} />
                                <div>
                                    <p className="text-sm font-bold text-ink">{n.title}</p>
                                    <p className="text-[11px] text-ink-soft">{n.detail}</p>
                                    <p className="text-[11px] text-ink-soft">{n.time}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Panel>

                {/* My appointment */}
                <Panel className="self-start p-6">
                    <h2 className="font-bold text-ink">Upcoming Appointment</h2>
                    <div className="mt-4 border-t border-black/10 pt-4">
                        <p className="text-sm font-bold text-ink">{appointment.title}</p>
                        <p className="mt-1 text-[11px] text-ink-soft">{appointment.when}</p>
                        <p className="text-[11px] text-ink-soft">{appointment.booked}</p>
                    </div>
                    <Link
                        href="/customer/projects"
                        className="mt-5 block rounded-lg border border-gold bg-white py-1.5 text-center text-xs font-bold text-ink transition hover:bg-gold/10"
                    >
                        View project
                    </Link>
                </Panel>
            </div>
        </div>
    );
}
