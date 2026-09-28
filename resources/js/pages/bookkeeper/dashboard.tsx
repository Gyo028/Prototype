import { Head } from '@inertiajs/react';
import BookkeeperLayout from '@/layouts/bookkeeper-layout';

export default function Dashboard() {
    return (
        <BookkeeperLayout>
            <Head title="Bookkeeper Dashboard" />
            <h1 className="text-2xl font-bold text-ink">Bookkeeper Dashboard</h1>
        </BookkeeperLayout>
    );
}
