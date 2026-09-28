import { Head } from '@inertiajs/react';
import ProjectManagerLayout from '@/layouts/project-manager-layout';

export default function Dashboard() {
    return (
        <ProjectManagerLayout>
            <Head title="Project Manager Dashboard" />
            <h1 className="text-2xl font-bold text-ink">Project Manager Dashboard</h1>
        </ProjectManagerLayout>
    );
}
