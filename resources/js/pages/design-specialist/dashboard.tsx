import { Head, Link } from '@inertiajs/react';
import DesignSpecialistLayout from '@/layouts/design-specialist-layout';

type ProjectStatus = 'new' | 'revision_pm' | 'revision_customer';

interface DashboardStats {
    activeAssignments: number;
    completed: number;
    revisionRequests: number;
    revisionsFromPm: number;
    revisionsFromCustomer: number;
    awaitingReview: number;
    toStart: number;
}

interface ActionItem {
    id: number;
    code: string;
    name: string;
    eventDate: string;
    dueDate: string;
    status: ProjectStatus;
    message: string | null;
}

interface UpcomingEvent {
    id: number;
    name: string;
    venue: string;
    eventDate: string;
}

interface ProjectUpdate {
    id: number;
    kind: 'revision' | 'assigned' | 'approved';
    text: string;
    createdAt: string;
}

interface DashboardProps {
    userName?: string;
    stats?: DashboardStats;
    actionItems?: ActionItem[];
    upcomingEvents?: UpcomingEvent[];
    recentUpdates?: ProjectUpdate[];
}

const EMPTY_STATS: DashboardStats = {
    activeAssignments: 0,
    completed: 0,
    revisionRequests: 0,
    revisionsFromPm: 0,
    revisionsFromCustomer: 0,
    awaitingReview: 0,
    toStart: 0,
};

const STATUS_BADGE: Record<ProjectStatus, string> = {
    new: 'bg-blue-100 text-blue-700',
    revision_pm: 'bg-orange-100 text-orange-700',
    revision_customer: 'bg-purple-100 text-purple-700',
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
    new: 'New assignment',
    revision_pm: 'Revision requested',
    revision_customer: 'Customer revision',
};

const UPDATE_DOT: Record<ProjectUpdate['kind'], string> = {
    revision: 'bg-orange-600',
    assigned: 'bg-blue-600',
    approved: 'bg-green-600',
};

const formatDate = (
    value: string,
    options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    },
) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'Date unavailable';

    return new Intl.DateTimeFormat('en-PH', options).format(date);
};

const daysUntil = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    return Math.ceil((date.getTime() - today.getTime()) / 86400000);
};

export default function Dashboard({
    userName = 'Design Specialist',
    stats = EMPTY_STATS,
    actionItems = [],
    upcomingEvents = [],
    recentUpdates = [],
}: DashboardProps) {
    const today = new Date();
    const dueThisWeek = actionItems.filter((item) => {
        const days = daysUntil(item.dueDate);
        return days !== null && days >= 0 && days <= 7;
    }).length;
    const revisions = actionItems.filter(
        (item) => item.status !== 'new',
    );
return (
    <DesignSpecialistLayout>
        <Head title="Design Specialist Dashboard" />
        <main className="flex flex-col gap-5">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
                <p className="text-xs text-neutral-500">
                    {formatDate(today.toISOString(), {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
})}
 </p>

<h1 className="mt-1 text-2xl font-bold text-ink"> Welcome back, {userName}
</h1>

<p className="mt-1 text-sm text-neutral-500"> Here's an overview of your design project.
</p>

</div>
</header>
<section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <StatCard
    label="Active assigned projects"
    value={stats.activeAssignments}
    description=""
    color="text-ink"
/>

<StatCard
    label="Open revision requests"
    value={stats.revisionRequests}
    description={`${stats.revisionsFromPm} from PM · ${stats.revisionsFromCustomer} from customer`}
    color="text-orange-700"
/>

<StatCard
    label="Proposals under review"
    value={stats.awaitingReview}
    description="Waiting for Revisions"
    color="text-ink"
/>

<StatCard
    label="Upcoming Deadlines"
    value={dueThisWeek}
    description="Upcoming project deadlines"
    color="text-purple-700"
/>
</section>

<section className="rounded-xl border border-neutral-200 bg-white p-4">
    <h2 className="mb-3 text-sm font-bold text-ink">
    Proposal workflow
</h2>

<div className="flex flex-wrap items-center gap-2">
    <WorkflowBadge
        label="New assignment"
        count={stats.toStart}
        color="bg-blue-50 text-blue-700"
/>

<span className="text-neutral-300">›</span>
    <WorkflowBadge
        label="In Review"
        count={stats.awaitingReview}
        color="bg-indigo-50 text-indigo-700"
/>

<span className="text-neutral-300">›</span>
<WorkflowBadge
    label="Revision requested"
    count={stats.revisionRequests}
    color="bg-orange-50 text-orange-700"
/>
<span className="text-neutral-300">›</span>
<WorkflowBadge
    label="Completed"
    count={stats.completed}
    color="bg-green-50 text-green-700"
/>
</div>
</section>

<div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
<div className="flex flex-col gap-4 xl:col-span-8">
<section className="rounded-xl border border-neutral-200 bg-white p-4">
<div className="mb-4 flex items-center justify-between">
<h2 className="text-base font-bold text-ink"> Revision requests
</h2>
 
<span className="text-xs text-neutral-500"> {revisions.length} requests
</span>
</div>
{revisions.length === 0 ? (
    <EmptyState text="No revision requests at the moment." />
    ) : (
<div className="flex flex-col gap-3">
    {revisions.map((item) => (
    <article key={item.id} className="rounded-lg border border-orange-100 bg-orange-50/50 p-4"
>
<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
<div className="min-w-0">
<div className="flex flex-wrap items-center gap-2">
<h3 className="text-sm font-bold text-ink">
    {item.name}
</h3>
<span className="text-[10px] text-neutral-500"> {item.code}
</span>
</div>
<span className="mt-2 inline-block rounded-full bg-orange-100 px-2 py-1 text-[10px] font-semibold text-orange-700">
{STATUS_LABEL[item.status]}
</span>
{item.message && (
<p className="mt-2 text-xs leading-relaxed text-neutral-600"> "{item.message}"
</p>
)}
<p className="mt-2 text-[10px] text-neutral-500"> Event date: {formatDate(item.eventDate)}
</p>
<p className="mt-1 text-[10px] text-neutral-500"> Due: {formatDate(item.dueDate)}
</p>
</div>
</div>
</article>
))}
</div>
)}
</section>
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
<h2 className="text-base font-bold text-ink">
    Assigned projects
</h2>
<span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600"> {actionItems.length} projects
</span>
</div>
{actionItems.length === 0 ? (
<EmptyState text="No assigned projects available." />
) : (
<div className="overflow-x-auto">
    <table className="w-full min-w-[650px] text-left">
<thead>
    <tr className="border-b border-neutral-100 bg-neutral-50 text-[11px] text-neutral-500">
        <th className="px-3 py-3 font-medium">Project</th>
        <th className="px-3 py-3 font-medium">Event date</th>
        <th className="px-3 py-3 font-medium">Proposal status</th>
        <th className="px-3 py-3 font-medium">Design due date</th>
</tr>
</thead>
<tbody>
{actionItems.map((item) => (
<tr
    key={item.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50" >
<td className="px-3 py-3">
<p className="text-xs font-semibold text-ink"> {item.name}
</p>
<p className="mt-1 text-[10px] text-neutral-500"> {item.code}
</p>
</td>
<td className="px-3 py-3 text-xs text-neutral-600"> {formatDate(item.eventDate)}
</td>
<td className="px-3 py-3"> <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${STATUS_BADGE[item.status]}`}>   {STATUS_LABEL[item.status]}
</span>
</td>
    <td className="px-3 py-3 text-xs font-semibold text-orange-700"> {formatDate(item.dueDate, {
    month: 'short',  day: 'numeric',
})}
</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</section>
</div>
<aside className="flex flex-col gap-4 xl:col-span-4">
<section className="rounded-xl border border-neutral-200 bg-white p-4">
<h2 className="mb-4 text-base font-bold text-ink"> Upcoming deadlines
</h2>
    {upcomingEvents.length === 0 ? ( <EmptyState text="No upcoming events." />
) :(
<div className="flex flex-col gap-4"> {upcomingEvents.map((event) => (
<div
    key={event.id} className="flex items-center gap-3" >
    <DateBadge iso={event.eventDate} />
<div className="min-w-0">
<p className="truncate text-xs font-semibold text-ink"> {event.name}
</p>
    <p className="mt-1 truncate text-[10px] text-neutral-500"> {event.venue}
</p>
<p className="mt-1 text-[10px] text-purple-700"> {formatDate(event.eventDate)}
</p>
</div>
</div>
))}
</div>
)}
</section>
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
<h2 className="mb-4 text-base font-bold text-ink">
        Notifications
</h2>
                            {recentUpdates.length === 0 ? (
                                <EmptyState text="You're all caught up!" />
                            ) : (
                                <div className="flex flex-col">
                                    {recentUpdates.map((update) => (
                                        <div
                                            key={update.id}
                                            className="flex gap-3 border-b border-neutral-100 py-3 last:border-0"
                                        >
                                            <span
                                                className={`mt-1 size-2 shrink-0 rounded-full ${UPDATE_DOT[update.kind]}`}
                                            />

                                            <div className="min-w-0">
                                                <p className="text-xs leading-relaxed text-neutral-700">
                                                    {update.text}
                                                </p>

                                                <p className="mt-1 text-[10px] text-neutral-400">
                                                    {formatDate(update.createdAt, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: 'numeric',
                                                        minute: '2-digit',
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </aside>
                </div>
            </main>
        </DesignSpecialistLayout>
    );
}


function StatCard({
    label,
    value,
    description,
    color,
}: {
    label: string;
    value: number;
    description: string;
    color: string;
}) {
    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${color}`}>
                {value}
            </p>
            <p className="mt-2 text-[10px] text-neutral-500">
                {description}
            </p>
        </div>
    );
}

function WorkflowBadge({
    label,
    count,
    color,
}: {
    label: string;
    count: number;
    color: string;
}) {
    return (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${color}`}>
            <span className="text-xs font-semibold">{label}</span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold">
                {count}
            </span>
        </div>
    );
}

function DateBadge({ iso }: { iso: string }) {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
        return (
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-500">
                --
            </div>
        );
    }

    return (
        <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-purple-50 text-purple-800">
            <span className="text-[9px] font-semibold uppercase">
                {formatDate(iso, { month: 'short' })}
            </span>
            <span className="text-base font-bold leading-none">
                {date.getDate()}
            </span>
        </div>
    );
}


function EmptyState({ text }: { text: string }) {
    return (
        <div className="rounded-lg bg-neutral-50 px-4 py-8 text-center">
            <p className="text-xs text-neutral-500">{text}</p>
        </div>
    );
}