import { Head } from '@inertiajs/react';
import ProjectManagerLayout from '@/layouts/project-manager-layout';

export default function Projects() {
    return (
        <ProjectManagerLayout>
            <Head title="Projects" />
            <h1 className="text-2xl font-bold text-ink">Projects</h1>
        </ProjectManagerLayout>
    );
}