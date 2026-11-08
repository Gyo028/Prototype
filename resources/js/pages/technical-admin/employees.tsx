import { Head } from '@inertiajs/react';
import { PageHeader } from '@/components/dashboard/ui';
import EmployeeRecordsManagement from '@/components/technical-admin/employee-records-management';
import type { Employee, Position, StaffAccount } from '@/components/technical-admin/employee-records-management';
import TechnicalAdminLayout from '@/layouts/technical-admin-layout';

type Props = {
    employees: Employee[];
    positions: Position[];
    staffAccounts: StaffAccount[];
};

export default function Employees({ employees, positions, staffAccounts }: Props) {
    return (
        <TechnicalAdminLayout>
            <Head title="Employee Records" />
            <PageHeader
                title="Employee Records"
                description="Manage the personnel assigned to project schedules and work orders"
            />
            <EmployeeRecordsManagement employees={employees} positions={positions} staffAccounts={staffAccounts} />
        </TechnicalAdminLayout>
    );
}