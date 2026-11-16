import { Head } from '@inertiajs/react';
import MyProjects from '@/components/customer/my-projects';
import type { ProjectListItem } from '@/components/customer/project-types';
import CustomerLayout from '@/layouts/customer-layout';

export default function Projects({ items, profileMissing }: { items: ProjectListItem[]; profileMissing: boolean }) {
    return (
        <CustomerLayout>
            <Head title="My Projects" />
            <MyProjects items={items} profileMissing={profileMissing} />
        </CustomerLayout>
    );
}
