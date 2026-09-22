import { Head } from '@inertiajs/react';
import ProjectRequestForm from '@/components/customer/project-request-form';
import CustomerLayout from '@/layouts/customer-layout';

export default function ProjectRequest() {
    return (
        <CustomerLayout>
            <Head title="Request New Project" />
            <ProjectRequestForm />
        </CustomerLayout>
    );
}
