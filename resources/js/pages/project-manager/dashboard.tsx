import { Head } from '@inertiajs/react';
import DashboardOverview from '@/components/project-manager/dashboard-overview';
import type { ProjectRequest } from '@/data/project-manager/project-requests';
import type { Project } from '@/data/project-manager/projects';
import ProjectManagerLayout from '@/layouts/project-manager-layout';

type Props = {
    /** Sent by the controller. While they are missing, the page shows sample data. */
    projects?: Project[];
    requests?: ProjectRequest[];
};

export default function Dashboard({ projects, requests }: Props) {
    return (
        <ProjectManagerLayout>
            <Head title="Project Manager Dashboard" />
            <DashboardOverview projects={projects} requests={requests} />
        </ProjectManagerLayout>
    );
}