import { Head } from '@inertiajs/react';
import RequestDetails from '@/components/customer/request-details';
import type { ProjectStatusInfo, RequestDetail, RequestLayout } from '@/components/customer/project-types';
import CustomerLayout from '@/layouts/customer-layout';

type Props = {
    request: RequestDetail;
    layout: RequestLayout | null;
    project: { id: number; code: string; status: ProjectStatusInfo } | null;
};

export default function RequestShow(props: Props) {
    return (
        <CustomerLayout>
            <Head title={props.project ? 'Project Details' : 'Request Details'} />
            <RequestDetails {...props} />
        </CustomerLayout>
    );
}
