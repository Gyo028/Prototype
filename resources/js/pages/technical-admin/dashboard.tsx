import { Head, Link } from '@inertiajs/react';
import { Boxes, Contact, Database, Globe, Package, ShieldCheck, Users } from 'lucide-react';
import { Panel, Pill } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import TechnicalAdminLayout from '@/layouts/technical-admin-layout';

/*
 * Technical Admin dashboard. Every card maps to a Technical Admin responsibility
 * in the documentation: user accounts and roles (backlog 08), employee records (09),
 * website content (10), service configuration and layout assets (11), and the
 * system-level security and backup measures listed in the Scope.
 *
 * All numbers below are placeholders until the database is connected.
 */

const stats = [
    { label: 'User Accounts', href: '/technical-admin/users', value: '48', note: '3 pending verification', icon: Users, tint: 'bg-gold/20 text-gold-dark' },
    { label: 'Employee Records', href: undefined as string | undefined, value: '26', note: 'Active personnel', icon: Contact, tint: 'bg-purple-100 text-purple-600' },
    { label: 'Services & Packages', href: '/technical-admin/services', value: '6', note: '3 services, 3 packages active', icon: Package, tint: 'bg-green-100 text-green-600' },
    { label: 'Layout Assets', href: '/technical-admin/pricing', value: '142', note: '18 updated this month', icon: Boxes, tint: 'bg-sky-100 text-sky-600' },
];

const accountsByRole = [
    { role: 'Customer', count: 34 },
    { role: 'Design Specialist', count: 5 },
    { role: 'Project Manager', count: 3 },
    { role: 'Bookkeeper', count: 2 },
    { role: 'Owner', count: 1 },
    { role: 'Technical Admin', count: 1 },
];

const recentAccounts: { text: string; time: string; status: string; tone: PillTone }[] = [
    { text: 'Mark Santos registered as Customer', time: '3 hours ago', status: 'Pending', tone: 'yellow' },
    { text: 'Ana Reyes was assigned the Project Manager role', time: '1 day ago', status: 'Active', tone: 'green' },
    { text: 'Juan dela Cruz verified his email address', time: '1 day ago', status: 'Active', tone: 'green' },
    { text: 'Lea Villanueva account was archived', time: '3 days ago', status: 'Archived', tone: 'gray' },
];

const websiteContent: { section: string; updated: string; status: string; tone: PillTone }[] = [
    { section: 'Landing page (hero, contact info)', updated: 'Updated 10 minutes ago', status: 'Published', tone: 'green' },
    { section: 'Photo gallery', updated: 'Updated 2 days ago', status: 'Published', tone: 'green' },
    { section: 'Services and packages', updated: 'Updated 5 days ago', status: 'Published', tone: 'green' },
    { section: 'FAQ', updated: 'Updated 2 weeks ago', status: 'Unpublished changes', tone: 'yellow' },
];

const assetCategories = [
    { name: 'Wood', count: 24 }, { name: 'Fabric', count: 21 }, { name: 'Lighting', count: 18 },
    { name: 'Floral', count: 16 }, { name: 'Printing', count: 14 }, { name: 'Other', count: 49 },
];

const system = [
    { label: 'Last automated backup', value: 'Today, 2:00 AM', pill: { text: 'Successful', tone: 'green' as PillTone } },
    { label: 'Next scheduled backup', value: 'Tomorrow, 2:00 AM' },
    { label: 'Failed login attempts (24h)', value: '3', pill: { text: 'Review', tone: 'yellow' as PillTone } },
    { label: 'Disabled accounts', value: '2' },
];

export default function Dashboard() {
    const maxRole = Math.max(...accountsByRole.map((r) => r.count));

    return (
        <TechnicalAdminLayout>
            <Head title="Technical Admin Dashboard" />

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
                <p className="mt-1 text-base text-ink-soft">
                    System administration, website content and service configuration at a glance.
                </p>
            </div>

            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((s) => {
                    const card = (
                        <Panel
                            className={`flex h-full items-start justify-between p-5 ${s.href ? 'transition hover:border-gold' : ''}`}
                        >
                            <div>
                                <p className="text-sm text-ink-soft">{s.label}</p>
                                <p className="mt-1 text-2xl font-bold text-ink">{s.value}</p>
                                <p className="mt-1 text-xs font-semibold text-gold-dark">{s.note}</p>
                            </div>
                            <div className={`flex size-11 items-center justify-center rounded-xl ${s.tint}`}>
                                <s.icon className="size-5" />
                            </div>
                        </Panel>
                    );
                    return s.href ? (
                        <Link key={s.label} href={s.href} className="block">
                            {card}
                        </Link>
                    ) : (
                        <div key={s.label}>{card}</div>
                    );
                })}
            </div>

            {/* Accounts */}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Panel>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-ink">Accounts by Role</h2>
                        <Link href="/technical-admin/users" className="text-sm font-bold text-gold underline">
                            Manage roles
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
                        <h2 className="text-lg font-bold text-ink">Recent Account Activity</h2>
                        <Link href="/technical-admin/users" className="text-sm font-bold text-gold underline">
                            See all
                        </Link>
                    </div>
                    <ul className="space-y-4">
                        {recentAccounts.map((r) => (
                            <li key={r.text} className="flex items-center gap-3">
                                <span className="size-6 shrink-0 rounded-full bg-gold/30" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm text-ink">{r.text}</p>
                                    <p className="text-xs text-ink-soft">{r.time}</p>
                                </div>
                                <Pill tone={r.tone} className="px-4">{r.status}</Pill>
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>

        </TechnicalAdminLayout>
    );
}
