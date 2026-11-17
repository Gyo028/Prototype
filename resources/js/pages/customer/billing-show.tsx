import { Head } from '@inertiajs/react';
import BillingDetail from '@/components/customer/billing-detail';
import type { BillDetail, DisputeInfo } from '@/components/customer/billing-detail';
import type { ProjectStatusInfo, ReservationFeeInfo } from '@/components/customer/project-types';
import CustomerLayout from '@/layouts/customer-layout';

type Props = {
    project: { id: number; code: string; title: string; status: ProjectStatusInfo; billingUrl: string };
    bill: BillDetail;
    payment: ReservationFeeInfo;
    dispute: DisputeInfo;
};

export default function BillingShow(props: Props) {
    return (
        <CustomerLayout>
            <Head title={`${props.bill.title} · ${props.project.title}`} />
            <BillingDetail {...props} />
        </CustomerLayout>
    );
}
