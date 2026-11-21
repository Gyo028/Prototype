import { Head } from '@inertiajs/react';
import BillingList from '@/components/customer/billing-list';
import type { BillingProject } from '@/components/customer/billing-list';
import CustomerLayout from '@/layouts/customer-layout';

export default function Billing({ projects }: { projects: BillingProject[] }) {
    return (
        <CustomerLayout>
            <Head title="Billing & Payments" />
            <BillingList projects={projects} />
        </CustomerLayout>
    );
}
