import { Head } from '@inertiajs/react';
import ProjectOverview from '@/components/owner/project-overview';
import type { OwnerProjectSummary } from '@/data/owner/projects';
import OwnerLayout from '@/layouts/owner-layout';

type Props = {
    /** Sent by the controller. While it is missing, the page shows sample data. */
    projects?: OwnerProjectSummary[];
};

export default function Dashboard({ projects }: Props) {
    return (
        <OwnerLayout>
            <Head title="Owner Dashboard" />
            <ProjectOverview projects={projects} />
        </OwnerLayout>
    );
}