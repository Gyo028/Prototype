import { Head, Link } from '@inertiajs/react';
import { Boxes, Contact, Package, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Panel, Pill } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import TechnicalAdminLayout from '@/layouts/technical-admin-layout';

/*
 * Technical Admin dashboard.
 */

type Stats = {
    users: { total: number; archived: number };
    employees: { active: number; archived: number };
    services: { total: number; active: number };
    assets: { total: number; active: number; categories: number };
};

type NewAccount = {
    id: number;
    name: string;
    role: string;
    added: string | null;
    status: 'Active' | 'Unverified' | 'Archived';
};

type Props = {
    stats: Stats;
    accountsByRole: { role: string; count: number }[];
    newestAccounts: NewAccount[];
};

const statusTone: Record<NewAccount['status'], PillTone> = {
    Active: 'green',
    Unverified: 'yellow',
    Archived: 'gray',
};

export default function Dashboard({ stats, accountsByRole, newestAccounts }: Props) {
    const cards: { label: string; href: string; value: number; note: string; icon: LucideIcon; tint: string }[] = [
        {
            label: 'User Accounts',
            href: '/technical-admin/users',
            value: stats.users.total,
            note: `${stats.users.archived} archived`,
            icon: Users,
            tint: 'bg-gold/20 text-gold-dark',
        },
        {
            label: 'Employee Records',
            href: '/technical-admin/employees',
            value: stats.employees.active,
            note: `Active personnel · ${stats.employees.archived} archived`,
            icon: Contact,
            tint: 'bg-purple-100 text-purple-600',
        },
        {
            label: 'Services',
            href: '/technical-admin/services-assets',
            value: stats.services.active,
            note: `${stats.services.active} of ${stats.services.total} active`,
            icon: Package,
            tint: 'bg-green-100 text-green-600',
        },
        {
            label: 'Layout Assets',
            href: '/technical-admin/services-assets',
            value: stats.assets.active,
            note: `${stats.assets.active} of ${stats.assets.total} active · ${stats.assets.categories} ${stats.assets.categories === 1 ? 'category' : 'categories'}`,
            icon: Boxes,
            tint: 'bg-sky-100 text-sky-600',
        },
    ];

    // Avoid dividing by zero when there are no accounts yet.
    const maxRole = Math.max(1, ...accountsByRole.map((r) => r.count));

    return (
        <TechnicalAdminLayout>
            <Head title="Technical Admin Dashboard" />

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
                <p className="mt-1 text-base text-ink-soft">
                    User accounts, employee records and service configuration at a glance.
                </p>
            </div>

            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((s) => (
                    <Link key={s.label} href={s.href} className="block">
                        <Panel className="flex h-full items-start justify-between p-5 transition hover:border-gold">
                            <div>
                                <p className="text-sm text-ink-soft">{s.label}</p>
                                <p className="mt-1 text-2xl font-bold text-ink">{s.value}</p>
                                <p className="mt-1 text-xs font-semibold text-gold-dark">{s.note}</p>
                            </div>
                            <div className={`flex size-11 items-center justify-center rounded-xl ${s.tint}`}>
                                <s.icon className="size-5" />
                            </div>
                        </Panel>
                    </Link>
                ))}
            </div>

            {/* Accounts */}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Panel>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-ink">Accounts by Role</h2>
                        <Link href="/technical-admin/users" className="text-sm font-bold text-gold underline">
                            Manage accounts
                        </Link>
                    </div>
                    <ul className="space-y-3">
                        {accountsByRole.map((r) => (
                            <li key={r.role} className="flex items-center gap-3">
                                <span className="w-36 shrink-0 text-sm text-ink">{r.role}</span>
                                <div className="h-2.5 flex-1 rounded-full bg-black/10">
                                    <div
                                        className="h-full rounded-full bg-gold"
                                        style={{ width: `${(r.count / maxRole) * 100}%` }}
                                    />
                                </div>
                                <span className="w-8 text-right text-sm font-bold text-ink">{r.count}</span>
                            </li>
                        ))}
                    </ul>
                </Panel>

                <Panel>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-ink">Newest Accounts</h2>
                        <Link href="/technical-admin/users" className="text-sm font-bold text-gold underline">
                            See all
                        </Link>
                    </div>
                    {newestAccounts.length === 0 ? (
                        <p className="text-sm text-ink-soft">No accounts yet.</p>
                    ) : (
                        <ul className="space-y-4">
                            {newestAccounts.map((a) => (
                                <li key={a.id} className="flex items-center gap-3">
                                    <span className="size-6 shrink-0 rounded-full bg-gold/30" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm text-ink">
                                            {a.name} <span className="text-ink-soft">· {a.role}</span>
                                        </p>
                                        <p className="text-xs text-ink-soft">Added {a.added}</p>
                                    </div>
                                    <Pill tone={statusTone[a.status]} className="px-4">
                                        {a.status}
                                    </Pill>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>
        </TechnicalAdminLayout>
    );
}