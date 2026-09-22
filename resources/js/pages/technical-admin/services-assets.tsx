import { Head } from '@inertiajs/react';
import ServicesAndAssetsManagement from '@/components/technical-admin/services-and-assets-management';
import TechnicalAdminLayout from '@/layouts/technical-admin-layout';

export default function ServicesAssets() {
    return (
        <TechnicalAdminLayout>
            <Head title="Services & Assets" />
            <ServicesAndAssetsManagement />
        </TechnicalAdminLayout>
    );
}
