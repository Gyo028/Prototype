import { Head } from '@inertiajs/react';
import SiteAssessmentList from '@/components/project-manager/site-assessment-list';
import type { AssessmentProject } from '@/data/project-manager/site-assessments';
import ProjectManagerLayout from '@/layouts/project-manager-layout';

type Props = {
    /** Sent by the controller. While it is missing, the page shows sample data. */
    projects?: AssessmentProject[];
};

export default function SiteAssessments({ projects }: Props) {
    return (
        <ProjectManagerLayout>
            <Head title="Site Assessments" />

            <SiteAssessmentList projects={projects} />
        </ProjectManagerLayout>
    );
}