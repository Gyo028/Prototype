import { Head } from '@inertiajs/react';
import OwnerLayout from '@/layouts/owner-layout';

export default function Dashboard() {
    return (
        <OwnerLayout>
            <Head title="Owner Dashboard" />
            <h1 className="text-2xl font-bold text-ink">Owner Dashboard</h1>
        </OwnerLayout>
    );
}
