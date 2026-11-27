import { Head } from '@inertiajs/react';
import MyProjects from '@/components/customer/my-projects';
import type { NextAction, ProjectListItem } from '@/components/customer/project-types';
import CustomerLayout from '@/layouts/customer-layout';

type Props = {
    items: Omit<ProjectListItem, 'nextAction'>[];
    profileMissing: boolean;
    /** { requestId: nextAction }, deferred: undefined until it arrives right after the page. */
    nextActions?: Record<number, NextAction | null>;
};

export default function Projects({ items, profileMissing, nextActions }: Props) {
    return (
        <CustomerLayout>
            <Head title="My Projects" />
            <MyProjects items={items} profileMissing={profileMissing} nextActions={nextActions} />
        </CustomerLayout>
    );
}
