import { Head } from '@inertiajs/react';
import DesignSpecialistLayout from '@/layouts/design-specialist-layout';

export default function Dashboard() {
    return (
        <DesignSpecialistLayout>
            <Head title="Design Specialist Dashboard" />
            <h1 className="text-2xl font-bold text-ink">Design Specialist Dashboard</h1>
        </DesignSpecialistLayout>
    );
}
