import { X } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import TopBar from '@/components/dashboard/top-bar';

type Props = {
    /** Builds the role's sidebar. onNavigate closes the mobile drawer after a link is clicked. */
    renderSidebar: (onNavigate?: () => void) => ReactNode;
    notificationsHref?: string;
    unreadCount?: number;
    children: ReactNode;
};

/**
 * Role-agnostic dashboard shell: top bar + sidebar + page content.
 * Each role passes its own sidebar through renderSidebar.
 */
export default function DashboardLayout({
    renderSidebar,
    notificationsHref,
    unreadCount = 0,
    children,
}: Props) {
    const [open, setOpen] = useState(false);

    return (
        <div className="flex min-h-svh flex-col bg-neutral-100">
            <TopBar
                notificationsHref={notificationsHref}
                unreadCount={unreadCount}
                onMenuClick={() => setOpen(true)}
            />

            <div className="flex flex-1">
                {/* Desktop sidebar (stays in view under the sticky top bar) */}
                <aside className="hidden w-56 shrink-0 lg:block">
                    <div className="sticky top-20 h-[calc(100svh-5rem)]">{renderSidebar()}</div>
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
                            {renderSidebar(() => setOpen(false))}
                        </div>
                    </div>
                )}

                <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
            </div>
        </div>
    );
}
