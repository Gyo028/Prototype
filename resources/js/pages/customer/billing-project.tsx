import { Head } from '@inertiajs/react';
import type { BillingProject } from '@/components/customer/billing-list';
import BillingProjectView from '@/components/customer/billing-project';
import CustomerLayout from '@/layouts/customer-layout';

export default function BillingProjectPage({ project }: { project: BillingProject }) {
    return (
        <CustomerLayout>
            <Head title={`Billing · ${project.title}`} />
            <BillingProjectView project={project} />
        </CustomerLayout>
    );
}
