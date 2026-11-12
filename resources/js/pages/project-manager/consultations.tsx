import { Head } from '@inertiajs/react';
import ConsultationList from '@/components/project-manager/consultation-list';
import type { ProjectRequest } from '@/data/project-manager/project-requests';
import ProjectManagerLayout from '@/layouts/project-manager-layout';

type Props = {
    /** Sent by the controller (approved requests only). While it is missing, the page shows sample data. */
    projects?: ProjectRequest[];
};

export default function Consultations({ projects }: Props) {
    return (
        <ProjectManagerLayout>
            <Head title="Consultations" />

            <ConsultationList projects={projects} />
        </ProjectManagerLayout>
    );
}