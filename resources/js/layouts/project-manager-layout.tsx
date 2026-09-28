import type { ReactNode } from 'react';
import { projectManagerNav } from '@/components/dashboard/nav';
import Sidebar from '@/components/dashboard/sidebar';
import DashboardLayout from '@/layouts/dashboard-layout';

export default function ProjectManagerLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <DashboardLayout
            renderSidebar={(onNavigate) => (
                <Sidebar nav={projectManagerNav} roleLabel="Project Manager" onNavigate={onNavigate} />
            )}
            notificationsHref="/project-manager/notifications"
            unreadCount={3}
        >
            {children}
        </DashboardLayout>
    );
}
