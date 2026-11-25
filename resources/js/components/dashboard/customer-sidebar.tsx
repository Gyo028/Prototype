import { Link, router, usePage } from '@inertiajs/react';
import { Bell, CreditCard, FilePlus, FolderOpen, House, LogOut, Star, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '@/components/dashboard/ui';



type CustomerNavItem = { title: string; href: string; icon: LucideIcon };

export const customerNav: CustomerNavItem[] = [
    { title: 'Dashboard', href: '/customer', icon: House },
    { title: 'New Service Request', href: '/customer/new-request', icon: FilePlus },
    { title: 'My Projects', href: '/customer/projects', icon: FolderOpen },
    { title: 'Billing & Payments', href: '/customer/billing', icon: CreditCard },
    { title: 'Notifications', href: '/customer/notifications', icon: Bell },
    { title: 'Ratings & Reviews', href: '/customer/reviews', icon: Star },
    { title: 'My Profile', href: '/customer/profile', icon: UserRound },
];

type Props = {
    onNavigate?: () => void;
    /** Unread notifications, shown on "Notifications" (the top bar no longer has a bell). */
    unreadCount?: number;
};

export default function CustomerSidebar({ onNavigate, unreadCount = 0 }: Props) {
    const { url, props } = usePage<{ customerProfileComplete?: boolean | null }>();
    // A red dot on "My Profile" until it has a contact number (needed before the first request).
    const profileIncomplete = props.customerProfileComplete === false;
    const path = url.split('?')[0];


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
                                    <span className="flex-1">{item.title}</span>
                                    {item.href === '/customer/notifications' && unreadCount > 0 && (
                                        <span
                                            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-ink"
                                            aria-label={`${unreadCount} unread`}
                                        >
                                            {unreadCount}
                                        </span>
                                    )}
                                    {item.href === '/customer/profile' && profileIncomplete && (
                                        <span className="size-2 rounded-full bg-red-500" role="img" aria-label="Profile incomplete" />
                                    )}
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
