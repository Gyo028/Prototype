import { Head } from '@inertiajs/react';
import ProjectRequestForm from '@/components/customer/project-request-form';
import type { RequestCatalog } from '@/components/customer/request-catalog';
import CustomerLayout from '@/layouts/customer-layout';

export default function ProjectRequest(props: RequestCatalog) {
    return (
        <CustomerLayout>
            <Head title="Request New Project" />
            <ProjectRequestForm catalog={props} />
        </CustomerLayout>
    );
}
