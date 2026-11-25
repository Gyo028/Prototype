import { Head } from '@inertiajs/react';
import WebsiteContentManagement from '@/components/technical-admin/website-content-management';
import type { WebsiteContentProps } from '@/components/technical-admin/website-content-management';
import TechnicalAdminLayout from '@/layouts/technical-admin-layout';

export default function WebsiteContent(props: WebsiteContentProps) {
    return (
        <TechnicalAdminLayout>
            <Head title="Website Content" />

            <WebsiteContentManagement {...props} />
        </TechnicalAdminLayout>
    );
}
