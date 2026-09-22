import { Head } from '@inertiajs/react';
import WebsiteContentManagement from '@/components/technical-admin/website-content-management';
import TechnicalAdminLayout from '@/layouts/technical-admin-layout';

export default function WebsiteContent() {
    return (
        <TechnicalAdminLayout>
            <Head title="Website Content" />

            <WebsiteContentManagement />
        </TechnicalAdminLayout>
    );
}
