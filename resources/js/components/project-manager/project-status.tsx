import { router } from '@inertiajs/react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field, GoldButton, OutlineButton, Pill, cx, textareaClass } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import { Section, formatDateTime } from '@/components/project-manager/request-details';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { EXECUTION_STATUSES, STATUSES_NEEDING_REMARKS } from '@/data/project-manager/execution';
import type { ExecutionStatus, PhaseKey, SetUpHead, StatusUpdate } from '@/data/project-manager/execution';
import { executionStatus } from '@/data/project-manager/projects';

/*
 * Backlog #35: update the project's status (In Progress, Rescheduled, Completed or Cancelled).
 * Shown in step 8 (Execution), together with each assignment's completion ("Manage Project Execution" use case).
 *   - The status and remarks are saved and the project record is updated (acceptance criterion 1).
 *   - Rescheduled and Cancelled cannot be saved without remarks (acceptance criterion 1).
 *   - Cancelling emails a cancellation notice to both Team Leaders (acceptance criterion 2).
 *   - Completed is only possible once fabrication and installation are both completed (Use Case).
 */

export const statusTone: Record<ExecutionStatus, PillTone> = {
    'In Progress': 'yellow',
    Rescheduled: 'blue',
    Completed: 'green',
    Cancelled: 'red',
};

const isFinal = (s: ExecutionStatus) => s === 'Completed' || s === 'Cancelled';

/* ---------- one assignment's completion ---------- */

type CompletionProps = StepProps & { phaseKey: PhaseKey; title: string };

/** "Mark as Completed" for the Fabrication or Installation assignment. */
export function PhaseCompletion({ project, usingSample, managerName, onSaved, phaseKey, title }: CompletionProps) {
    const execution = project.execution;
    const phase = execution?.[phaseKey];
    if (!execution || !phase) return null;

    if (phase.completion) {
        return (
            <p className="flex items-start gap-2 rounded-xl border border-green-300 bg-green-50 p-3 text-sm text-ink">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                <span>
                    <b>{title} completed.</b> Recorded by {phase.completion.completedBy} on {formatDateTime(phase.completion.completedAt)}.
                </span>
            </p>
        );
    }

    // The work order goes out before the work is done, and a cancelled project takes no more updates.
    if (!phase.workOrder || isFinal(executionStatus(project))) return null;

    const otherKey: PhaseKey = phaseKey === 'fabrication' ? 'installation' : 'fabrication';
    const otherDone = Boolean(execution[otherKey].completion);

    const markCompleted = () => {
        const finish = () =>
            toast.success(
                otherDone
                    ? `${title} marked as completed. Both assignments are done, so the project can now be marked as Completed.`
                    : `${title} marked as completed. The customer was notified that ${title.toLowerCase()} is finished.`,
            );

        if (usingSample) {
            const completion = { completedBy: managerName, completedAt: new Date().toISOString() };
            onSaved({ ...project, execution: { ...execution, [phaseKey]: { ...phase, completion } } });
            finish();
            return;
        }

        router.patch(`${PROJECTS_URL}/${project.id}/assignments/${phaseKey}/complete`, {}, { preserveScroll: true, onSuccess: finish });
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-black/15 p-3">
            <p className="text-sm text-ink-soft">Is the {title.toLowerCase()} work finished?</p>
            <OutlineButton onClick={markCompleted}>
                <CheckCircle2 className="size-4" /> Mark {title} as Completed
            </OutlineButton>
        </div>
    );
}

/* ---------- project status ---------- */

type StatusProps = StepProps & { setUpHeads: SetUpHead[] };

export default function ProjectStatusPanel({ project, usingSample, managerName, onSaved, setUpHeads }: StatusProps) {
    const current = executionStatus(project);
    const bothDone = Boolean(project.execution?.fabrication.completion && project.execution?.installation.completion);

    const [status, setStatus] = useState<ExecutionStatus | ''>('');
    const [remarks, setRemarks] = useState('');
    const [errors, setErrors] = useState<{ status?: string; remarks?: string }>({});
    const [saving, setSaving] = useState(false);

    const options = EXECUTION_STATUSES.filter((s) => s !== current);
    const needsRemarks = status !== '' && STATUSES_NEEDING_REMARKS.includes(status);

    const save = () => {
        const text = remarks.trim();
        const e: typeof errors = {};
        if (!status) e.status = 'Select the new project status.';
        else if (status === 'Completed' && !bothDone) e.status = 'Mark fabrication and installation as completed first.';
        // Acceptance criterion 1: Rescheduled / Cancelled without remarks is never saved.
        if (needsRemarks && !text) e.remarks = `Remarks are required when the project is ${status === 'Cancelled' ? 'cancelled' : 'rescheduled'}.`;
        setErrors(e);
        if (Object.keys(e).length || !status) return;

        // Acceptance criterion 2: a cancellation is emailed to both Team Leaders.
        const heads = (['fabrication', 'installation'] as const)
            .map((k) => project.execution?.[k].headId)
            .map((id) => setUpHeads.find((h) => h.id === id))
            .filter((h): h is SetUpHead => h !== undefined);
        const reachable = heads.filter((h) => h.email);
        const unreachable = heads.filter((h) => !h.email);

        const finish = () => {
            if (status === 'Cancelled') {
                toast.success(
                    reachable.length
                        ? `Project cancelled. A cancellation notice was emailed to ${reachable.map((h) => h.name).join(' and ')}, and the customer was notified.`
                        : 'Project cancelled. The customer was notified. No Team Leaders were assigned yet.',
                );
                if (unreachable.length)
                    toast.warning(`The cancellation notice could not be sent to ${unreachable.map((h) => h.name).join(' and ')}: no email on record.`);
            } else if (status === 'Rescheduled') toast.success('Project status set to Rescheduled. The customer was notified.');
            else if (status === 'Completed') toast.success('Project marked as Completed. The customer was notified of the completion.');
            else toast.success('Project status set to In Progress. The customer was notified of the update.');
            setStatus('');
            setRemarks('');
        };

        // Acceptance criterion 1: the status and remarks are saved and the project record is updated.
        if (usingSample) {
            const update: StatusUpdate = { status, remarks: text || null, updatedBy: managerName, updatedAt: new Date().toISOString() };
            onSaved({ ...project, statusUpdates: [...project.statusUpdates, update] });
            finish();
            return;
        }

        router.patch(
            `${PROJECTS_URL}/${project.id}/status`,
            { status, remarks: text || null },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: finish,
                onError: (err) => setErrors(err),
            },
        );
    };

    const history = [...project.statusUpdates].reverse();

    return (
        <Section title="Project Status">
            <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
                    Current status: <Pill tone={statusTone[current]}>{current}</Pill>
                </div>

                {isFinal(current) ? (
                    <p className="text-sm text-ink-soft">
                        {current === 'Completed'
                            ? 'This project is completed. Its payment status is still tracked in Payments.'
                            : 'This project is cancelled. Its status can no longer be changed.'}
                    </p>
                ) : (
                    <form
                        noValidate
                        className="grid gap-4 rounded-xl border border-gold/40 bg-gold/5 p-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            save();
                        }}
                    >
                        <div className="grid gap-1.5">
                            <p className="text-sm text-ink">
                                New status<span className="text-red-600"> *</span>
                            </p>
                            <div role="radiogroup" aria-label="New status" className="flex flex-wrap gap-2">
                                {options.map((s) => {
                                    const locked = s === 'Completed' && !bothDone;
                                    return (
                                        <button
                                            key={s}
                                            type="button"
                                            role="radio"
                                            aria-checked={status === s}
                                            disabled={locked}
                                            title={locked ? 'Mark fabrication and installation as completed first' : undefined}
                                            onClick={() => {
                                                setStatus(s);
                                                setErrors({});
                                            }}
                                            className={cx(
                                                'rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
                                                status === s
                                                    ? 'border-gold bg-gold text-white'
                                                    : cx('bg-white text-ink hover:bg-gold/10', errors.status ? 'border-red-500' : 'border-black/15'),
                                            )}
                                        >
                                            {s}
                                        </button>
                                    );
                                })}
                            </div>
                            {!bothDone && <p className="text-xs text-ink-soft">Completed unlocks once fabrication and installation are both completed.</p>}
                            {status === 'Cancelled' && (
                                <p className="text-xs text-ink-soft">A cancellation notice will be emailed to both Team Leaders and the customer.</p>
                            )}
                            {errors.status && <p className="text-xs text-red-600">{errors.status}</p>}
                        </div>

                        <Field
                            label={needsRemarks ? 'Remarks' : 'Remarks (optional)'}
                            htmlFor="status-remarks"
                            required={needsRemarks}
                            error={errors.remarks}
                        >
                            <textarea
                                id="status-remarks"
                                value={remarks}
                                onChange={(e) => {
                                    setRemarks(e.target.value);
                                    if (errors.remarks) setErrors((x) => ({ ...x, remarks: undefined }));
                                }}
                                placeholder={
                                    status === 'Cancelled'
                                        ? 'e.g. The customer cancelled the event due to a family emergency.'
                                        : status === 'Rescheduled'
                                          ? 'e.g. The venue moved the event to Feb 20. Fabrication dates will be adjusted.'
                                          : 'e.g. Fabrication resumed after the materials arrived.'
                                }
                                className={cx(textareaClass, errors.remarks && 'border-red-500')}
                            />
                        </Field>

                        {(errors.status || errors.remarks) && (
                            <p role="alert" className="text-sm font-semibold text-red-700">
                                The project status was not updated.
                            </p>
                        )}

                        <div className="flex justify-end">
                            <GoldButton type="submit" disabled={saving}>
                                <RefreshCw className="size-4" /> {saving ? 'Updating...' : 'Update Status'}
                            </GoldButton>
                        </div>
                    </form>
                )}

                {history.length > 0 && (
                    <div>
                        <p className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">Status history</p>
                        <ul className="grid gap-2">
                            {history.map((u) => (
                                <li key={u.updatedAt} className="rounded-lg border border-black/10 p-3 text-sm">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Pill tone={statusTone[u.status]}>{u.status}</Pill>
                                        <span className="text-ink-soft">
                                            by {u.updatedBy} on {formatDateTime(u.updatedAt)}
                                        </span>
                                    </div>
                                    {u.remarks && <p className="mt-1 text-ink">Remarks: {u.remarks}</p>}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </Section>
    );
}