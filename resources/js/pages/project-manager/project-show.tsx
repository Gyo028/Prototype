import { usePage } from '@inertiajs/react';
import ProjectWizard from '@/components/project-manager/project-wizard';
import type { SetUpHead } from '@/data/project-manager/execution';
import type { DesignSpecialist, Project } from '@/data/project-manager/projects';
import ProjectManagerLayout from '@/layouts/project-manager-layout';

type Props = {
    /** Sent by the controller. While they are missing, the page shows sample data. */
    project?: Project;
    specialists?: DesignSpecialist[];
    setUpHeads?: SetUpHead[];
};

export default function ProjectShow({ project, specialists, setUpHeads }: Props) {
    // The project id comes from the address, e.g. /project-manager/projects/7
    const { url } = usePage();
    const projectId = Number(url.match(/projects\/(\d+)/)?.[1]);

    return (
        <ProjectManagerLayout>
            <ProjectWizard key={projectId} project={project} specialists={specialists} setUpHeads={setUpHeads} projectId={projectId} />
        </ProjectManagerLayout>
    );
}