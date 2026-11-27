import { router } from '@inertiajs/react';
import { CalendarClock, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { GoldButton } from '@/components/dashboard/ui';
import ConsultationForm from '@/components/project-manager/consultation-form';
import MeetingLinkForm from '@/components/project-manager/meeting-link-form';
import type { ConsultationErrors, ConsultationValues } from '@/components/project-manager/consultation-form';
import { ConsultationSummary, formatDateTime } from '@/components/project-manager/request-details';
import { PROJECTS_URL, StepIntro, WaitingNotice } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import type { Consultation } from '@/data/project-manager/project-requests';

/*
 * Step 1 · Consultation (backlog #16).
 * The customer books the consultation. Afterwards the Project Manager records the outcome,
 * updates the project details, says whether an ocular visit is needed and records the
 * customer's decision (Proceed, On hold or Do not proceed).
 * Rescheduled / did not attend: the booking is closed and the customer books again.
 */
export default function ConsultationStep({ project, usingSample, managerName, onSaved }: StepProps) {
    const c = project.consultation;
    // consultationAt is only sent by the backend: null means the customer has not booked yet.
    const notBooked = !c && project.consultationAt === null;
    // A recorded consultation can only be changed while the customer is still deciding.
    const canUpdate = c !== null && (usingSample || c.decision === 'On hold');

    const [editing, setEditing] = useState(c === null && !notBooked);
    const [serverErrors, setServerErrors] = useState<ConsultationErrors>({});
    const [saving, setSaving] = useState(false);

    const save = (v: ConsultationValues) => {
        const held = v.outcome === 'Completed';
        const isCustom = project.requestType === 'custom';

        // The form already checked the required fields.
        const payload = held
            ? {
                  outcome: v.outcome,
                  summary: v.summary.trim(),
                  additionalNotes: v.additionalNotes.trim() || null,
                  eventDate: v.eventDate,
                  endDate: isCustom ? v.endDate : v.eventDate,
                  startTime: isCustom ? null : v.startTime,
                  endTime: isCustom ? null : v.endTime,
                  venue: v.venue.trim(),
                  venueSetting: v.venueSetting || null,
                  guests: v.guests ? Number(v.guests) : null,
                  budget: v.budget,
                  ocularVisitRequired: v.ocularVisitRequired === 'yes',
                  decision: v.decision as Consultation['decision'],
                  decisionReason: v.decision === 'Do not proceed' ? v.decisionReason.trim() : null,
              }
            : { outcome: v.outcome, summary: v.summary.trim() };

        const finish = () => {
            if (!held) toast.success(`Booking closed for ${project.code}. The customer can now book a new consultation.`);
            else if (v.decision === 'Proceed')
                toast.success(`Consultation saved for ${project.code}. The reservation fee was issued and the customer has been notified.`);
            else if (v.decision === 'On hold') toast.success(`Consultation saved for ${project.code}. The project is on hold while the customer decides.`);
            else toast.success(`Consultation saved for ${project.code}. The project will not proceed.`);
            setEditing(false);
        };

        if (usingSample) {
            if (!held) {
                onSaved({
                    ...project,
                    consultationAt: null,
                    consultationNote: `${v.outcome === 'Rescheduled' ? 'Rescheduled' : 'Customer did not attend'}: ${v.summary.trim()}`,
                });
                finish();
                return;
            }
            onSaved({
                ...project,
                // the project information is updated...
                eventDate: v.eventDate,
                endDate: isCustom ? v.endDate : project.endDate,
                startTime: isCustom ? project.startTime : v.startTime,
                endTime: isCustom ? project.endTime : v.endTime,
                venue: v.venue.trim(),
                venueSetting: v.venueSetting || null,
                guests: v.guests ? Number(v.guests) : null,
                budget: v.budget,
                // ...and the consultation outcome is saved
                consultation: {
                    outcome: 'Completed',
                    summary: v.summary.trim(),
                    additionalNotes: v.additionalNotes.trim() || null,
                    ocularVisit: { required: v.ocularVisitRequired === 'yes' },
                    decision: v.decision as Consultation['decision'],
                    decisionReason: v.decision === 'Do not proceed' ? v.decisionReason.trim() : null,
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

            {/* Booking information (real data only) */}
            {!c && project.consultationAt && (
                <p className="mb-4 flex items-center gap-2 text-sm text-ink">
                    <CalendarClock className="size-4 text-gold-dark" />
                    The customer booked the consultation for <b>{formatDateTime(project.consultationAt)}</b>.
                </p>
            )}

            {/* Adviser revision G3: the online meeting link (or where a face-to-face one is held) */}
            {!c && project.consultationAt && project.consultationMeeting && (
                <MeetingLinkForm projectId={project.id} meeting={project.consultationMeeting} />
            )}
            {notBooked ? (
                <WaitingNotice>
                    <p>Waiting for the customer to book the consultation.</p>
                    {project.consultationNote && <p className="mt-1 text-ink-soft">Last booking: {project.consultationNote}</p>}
                </WaitingNotice>
            ) : editing ? (
                <ConsultationForm
                    request={project}
                    saving={saving}
                    serverErrors={serverErrors}
                    onCancel={() => setEditing(false)}
                    onSave={save}
                />
            ) : (
                <div className="grid gap-4">
                    {c && <ConsultationSummary consultation={c} />}
                    {(!c || canUpdate) && (
                        <div className="flex justify-end">
                            <GoldButton
                                onClick={() => {
                                    setServerErrors({});
                                    setEditing(true);
                                }}
                            >
                                <ClipboardList className="size-4" />
                                {c ? 'Update Consultation' : 'Record Consultation'}
                            </GoldButton>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}