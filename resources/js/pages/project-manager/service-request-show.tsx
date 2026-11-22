import { usePage } from '@inertiajs/react';
import ProjectRequestDetail from '@/components/project-manager/project-request-detail';
import type { ProjectRequest } from '@/data/project-manager/project-requests';
import ProjectManagerLayout from '@/layouts/project-manager-layout';

type Props = {
    /** Sent by the controller. While it is missing, the page shows sample data. */
    request?: ProjectRequest;
};

export default function ServiceRequestShow({ request }: Props) {
    // The request id comes from the address, e.g. /project-manager/service-requests/4
    const { url } = usePage();
    const requestId = Number(url.match(/service-requests\/(\d+)/)?.[1]);

    return (
        <ProjectManagerLayout>
            <ProjectRequestDetail key={requestId} request={request} requestId={requestId} />
        </ProjectManagerLayout>
    );
}