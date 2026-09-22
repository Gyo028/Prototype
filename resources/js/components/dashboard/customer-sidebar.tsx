import { Link, router, usePage } from '@inertiajs/react';
import { Bell, CreditCard, FilePlus, FolderOpen, House, LogOut, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '@/components/dashboard/ui';

/*
 * Sidebar for the Customer account (Figma "Customer Dashboard").
 * Unlike the staff sidebar it has no user block or group headings:
 * a single list of icon links, a divider, then Logout.
 *
 * Every item maps to a Customer function in the documentation (backlog item in brackets):
 *  - New Project Request   submit a request with the 2D layout and initial cost  [12, 14]
 *  - My Projects           the Plan Project stages of each project: consultation and
 *                          ocular visit scheduling, design proposal review, contract
 *                          signing, request status and progress          [15, 19, 25, 17, 33]
 *  - Billing & Payments    bills (reservation fee, final billing, additional charges),
 *                          receipt upload, payment history, disputes              [26, 29]
 *  - Notifications         project updates and required actions                   [33]
 *  - Ratings & Reviews     feedback on a completed project                        [35]
 * Upcoming appointments are shown on the dashboard. Browsing services, packages and
 * sample works is done on the public website.
 */

type CustomerNavItem = { title: string; href: string; icon: LucideIcon };

export const customerNav: CustomerNavItem[] = [
    { title: 'Dashboard', href: '/customer', icon: House },
    { title: 'New Service Request', href: '/customer/new-request', icon: FilePlus },
    { title: 'My Projects', href: '/customer/projects', icon: FolderOpen },
    { title: 'Billing & Payments', href: '/customer/billing', icon: CreditCard },
    { title: 'Notifications', href: '/customer/notifications', icon: Bell },
    { title: 'Ratings & Reviews', href: '/customer/reviews', icon: Star },
];

type Props = {
    /** Called after a link is clicked (used to close the mobile drawer) */
    onNavigate?: () => void;
};

export default function CustomerSidebar({ onNavigate }: Props) {
    const { url } = usePage();
    const path = url.split('?')[0];

    // The dashboard link must match exactly, otherwise it would stay
    // highlighted on every page under /customer
    const isActive = (href: string) => (href === '/customer' ? path === href : path.startsWith(href));

    return (
        <div className="flex h-full flex-col bg-[#222222] text-white">
            <nav className="flex-1 overflow-y-auto pt-6" aria-label="Customer menu">
                <ul>
                    {customerNav.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    onClick={onNavigate}
                                    aria-current={active ? 'page' : undefined}
                                    className={cx(
                                        'flex items-center gap-4 px-4 py-3 text-sm font-medium transition',
                                        active ? 'bg-gold text-white' : 'text-white/90 hover:bg-white/10',
                                    )}
                                >
                                    <item.icon className="size-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                                    {item.title}
                                </Link>
                            </li>
                        );
                    })}
                </ul>

                <div className="mx-6 mt-5 border-t border-white/20" />
            </nav>

            {/* Logout pinned to the bottom of the sidebar */}
            <div className="border-t border-white/10 py-2">
                <button
                    type="button"
                    onClick={() => router.post('/logout')}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left text-sm font-bold text-red-500 transition hover:bg-white/10"
                >
                    <LogOut className="size-5 shrink-0" />
                    Logout
                </button>
            </div>
        </div>
    );
}
