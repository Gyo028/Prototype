import { Link } from '@inertiajs/react';
import { Bell, Menu, Search, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import BrandLogo from '@/components/brand-logo';
import CustomerSidebar from '@/components/dashboard/customer-sidebar';

/**
 * Customer shell: top bar + customer sidebar (Figma "Customer Dashboard").
 * Self-contained, so it does not depend on the staff dashboard layout.
 */
export default function CustomerLayout({
    children,
    unreadCount = 3,
}: {
    children: ReactNode;
    unreadCount?: number;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="flex min-h-svh flex-col bg-neutral-100">
            {/* Top bar */}
            <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-4 bg-white px-4 shadow-md md:px-8">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        className="rounded-md p-2 hover:bg-black/5 lg:hidden"
                        aria-label="Open menu"
                        onClick={() => setOpen(true)}
                    >
                        <Menu className="size-5" />
                    </button>
                    <Link href="/" aria-label="Back to home page">
                        <BrandLogo />
                    </Link>
                </div>

                <div className="flex items-center gap-4">
                    <label className="hidden h-11 w-72 items-center gap-3 rounded-full bg-neutral-200 px-4 md:flex lg:w-80">
                        <Menu className="size-4 text-ink-soft" />
                        <input
                            type="search"
                            placeholder="Search"
                            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft"
                        />
                        <Search className="size-4 text-ink-soft" />
                    </label>

                    <Link
                        href="/customer/notifications"
                        aria-label="Notifications"
                        className="relative rounded-md border border-ink/60 p-1.5"
                    >
                        <Bell className="size-4" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-white">
                                {unreadCount}
                            </span>
                        )}
                    </Link>

                    <div
                        className="flex size-11 items-center justify-center rounded-full bg-purple-100 text-purple-700"
                        aria-label="Your account"
                    >
                        <UserRound className="size-6" />
                    </div>
                </div>
            </header>

            <div className="flex flex-1">
                {/* Desktop sidebar */}
                <aside className="hidden w-56 shrink-0 lg:block">
                    <div className="sticky top-20 h-[calc(100svh-5rem)]">
                        <CustomerSidebar />
                    </div>
                </aside>

                {/* Mobile drawer */}
                {open && (
                    <div className="fixed inset-0 z-40 lg:hidden">
                        <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
                        <div className="absolute inset-y-0 left-0 w-64">
                            <button
                                type="button"
                                aria-label="Close menu"
                                onClick={() => setOpen(false)}
                                className="absolute top-3 right-3 z-10 text-white"
                            >
                                <X className="size-5" />
                            </button>
                            <CustomerSidebar onNavigate={() => setOpen(false)} />
                        </div>
                    </div>
                )}

                <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
            </div>
        </div>
    );
}
