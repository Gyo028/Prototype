import type { ReactNode } from 'react';
import { technicalAdminNav } from '@/components/dashboard/nav';
import Sidebar from '@/components/dashboard/sidebar';
import PageSkeleton, { usePendingPage } from '@/components/page-skeleton';
import DashboardLayout from '@/layouts/dashboard-layout';

export default function TechnicalAdminLayout({
    children,
}: {
    children: ReactNode;
}) {
    // The page being opened, shown as a skeleton until it arrives.
    const pending = usePendingPage('/technical-admin');

    return (
        <DashboardLayout
            renderSidebar={(onNavigate) => (
                <Sidebar nav={technicalAdminNav} roleLabel="Technical Administrator" onNavigate={onNavigate} />
            )}
            notificationsHref="/technical-admin/notifications"
            unreadCount={3}
        >
            {/* Hidden, not removed: if the visit is cancelled, the page comes back as it was. */}
            <div hidden={pending !== null}>{children}</div>
            {pending && <PageSkeleton kind={pending} />}
        </DashboardLayout>
    );
}
