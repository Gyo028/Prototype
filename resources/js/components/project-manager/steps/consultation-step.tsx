import { router } from '@inertiajs/react';
import { ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { GoldButton } from '@/components/dashboard/ui';
import ConsultationForm from '@/components/project-manager/consultation-form';
import type { ConsultationErrors, ConsultationValues } from '@/components/project-manager/consultation-form';
import { ConsultationSummary } from '@/components/project-manager/request-details';
import { PROJECTS_URL, StepIntro } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import type { Consultation } from '@/data/project-manager/project-requests';

/*
 * Step 1 · Consultation (backlog #16).
 * Records the consultation outcome, updates the project details, says whether an ocular
 * visit is needed and decides whether the project can proceed.
 */
export default function ConsultationStep({ project, usingSample, managerName, onSaved }: StepProps) {
    const [editing, setEditing] = useState(project.consultation === null);
    const [serverErrors, setServerErrors] = useState<ConsultationErrors>({});
    const [saving, setSaving] = useState(false);

    const save = (v: ConsultationValues) => {
        // The form already checked that outcome, ocular visit and decision are filled in.
        const payload = {
            outcome: v.outcome as Consultation['outcome'],
            summary: v.summary.trim(),
            additionalNotes: v.additionalNotes.trim() || null,
            eventDate: v.eventDate,
            startTime: v.startTime,
            endTime: v.endTime,
            venue: v.venue.trim(),
            venueSetting: v.venueSetting,
            guests: v.guests ? Number(v.guests) : null,
            budget: v.budget,
            ocularVisitRequired: v.ocularVisitRequired === 'yes',
            decision: v.decision as Consultation['decision'],
            decisionReason: v.decision === 'Do not proceed' ? v.decisionReason.trim() : null,
        };

        const finish = () => {
            toast.success(
                payload.decision === 'Proceed'
                    ? `Consultation saved for ${project.code}. The customer has been notified.`
                    : `Consultation saved for ${project.code}. The project will not proceed.`,
            );
            setEditing(false);
        };

        if (usingSample) {
            onSaved({
                ...project,
                // the project information is updated...
                eventDate: payload.eventDate,
                startTime: payload.startTime,
                endTime: payload.endTime,
                venue: payload.venue,
                venueSetting: payload.venueSetting,
                guests: payload.guests,
                budget: payload.budget,
                // ...and the consultation outcome is saved
                consultation: {
                    outcome: payload.outcome,
                    summary: payload.summary,
                    additionalNotes: payload.additionalNotes,
                    ocularVisit: { required: payload.ocularVisitRequired },
                    decision: payload.decision,
                    decisionReason: payload.decisionReason,
                    recordedBy: managerName,
                    recordedAt: new Date().toISOString(),
                },
            });
            finish();
            return;
        }

        router.patch(`${PROJECTS_URL}/${project.id}/consultation`, payload, {
            preserveScroll: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onSuccess: finish,
            onError: (errors) => setServerErrors(errors),
        });
    };

    return (
        <>
            <StepIntro title="Consultation">
                Record what was agreed with the customer and decide whether the project can proceed.
            </StepIntro>

            {editing ? (
                <ConsultationForm
                    request={project}
                    saving={saving}
                    serverErrors={serverErrors}
                    onCancel={() => setEditing(false)}
                    onSave={save}
                />
            ) : (
                <div className="grid gap-4">
                    {project.consultation && <ConsultationSummary consultation={project.consultation} />}
                    <div className="flex justify-end">
                        <GoldButton
                            onClick={() => {
                                setServerErrors({});
                                setEditing(true);
                            }}
                        >
                            <ClipboardList className="size-4" />
                            {project.consultation ? 'Update Consultation' : 'Record Consultation'}
                        </GoldButton>
                    </div>
                </div>
            )}
        </>
    );
}
