import { router } from '@inertiajs/react';
import { CalendarDays, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field, GoldButton, OutlineButton, cx, inputClass, selectClass } from '@/components/dashboard/ui';
import { Section, formatDate, formatDateTime } from '@/components/project-manager/request-details';
import { CompletedNotice, PROJECTS_URL, StepIntro } from '@/components/project-manager/steps/step-ui';
import WorkOrderPanel from '@/components/project-manager/work-order';
import ProjectStatusPanel, { PhaseCompletion } from '@/components/project-manager/project-status';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { EXECUTION_PHASES, hasScheduleErrors, validateSchedule } from '@/data/project-manager/execution';
import type { ExecutionSchedule, PhaseKey, PhaseSchedule, ScheduleErrors, SetUpHead } from '@/data/project-manager/execution';
import { executionStatus } from '@/data/project-manager/projects';

/*
 * Step 8 · Execution (backlog #32).
 * Opens once the signed contract is approved (it does not wait for Payments).
 * The Project Manager schedules fabrication and installation and assigns the
 * Fabrication Head and the Installation Head ("Manage Project Execution" use case).
 *   - The schedule is saved with every activity, scheduled date and target completion date,
 *     and a work order is sent to each Head (acceptance criterion 1).
 *   - A missing Head, activity or date blocks saving (acceptance criterion 2).
 */

type Draft = Pick<ExecutionSchedule, PhaseKey>;

const newId = () => `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const emptyPhase = (): PhaseSchedule => ({ headId: null, headName: null, activities: [{ id: newId(), activity: '', scheduledDate: '', targetDate: '' }] });
const noErrors = (): ScheduleErrors => ({ fabrication: { activities: {} }, installation: { activities: {} } });

type Props = StepProps & { setUpHeads: SetUpHead[] };

export default function ExecutionStep({ project, usingSample, managerName, onSaved, setUpHeads }: Props) {
    const saved = project.execution;
    const [editing, setEditing] = useState(saved === null);
    const [draft, setDraft] = useState<Draft>(() => saved ?? { fabrication: emptyPhase(), installation: emptyPhase() });
    const [errors, setErrors] = useState<ScheduleErrors>(noErrors);
    const [saving, setSaving] = useState(false);

    const tried = hasScheduleErrors(errors);

        // The schedule is locked once work is recorded as done or the project is completed / cancelled (backlog #35).
    const locked =
        Boolean(saved?.fabrication.completion || saved?.installation.completion) ||
        ['Completed', 'Cancelled'].includes(executionStatus(project));

    // Re-check as the Project Manager types, but only after a failed save.
    const change = (next: Draft) => {
        setDraft(next);
        if (tried) setErrors(validateSchedule(next));
    };

    const updatePhase = (key: PhaseKey, changes: Partial<PhaseSchedule>) => change({ ...draft, [key]: { ...draft[key], ...changes } });

    const save = () => {
        // Acceptance criterion 2: incomplete scheduling information is never saved.
        const e = validateSchedule(draft);
        setErrors(e);
        if (hasScheduleErrors(e)) return;

        const wasSaved = saved !== null;
        const finish = () => {
            toast.success(
                `${wasSaved ? 'Schedule updated' : 'Schedule saved'}. Send the work orders to ${draft.fabrication.headName} (Fabrication) and ${draft.installation.headName} (Installation) below.`,
            );
            setEditing(false);
        };

        // Acceptance criterion 1: the schedule is saved with every required detail.
        if (usingSample) {
            onSaved({
                ...project,
                execution: {
                    fabrication: { ...draft.fabrication, workOrder: null },
                    installation: { ...draft.installation, workOrder: null },
                    savedBy: managerName,
                    savedAt: new Date().toISOString(),
                },
            });
            finish();
            return;
        }

        router.put(`${PROJECTS_URL}/${project.id}/execution-schedule`, draft, {
            preserveScroll: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onSuccess: finish,
        });
    };

    const cancel = () => {
        if (saved) setDraft(saved);
        setErrors(noErrors());
        setEditing(false);
    };

    return (
        <>
            <StepIntro title="Execution">
                Schedule fabrication and installation and assign the responsible Heads. This step opens once the contract is approved and runs
                alongside Payments.
            </StepIntro>

            <div className="grid gap-4">
                {saved && !editing && (
                    <CompletedNotice>
                        <b>The fabrication and installation schedule is saved.</b> Work orders were sent to the assigned Heads. Saved by{' '}
                        {saved.savedBy} on {formatDateTime(saved.savedAt)}.
                    </CompletedNotice>
                )}

                {EXECUTION_PHASES.map(({ key, title, head }) =>
                    editing ? (
                        <PhaseEditor
                            key={key}
                            phaseKey={key}
                            title={title}
                            headLabel={head}
                            phase={draft[key]}
                            errors={errors[key]}
                            heads={setUpHeads.filter((h) => h.phase === key)}
                            onChange={(changes) => updatePhase(key, changes)}
                        />
                    ) : (
                        saved && (
                            <div key={key} className="grid gap-3">
                                <PhaseSummary title={title} headLabel={head} phase={saved[key]} />
                                <WorkOrderPanel
                                    project={project}
                                    usingSample={usingSample}
                                    managerName={managerName}
                                    onSaved={onSaved}
                                    phaseKey={key}
                                    title={title}
                                    setUpHeads={setUpHeads}
                                />
                                <PhaseCompletion
                                    project={project}
                                    usingSample={usingSample}
                                    managerName={managerName}
                                    onSaved={onSaved}
                                    phaseKey={key}
                                    title={title}
                                />
                            </div>
                        )
                    ),
                )}

                {editing && tried && (
                    <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700">
                        The schedule was not saved. Assign both Heads and fill in every activity, scheduled date and target completion date.
                    </p>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    {editing ? (
                        <>
                            {saved && (
                                <OutlineButton onClick={cancel} disabled={saving}>
                                    Cancel
                                </OutlineButton>
                            )}
                            <GoldButton onClick={save} disabled={saving}>
                                <Send className="size-4" /> {saving ? 'Saving...' : saved ? 'Save Changes' : 'Save Schedule'}
                            </GoldButton>
                        </>
                                        ) : (
                        !locked && (
                            <OutlineButton onClick={() => setEditing(true)}>
                                <Pencil className="size-4" /> Edit Schedule
                            </OutlineButton>
                        )
                    )}
                </div>

                {!editing && (
                    <ProjectStatusPanel
                        project={project}
                        usingSample={usingSample}
                        managerName={managerName}
                        onSaved={onSaved}
                        setUpHeads={setUpHeads}
                    />
                )}
            </div>
        </>
    );
}

/* ---------- one phase (Fabrication or Installation) ---------- */

type EditorProps = {
    phaseKey: PhaseKey;
    title: string;
    headLabel: string;
    phase: PhaseSchedule;
    errors: ScheduleErrors[PhaseKey];
    heads: SetUpHead[];
    onChange: (changes: Partial<PhaseSchedule>) => void;
};

function PhaseEditor({ phaseKey, title, headLabel, phase, errors, heads, onChange }: EditorProps) {
    const updateActivity = (id: string, changes: Partial<PhaseSchedule['activities'][number]>) =>
        onChange({ activities: phase.activities.map((a) => (a.id === id ? { ...a, ...changes } : a)) });

    return (
        <Section title={`${title} Schedule`}>
            <div className="grid gap-4">
                <Field label={headLabel} htmlFor={`${phaseKey}-head`} required error={errors.head}>
                    <select
                        id={`${phaseKey}-head`}
                        value={phase.headId ?? ''}
                        onChange={(e) => {
                            const h = heads.find((x) => x.id === Number(e.target.value));
                            onChange({ headId: h?.id ?? null, headName: h?.name ?? null });
                        }}
                        className={cx(selectClass, 'sm:max-w-sm', errors.head && 'border-red-500')}
                    >
                        <option value="">Select the {headLabel.toLowerCase()}...</option>
                        {heads.map((h) => (
                            <option key={h.id} value={h.id}>
                                {h.name} ({h.activeAssignments} active {h.activeAssignments === 1 ? 'project' : 'projects'})
                            </option>
                        ))}
                    </select>
                </Field>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="text-xs text-ink-soft uppercase">
                            <tr>
                                <th className="pb-2 font-medium">
                                    Activity<span className="text-red-600"> *</span>
                                </th>
                                <th className="w-44 pb-2 font-medium">
                                    Scheduled date<span className="text-red-600"> *</span>
                                </th>
                                <th className="w-44 pb-2 font-medium">
                                    Target completion<span className="text-red-600"> *</span>
                                </th>
                                <th className="w-10 pb-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {phase.activities.map((a) => {
                                const e = errors.activities[a.id] ?? {};
                                return (
                                    <tr key={a.id} className="align-top">
                                        <td className="py-1.5 pr-2">
                                            <input
                                                aria-label={`${title} activity`}
                                                value={a.activity}
                                                onChange={(ev) => updateActivity(a.id, { activity: ev.target.value })}
                                                placeholder={phaseKey === 'fabrication' ? 'e.g. Build the floral entrance arch' : 'e.g. Venue set-up and styling'}
                                                className={cx(inputClass, e.activity && 'border-red-500')}
                                            />
                                            {e.activity && <p className="mt-1 text-xs text-red-600">{e.activity}</p>}
                                        </td>
                                        <td className="py-1.5 pr-2">
                                            <input
                                                aria-label={`${title} scheduled date`}
                                                type="date"
                                                value={a.scheduledDate}
                                                onChange={(ev) => updateActivity(a.id, { scheduledDate: ev.target.value })}
                                                className={cx(inputClass, e.scheduledDate && 'border-red-500')}
                                            />
                                            {e.scheduledDate && <p className="mt-1 text-xs text-red-600">{e.scheduledDate}</p>}
                                        </td>
                                        <td className="py-1.5 pr-2">
                                            <input
                                                aria-label={`${title} target completion date`}
                                                type="date"
                                                min={a.scheduledDate || undefined}
                                                value={a.targetDate}
                                                onChange={(ev) => updateActivity(a.id, { targetDate: ev.target.value })}
                                                className={cx(inputClass, e.targetDate && 'border-red-500')}
                                            />
                                            {e.targetDate && <p className="mt-1 text-xs text-red-600">{e.targetDate}</p>}
                                        </td>
                                        <td className="py-1.5 pt-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => onChange({ activities: phase.activities.filter((x) => x.id !== a.id) })}
                                                aria-label={`Remove ${a.activity || 'this activity'}`}
                                                className="rounded p-1 text-ink-soft hover:bg-black/5 hover:text-red-600"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {errors.general && <p className="text-sm text-red-600">{errors.general}</p>}

                <div>
                    <OutlineButton
                        onClick={() =>
                            onChange({ activities: [...phase.activities, { id: newId(), activity: '', scheduledDate: '', targetDate: '' }] })
                        }
                    >
                        <Plus className="size-4" /> Add Activity
                    </OutlineButton>
                </div>
            </div>
        </Section>
    );
}

/** Read-only view of a saved phase. */
function PhaseSummary({ title, headLabel, phase }: { title: string; headLabel: string; phase: PhaseSchedule }) {
    return (
        <Section title={`${title} Schedule`}>
            <p className="mb-3 text-sm text-ink">
                {headLabel}: <b>{phase.headName}</b>
            </p>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="text-xs text-ink-soft uppercase">
                        <tr>
                            <th className="pb-2 font-medium">Activity</th>
                            <th className="pb-2 font-medium">Scheduled date</th>
                            <th className="pb-2 font-medium">Target completion</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                        {phase.activities.map((a) => (
                            <tr key={a.id}>
                                <td className="py-2 pr-4 text-ink">{a.activity}</td>
                                <td className="py-2 pr-4 text-ink">
                                    <CalendarDays className="mr-1 inline size-3.5 text-ink-soft" />
                                    {formatDate(a.scheduledDate)}
                                </td>
                                <td className="py-2 text-ink">{formatDate(a.targetDate)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Section>
    );
}