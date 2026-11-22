import { router } from '@inertiajs/react';
import { Ban, CheckCircle2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DangerButton, Field, GoldButton, OutlineButton, Panel, Pill, cx, textareaClass } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import { Section, formatDateTime } from '@/components/project-manager/request-details';
import { PROJECTS_URL, StepIntro } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { EXECUTION_STATUSES, STATUSES_NEEDING_REMARKS } from '@/data/project-manager/execution';
import type { ExecutionStatus, PhaseKey, SetUpHead, StatusUpdate } from '@/data/project-manager/execution';
import { executionStatus } from '@/data/project-manager/projects';
import type { ProjectStatus } from '@/data/project-manager/projects';

/*
 * Backlog #35: the project's status.
 * Revision (leader, Nov 19):
 *   - The status follows the steps (Consultation, Ocular Visit, ... Installation) by itself.
 *   - In the last step, "Completed", the Project Manager marks the project as Completed or Cancelled.
 *   - A project can also be cancelled from any step ("Cancel Project" at the top of the project page).
 * Acceptance criteria:
 *   1. The status and remarks are saved; Cancelled cannot be saved without remarks.
 *   2. Cancelling emails a cancellation notice to both Team Leaders (the Heads).
 */

/** Colour of each project status, used by the Projects list, the project page and the Owner. */
export const projectStatusTone: Record<ProjectStatus, PillTone> = {
    Consultation: 'gray',
    'Ocular Visit': 'blue',
    Design: 'purple',
    Contract: 'cream',
    Fabrication: 'yellow',
    Installation: 'yellow',
    Completed: 'green',
    Cancelled: 'red',
};

const statusTone: Record<ExecutionStatus, PillTone> = { Completed: 'green', Cancelled: 'red' };

type StatusErrors = { status?: string; remarks?: string };

type SaveArgs = StepProps & {
    setUpHeads: SetUpHead[];
    status: ExecutionStatus;
    remarks: string;
    onDone: () => void;
    setSaving: (saving: boolean) => void;
    setErrors: (errors: StatusErrors) => void;
};

/** Saves a new status (shared by the Completed step and the Cancel Project form). */
function saveStatus({ project, usingSample, managerName, onSaved, setUpHeads, status, remarks, onDone, setSaving, setErrors }: SaveArgs) {
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
        } else toast.success('Project marked as Completed. The customer was notified of the completion.');
        onDone();
    };

    // Acceptance criterion 1: the status and remarks are saved and the project record is updated.
    if (usingSample) {
        const update: StatusUpdate = { status, remarks: remarks || null, updatedBy: managerName, updatedAt: new Date().toISOString() };
        onSaved({ ...project, statusUpdates: [...project.statusUpdates, update] });
        finish();
        return;
    }

    router.patch(
        `${PROJECTS_URL}/${project.id}/status`,
        { status, remarks: remarks || null },
        {
            preserveScroll: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onSuccess: finish,
            onError: (err) => setErrors(err),
        },
    );
}

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
    if (!phase.workOrder || executionStatus(project) !== null) return null;

    const markCompleted = () => {
        const finish = () =>
            toast.success(
                phaseKey === 'fabrication'
                    ? 'Fabrication marked as completed. The Installation step is now open.'
                    : 'Installation marked as completed. The project can now be marked as Completed in the last step.',
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

/* ---------- Cancel Project (any step) ---------- */

type CancelProps = StepProps & { setUpHeads: SetUpHead[]; onClose: () => void };

/** The form under the project header when the Project Manager clicks "Cancel Project". */
export function CancelProjectForm({ onClose, ...props }: CancelProps) {
    const [remarks, setRemarks] = useState('');
    const [errors, setErrors] = useState<StatusErrors>({});
    const [saving, setSaving] = useState(false);

    const submit = () => {
        const text = remarks.trim();
        // Acceptance criterion 1: a cancellation without remarks is never saved.
        if (!text) {
            setErrors({ remarks: 'Remarks are required when the project is cancelled.' });
            return;
        }
        saveStatus({ ...props, status: 'Cancelled', remarks: text, onDone: onClose, setSaving, setErrors });
    };

    return (
        <Panel className="mb-5 border border-red-300">
            <form
                noValidate
                className="grid gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                <div>
                    <h2 className="text-lg font-bold text-ink">Cancel this project?</h2>
                    <p className="text-sm text-ink-soft">
                        The remaining steps will be closed. A cancellation notice is emailed to the Team Leaders and the customer is notified.
                    </p>
                </div>
                <Field label="Remarks" htmlFor="cancel-remarks" required error={errors.remarks}>
                    <textarea
                        id="cancel-remarks"
                        autoFocus
                        value={remarks}
                        onChange={(e) => {
                            setRemarks(e.target.value);
                            if (errors.remarks) setErrors({});
                        }}
                        placeholder="e.g. The customer cancelled the event due to a family emergency."
                        className={cx(textareaClass, errors.remarks && 'border-red-500')}
                    />
                </Field>
                {errors.remarks && (
                    <p role="alert" className="text-sm font-semibold text-red-700">
                        The project was not cancelled.
                    </p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                    <OutlineButton onClick={onClose} disabled={saving}>
                        Keep Project
                    </OutlineButton>
                    <DangerButton type="submit" disabled={saving}>
                        <Ban className="size-4" /> {saving ? 'Cancelling...' : 'Confirm Cancellation'}
                    </DangerButton>
                </div>
            </form>
        </Panel>
    );
}

/* ---------- Step 7 · Completed ---------- */

type StatusProps = StepProps & { setUpHeads: SetUpHead[] };

export default function ProjectStatusPanel(props: StatusProps) {
    const { project } = props;
    const current = executionStatus(project);
    const bothDone = Boolean(project.execution?.fabrication.completion && project.execution?.installation.completion);

    const [status, setStatus] = useState<ExecutionStatus | ''>('');
    const [remarks, setRemarks] = useState('');
    const [errors, setErrors] = useState<StatusErrors>({});
    const [saving, setSaving] = useState(false);

    const needsRemarks = status !== '' && STATUSES_NEEDING_REMARKS.includes(status);

    const save = () => {
        const text = remarks.trim();
        const e: StatusErrors = {};
        if (!status) e.status = 'Select Completed or Cancelled.';
        else if (status === 'Completed' && !bothDone) e.status = 'Mark fabrication and installation as completed first.';
        // Acceptance criterion 1: Cancelled without remarks is never saved.
        if (needsRemarks && !text) e.remarks = 'Remarks are required when the project is cancelled.';
        setErrors(e);
        if (Object.keys(e).length || !status) return;

        saveStatus({
            ...props,
            status,
            remarks: text,
            setSaving,
            setErrors,
            onDone: () => {
                setStatus('');
                setRemarks('');
            },
        });
    };

    const history = [...project.statusUpdates].reverse();

        return (
        <>
            <StepIntro title="Completed">
                Once fabrication and installation are both done, mark the project as Completed. Payments are still tracked in the Contract step.
            </StepIntro>

            <Section title="Project Status">
                <div className="grid gap-4">
                    {current ? (
                        <p className="text-sm text-ink">
                            {current === 'Completed'
                                ? 'This project is completed. Its payment status is still tracked in the Contract step.'
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
                                    {EXECUTION_STATUSES.map((s) => {
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
                                            : 'e.g. Event styling delivered. Teardown finished on Dec 28.'
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
                                <GoldButton type="submit" disabled={saving || !status}>
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
        </>
    );
}