import { Head } from '@inertiajs/react';
import ProjectFolder from '@/components/customer/project-folder';
import type {
    ConsultationInfo,
    ConsultationRules,
    DesignInfo,
    NextAction,
    OcularVisitInfo,
    ProjectDetail,
    ReservationFeeInfo,
    Step,
    StepKey,
} from '@/components/customer/project-types';
import CustomerLayout from '@/layouts/customer-layout';

type Props = {
    project: ProjectDetail;
    steps: Step[];
    currentStep: StepKey;
    nextAction: NextAction;
    consultation: ConsultationInfo;
    reservationFee: ReservationFeeInfo;
    ocularVisit: OcularVisitInfo;
    design: DesignInfo;
    availableSlots: Record<string, string[]>;
    rules: ConsultationRules;
};

export default function ProjectShow(props: Props) {
    return (
        <CustomerLayout>
            <Head title={props.project.title} />
            <ProjectFolder {...props} />
        </CustomerLayout>
    );
}
