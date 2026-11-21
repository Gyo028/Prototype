import { Head } from '@inertiajs/react';
import CustomerDashboard from '@/components/customer/customer-dashboard';
import type { DashboardData } from '@/components/customer/customer-dashboard';
import CustomerLayout from '@/layouts/customer-layout';

export default function Dashboard(props: DashboardData) {
    return (
        <CustomerLayout>
            <Head title="Dashboard" />
            <CustomerDashboard {...props} />
        </CustomerLayout>
    );
}
