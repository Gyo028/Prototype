import { Head } from '@inertiajs/react';
import ProjectRequestReview from '@/components/project-manager/project-request-review';
import type { ProjectRequest } from '@/data/project-manager/project-requests';
import ProjectManagerLayout from '@/layouts/project-manager-layout';

type Props = {
    /** Sent by the controller. While it is missing, the page shows sample data. */
    requests?: ProjectRequest[];
};

export default function ServiceRequests({ requests }: Props) {
    return (
        <ProjectManagerLayout>
            <Head title="Service Requests" />

            <ProjectRequestReview requests={requests} />
        </ProjectManagerLayout>
    );
}
