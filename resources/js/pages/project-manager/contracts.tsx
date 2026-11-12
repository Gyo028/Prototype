import { Head } from '@inertiajs/react';
import ContractReview from '@/components/project-manager/contract-review';
import type { Contract } from '@/data/project-manager/contracts';
import ProjectManagerLayout from '@/layouts/project-manager-layout';

type Props = {
    /** Sent by the controller. While it is missing, the page shows sample data. */
    contracts?: Contract[];
};

export default function Contracts({ contracts }: Props) {
    return (
        <ProjectManagerLayout>
            <Head title="Contracts" />

            <ContractReview contracts={contracts} />
        </ProjectManagerLayout>
    );
}