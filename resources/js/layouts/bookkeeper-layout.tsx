import type { ReactNode } from 'react';
import { bookkeeperNav } from '@/components/dashboard/nav';
import Sidebar from '@/components/dashboard/sidebar';
import DashboardLayout from '@/layouts/dashboard-layout';

export default function BookkeeperLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <DashboardLayout
            renderSidebar={(onNavigate) => (
                <Sidebar nav={bookkeeperNav} roleLabel="Bookkeeper" onNavigate={onNavigate} />
            )}
            notificationsHref="/bookkeeper/notifications"
            unreadCount={3}
        >
            {children}
        </DashboardLayout>
    );
}
