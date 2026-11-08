import { Head } from '@inertiajs/react';
import UserAccountManagement from '@/components/technical-admin/user-account-management';
import type { NewAccount, RoleOption, StaffUser } from '@/components/technical-admin/user-account-management';
import TechnicalAdminLayout from '@/layouts/technical-admin-layout';

type Props = {
    users: StaffUser[];
    roles: RoleOption[];
    newAccount: NewAccount | null;
};

export default function Users({ users, roles, newAccount }: Props) {
    return (
        <TechnicalAdminLayout>
            <Head title="User Accounts" />

            <UserAccountManagement users={users} roles={roles} newAccount={newAccount} />
        </TechnicalAdminLayout>
    );
}