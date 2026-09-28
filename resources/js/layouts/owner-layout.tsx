import type { ReactNode } from 'react';
import { ownerNav } from '@/components/dashboard/nav';
import Sidebar from '@/components/dashboard/sidebar';
import DashboardLayout from '@/layouts/dashboard-layout';

export default function OwnerLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <DashboardLayout
            renderSidebar={(onNavigate) => (
                <Sidebar nav={ownerNav} roleLabel="Owner" onNavigate={onNavigate} />
            )}
            notificationsHref="/owner/notifications"
            unreadCount={3}
        >
            {children}
        </DashboardLayout>
    );
}
