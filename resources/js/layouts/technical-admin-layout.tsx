import type { ReactNode } from 'react';
import { technicalAdminNav } from '@/components/dashboard/nav';
import Sidebar from '@/components/dashboard/sidebar';
import DashboardLayout from '@/layouts/dashboard-layout';

export default function TechnicalAdminLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <DashboardLayout
            renderSidebar={(onNavigate) => (
                <Sidebar nav={technicalAdminNav} roleLabel="Technical Administrator" onNavigate={onNavigate} />
            )}
            notificationsHref="/technical-admin/notifications"
            unreadCount={3}
        >
            {children}
        </DashboardLayout>
    );
}
