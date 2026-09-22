import { Head } from '@inertiajs/react';
import { PageHeader } from '@/components/dashboard/ui';
import EmployeeRecordsManagement from '@/components/technical-admin/employee-records-management';
import TechnicalAdminLayout from '@/layouts/technical-admin-layout';

export default function Employees() {
    return (
        <TechnicalAdminLayout>
            <Head title="Employee Records" />
            <PageHeader
                title="Employee Records"
                description="Manage the personnel assigned to project schedules and work orders"
            />
            <EmployeeRecordsManagement />
        </TechnicalAdminLayout>
    );
}
