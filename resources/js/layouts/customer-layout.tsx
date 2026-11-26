import { Link } from '@inertiajs/react';
import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import BrandLogo from '@/components/brand-logo';
import CustomerSidebar from '@/components/dashboard/customer-sidebar';

/**
 * Customer shell: top bar + customer sidebar.
 * Self-contained, so it does not depend on the staff dashboard layout.
 */
export default function CustomerLayout({
    children,
    unreadCount = 0,
}: {
    children: ReactNode;
    unreadCount?: number;
}) {
    const [open, setOpen] = useState(false);

    // Phones and tablets: the top bar slides away while scrolling down and comes back when scrolling up.
    // On desktop (lg) it always stays, since the sidebar sits right under it.
    const [barHidden, setBarHidden] = useState(false);
    const lastY = useRef(0);

    useEffect(() => {
        const onScroll = () => {
            const y = window.scrollY;
            const delta = y - lastY.current;
            if (Math.abs(delta) < 6) return; // ignore tiny jitters
            setBarHidden(delta > 0 && y > 80);
            lastY.current = y;
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <div className="flex min-h-svh flex-col bg-neutral-100">
            {/* Top bar: the logo, and on phones and tablets the menu button on the right.
                Notifications and My Profile are in the sidebar. */}
            <header
                className={`sticky top-0 z-30 flex h-20 items-center justify-between gap-4 bg-white px-4 shadow-md transition-transform duration-300 md:px-8 lg:translate-y-0 ${
                    barHidden && !open ? '-translate-y-full' : 'translate-y-0'
                }`}
            >
                <Link href="/" aria-label="Back to home page">
                    <BrandLogo />
                </Link>

                <button
                    type="button"
                    className="flex size-11 items-center justify-center rounded-md hover:bg-black/5 lg:hidden"
                    aria-label="Open menu"
                    onClick={() => setOpen(true)}
                >
                    <Menu className="size-6" />
                </button>
            </header>

            <div className="flex flex-1">
                {/* Desktop sidebar */}
                <aside className="hidden w-56 shrink-0 lg:block">
                    <div className="sticky top-20 h-[calc(100svh-5rem)]">
                        <CustomerSidebar unreadCount={unreadCount} />
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
                            <CustomerSidebar unreadCount={unreadCount} onNavigate={() => setOpen(false)} />
                        </div>
                    </div>
                )}

                <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
            </div>
        </div>
    );
}
