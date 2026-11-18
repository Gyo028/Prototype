import { router } from '@inertiajs/react';
import { UserCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field, GoldButton, OutlineButton, cx, selectClass, textareaClass } from '@/components/dashboard/ui';
import { Detail, Section, formatDateTime } from '@/components/project-manager/request-details';
import { PROJECTS_URL, StepIntro } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { isStepComplete } from '@/data/project-manager/projects';
import type { DesignSpecialist } from '@/data/project-manager/projects';

/*
 * Step 3 · Design Assignment (backlog #21).
 * The Project Manager assigns a Design Specialist so they can prepare the design proposal.
 * Blocked when no specialist is selected or the project information is incomplete.
 */

type Errors = Partial<Record<'specialist' | 'project', string>>;

export default function DesignAssignmentStep({
    project,
    usingSample,
    managerName,
    onSaved,
    specialists,
}: StepProps & { specialists: DesignSpecialist[] }) {
    const [editing, setEditing] = useState(project.assignment === null);
    const [specialistId, setSpecialistId] = useState(project.assignment ? String(project.assignment.specialistId) : '');
    const [notes, setNotes] = useState(project.assignment?.notes ?? '');
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);

    const save = () => {
        // Acceptance criterion 2: no specialist, or incomplete project information, means no save.
        const e: Errors = {};
        if (!isStepComplete(project, 'consultation') || !isStepComplete(project, 'siteAssessment')) {
            e.project = 'The project information is incomplete. Complete the consultation and site assessment first.';
        }
        if (!specialistId) e.specialist = 'Select a Design Specialist.';
        setErrors(e);
        if (Object.keys(e).length) return;

        const specialist = specialists.find((s) => s.id === Number(specialistId));
        if (!specialist) return;

        const finish = () => {
            toast.success(`${specialist.name} is now assigned to ${project.code} and can start the design proposal.`);
            setEditing(false);
        };

        // Acceptance criterion 1: the assignment is saved and shared with the Design Specialist.
        if (usingSample) {
            onSaved({
                ...project,
                assignment: {
                    specialistId: specialist.id,
                    specialistName: specialist.name,
                    notes: notes.trim() || null,
                    assignedBy: managerName,
                    assignedAt: new Date().toISOString(),
                },
            });
            finish();
            return;
        }

        router.patch(
            `${PROJECTS_URL}/${project.id}/design-assignment`,
            { specialistId: specialist.id, notes: notes.trim() || null },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: finish,
                onError: (err) => setErrors({ specialist: err.specialistId, project: err.project }),
            },
        );
    };

    return (
        <>
            <StepIntro title="Design Assignment">
                Assign a Design Specialist so they can prepare the design proposal. They will see this project and its information once
                assigned.
            </StepIntro>

            {!editing && project.assignment ? (
                <div className="grid gap-4">
                    <Section title="Assigned Design Specialist">
                        <div className="grid grid-cols-2 gap-3">
                            <Detail label="Design Specialist">{project.assignment.specialistName}</Detail>
                            <Detail label="Assigned">
                                {formatDateTime(project.assignment.assignedAt)} by {project.assignment.assignedBy}
                            </Detail>
                            <div className="col-span-2">
                                <Detail label="Notes for the designer">{project.assignment.notes ?? 'No notes.'}</Detail>
                            </div>
                        </div>
                    </Section>
                    <div className="flex justify-end">
                        <GoldButton
                            onClick={() => {
                                setErrors({});
                                setEditing(true);
                            }}
                        >
                            <UserCheck className="size-4" /> Reassign
                        </GoldButton>
                    </div>
                </div>
            ) : (
                <form
                    noValidate
                    className="space-y-4 rounded-xl border border-gold/40 bg-gold/5 p-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        save();
                    }}
                >
                    <Field label="Design Specialist" htmlFor="da-specialist" required error={errors.specialist}>
                        <select
                            id="da-specialist"
                            value={specialistId}
                            onChange={(e) => {
                                setSpecialistId(e.target.value);
                                setErrors((x) => ({ ...x, specialist: undefined }));
                            }}
                            className={cx(selectClass, errors.specialist && 'border-red-500')}
                        >
                            <option value="">Select a Design Specialist</option>
                            {specialists.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name} ({s.activeProjects} active {s.activeProjects === 1 ? 'project' : 'projects'})
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Notes for the designer (optional)" htmlFor="da-notes">
                        <textarea
                            id="da-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. Client prefers pastel tones; keep the arch from the inspiration photo."
                            className={textareaClass}
                        />
                    </Field>

                    {errors.project && (
                        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-700">
                            {errors.project}
                        </div>
                    )}

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        {project.assignment && (
                            <OutlineButton onClick={() => setEditing(false)} disabled={saving}>
                                Cancel
                            </OutlineButton>
                        )}
                        <GoldButton type="submit" disabled={saving}>
                            {saving ? 'Assigning...' : 'Save Assignment'}
                        </GoldButton>
                    </div>
                </form>
            )}
        </>
    );
}
