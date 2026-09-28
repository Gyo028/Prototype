import type { ReactNode } from 'react';
import { designSpecialistNav } from '@/components/dashboard/nav';
import Sidebar from '@/components/dashboard/sidebar';
import DashboardLayout from '@/layouts/dashboard-layout';

export default function DesignSpecialistLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <DashboardLayout
            renderSidebar={(onNavigate) => (
                <Sidebar nav={designSpecialistNav} roleLabel="Design Specialist" onNavigate={onNavigate} />
            )}
            notificationsHref="/design-specialist/notifications"
            unreadCount={3}
        >
            {children}
        </DashboardLayout>
    );
}
