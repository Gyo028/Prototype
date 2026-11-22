import { Head } from '@inertiajs/react';
import BillingPayments from '@/components/project-manager/billing-payments';
import type { Project } from '@/data/project-manager/projects';
import ProjectManagerLayout from '@/layouts/project-manager-layout';

type Props = {
    /** Sent by the controller. While it is missing, the page shows sample data. */
    projects?: Project[];
};

export default function BillingPaymentsPage({ projects }: Props) {
    return (
        <ProjectManagerLayout>
            <Head title="Billing and Payments" />
            <BillingPayments projects={projects} />
        </ProjectManagerLayout>
    );
}