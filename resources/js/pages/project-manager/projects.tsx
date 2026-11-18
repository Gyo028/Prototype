import { Head } from '@inertiajs/react';
import ProjectList from '@/components/project-manager/project-list';
import type { Project } from '@/data/project-manager/projects';
import ProjectManagerLayout from '@/layouts/project-manager-layout';

type Props = {
    /** Sent by the controller (approved requests only). While it is missing, the page shows sample data. */
    projects?: Project[];
};

export default function Projects({ projects }: Props) {
    return (
        <ProjectManagerLayout>
            <Head title="Projects" />

            <ProjectList projects={projects} />
        </ProjectManagerLayout>
    );
}
