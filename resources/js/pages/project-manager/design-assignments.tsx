import { Head } from '@inertiajs/react';
import DesignAssignmentList from '@/components/project-manager/design-assignment-list';
import type { AssignmentProject, DesignSpecialist } from '@/data/project-manager/design-assignments';
import ProjectManagerLayout from '@/layouts/project-manager-layout';

type Props = {
    /** Sent by the controller. While they are missing, the page shows sample data. */
    projects?: AssignmentProject[];
    specialists?: DesignSpecialist[];
};

export default function DesignAssignments({ projects, specialists }: Props) {
    return (
        <ProjectManagerLayout>
            <Head title="Design Assignments" />

            <DesignAssignmentList projects={projects} specialists={specialists} />
        </ProjectManagerLayout>
    );
}