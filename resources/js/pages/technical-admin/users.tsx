import { Head } from '@inertiajs/react';
import UserAccountManagement from '@/components/technical-admin/user-account-management';
import TechnicalAdminLayout from '@/layouts/technical-admin-layout';

export default function Users() {
    return (
        <TechnicalAdminLayout>
            <Head title="User Accounts" />

            <UserAccountManagement />
        </TechnicalAdminLayout>
    );
}
