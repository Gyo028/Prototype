import { router } from '@inertiajs/react';
import { CalendarDays, CalendarClock, Plus, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field, GoldButton, OutlineButton, cx, inputClass, selectClass, textareaClass } from '@/components/dashboard/ui';
import { Section, formatDate, formatDateTime } from '@/components/project-manager/request-details';
import { CompletedNotice, PROJECTS_URL, StepIntro, WaitingNotice } from '@/components/project-manager/steps/step-ui';
import WorkOrderPanel from '@/components/project-manager/work-order';
import { PhaseCompletion } from '@/components/project-manager/project-status';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { EXECUTION_PHASES, hasScheduleErrors, validateSchedule } from '@/data/project-manager/execution';
import type { ExecutionSchedule, PhaseKey, PhaseSchedule, ScheduleErrors, SetUpHead } from '@/data/project-manager/execution';
import { executionStatus } from '@/data/project-manager/projects';

/*
 * Step 5 · Fabrication and Step 6 · Installation (backlogs #32, #33, #35).
 * Revision (leader, Nov 19): Execution is split into two steps.
 *   - Fabrication opens once the contract is approved and the down payment is paid.
 *     Its first visit saves the whole schedule: both Heads, every activity and date (#32).
 *   - Installation opens once fabrication is marked as completed.
 *   - Each step shows its own schedule, work order (#33) and completion (#35).
 *   - Rescheduling a phase after it was saved needs a reason, and its work order must be re-sent.
 * #32 acceptance criteria: the schedule is saved with every required detail (1);
 * a missing Head, activity or date blocks saving (2).
 */

type Draft = Pick<ExecutionSchedule, PhaseKey>;

const newId = () => `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const emptyPhase = (): PhaseSchedule => ({ headId: null, headName: null, activities: [{ id: newId(), activity: '', scheduledDate: '', targetDate: '' }] });
const noErrors = (): ScheduleErrors => ({ fabrication: { activities: {} }, installation: { activities: {} } });

type Props = StepProps & { setUpHeads: SetUpHead[]; phaseKey: PhaseKey };

export default function ExecutionStep({ project, usingSample, managerName, onSaved, setUpHeads, phaseKey }: Props) {
    const saved = project.execution;
    const info = EXECUTION_PHASES.find((x) => x.key === phaseKey)!;
    const phase = saved?.[phaseKey];

    // null = viewing; 'new' = first schedule (both phases); 'reschedule' = changing this phase only
    const [mode, setMode] = useState<'new' | 'reschedule' | null>(saved === null && phaseKey === 'fabrication' ? 'new' : null);
    const [draft, setDraft] = useState<Draft>(() => saved ?? { fabrication: emptyPhase(), installation: emptyPhase() });
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState('');
        const [errors, setErrors] = useState<ScheduleErrors>(noErrors);
    const [saving, setSaving] = useState(false);

    const tried = hasScheduleErrors(errors);

    // A phase can no longer be rescheduled once its work is done or the project is completed / cancelled.
    const canReschedule = Boolean(phase) && !phase?.completion && executionStatus(project) === null;

    // Re-check as the Project Manager types, but only after a failed save.
    const change = (next: Draft) => {
        setDraft(next);
        if (tried) setErrors(validateSchedule(next));
    };

    const updatePhase = (key: PhaseKey, changes: Partial<PhaseSchedule>) => change({ ...draft, [key]: { ...draft[key], ...changes } });

    const startReschedule = () => {
        if (saved) setDraft(saved);
        setReason('');
        setReasonError('');
        setErrors(noErrors());
        setMode('reschedule');
    };

    const cancelEdit = () => {
        if (saved) setDraft(saved);
        setErrors(noErrors());
        setReasonError('');
        setMode(null);
    };

        const save = () => {
        // #32 acceptance criterion 2: incomplete scheduling information is never saved.
        const e = validateSchedule(draft);
        setErrors(e);
        const text = reason.trim();
        const missingReason = mode === 'reschedule' && !text;
        setReasonError(missingReason ? 'Give the reason for rescheduling.' : '');
        if (hasScheduleErrors(e) || missingReason) return;

        const now = new Date().toISOString();
        const next: ExecutionSchedule =
            mode === 'new' || !saved
                ? {
                      fabrication: { ...draft.fabrication, workOrder: null },
                      installation: { ...draft.installation, workOrder: null },
                      savedBy: managerName,
                      savedAt: now,
                  }
                : {
                      ...saved,
                      // A changed phase needs a new work order (#33), so its sent one is cleared.
                      [phaseKey]: {
                          ...draft[phaseKey],
                          workOrder: null,
                          changes: [...(saved[phaseKey].changes ?? []), { reason: text, changedBy: managerName, changedAt: now }],
                      },
                  };

        const finish = () => {
            toast.success(
                mode === 'reschedule'
                    ? `${info.title} rescheduled. Send the updated work order to ${draft[phaseKey].headName} below.`
                    : `Schedule saved. Send the work order to ${draft.fabrication.headName} below.`,
            );
            setMode(null);
        };

        // #32 acceptance criterion 1: the schedule is saved with every required detail.
        if (usingSample) {
            onSaved({ ...project, execution: next });
            finish();
            return;
        }

        const url =
            mode === 'reschedule'
                ? `${PROJECTS_URL}/${project.id}/execution-schedule/${phaseKey}/reschedule`
                : `${PROJECTS_URL}/${project.id}/execution-schedule`;
        router.put(url, mode === 'reschedule' ? { ...draft[phaseKey], reason: text } : draft, {
            preserveScroll: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onSuccess: finish,
        });
    };

    // Which phases the editor shows: both for the first schedule, only this one when rescheduling.
    const editing = mode === 'new' ? EXECUTION_PHASES : mode === 'reschedule' ? [info] : [];

        return (
        <>
            <StepIntro title={info.title}>
                {phaseKey === 'fabrication'
                    ? 'Schedule fabrication and installation, assign the Heads, and send the Fabrication Head the work order.'
                    : 'Send the Installation Head the work order and record when installation is done.'}
            </StepIntro>

            <div className="grid gap-4">
                {!saved && phaseKey === 'installation' && (
                    <WaitingNotice>The schedule has not been saved yet. Save it in the Fabrication step first.</WaitingNotice>
                )}

                {saved && phase && mode === null && (
                    <>
                        <CompletedNotice>
                            <b>The {info.title.toLowerCase()} schedule is saved.</b> Saved by {saved.savedBy} on {formatDateTime(saved.savedAt)}.
                            {!phase.completion && ` Send ${phase.headName} the work order below.`}
                        </CompletedNotice>
                        <PhaseSummary title={info.title} headLabel={info.head} phase={phase} />
                        {canReschedule && (
                            <div className="flex justify-end">
                                <OutlineButton onClick={startReschedule}>
                                    <CalendarClock className="size-4" /> Reschedule {info.title}
                                </OutlineButton>
                            </div>
                        )}
                        <WorkOrderPanel
                            project={project}
                            usingSample={usingSample}
                            managerName={managerName}
                            onSaved={onSaved}
                            phaseKey={phaseKey}
                            title={info.title}
                            setUpHeads={setUpHeads}
                        />
                        <PhaseCompletion
                            project={project}
                            usingSample={usingSample}
                            managerName={managerName}
                            onSaved={onSaved}
                            phaseKey={phaseKey}
                            title={info.title}
                        />
                    </>
                )}

                {editing.map(({ key, title, head }) => (
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
                ))}

                                {mode === 'reschedule' && (
                    <Field label="Reason for rescheduling" htmlFor="reschedule-reason" required error={reasonError}>
                        <textarea
                            id="reschedule-reason"
                            value={reason}
                            onChange={(e) => {
                                setReason(e.target.value);
                                if (reasonError) setReasonError('');
                            }}
                            placeholder="e.g. The venue moved the set-up day to Feb 13."
                            className={cx(textareaClass, reasonError && 'border-red-500')}
                        />
                    </Field>
                )}

                {mode !== null && (tried || reasonError) && (
                    <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700">
                        The schedule was not saved.{' '}
                        {mode === 'new'
                            ? 'Assign both Heads and fill in every activity, scheduled date and target completion date.'
                            : 'Fill in every activity and date, and give the reason for rescheduling.'}
                    </p>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    {mode !== null ? (
                        <>
                            {saved && (
                                <OutlineButton onClick={cancelEdit} disabled={saving}>
                                    Cancel
                                </OutlineButton>
                            )}
                            <GoldButton onClick={save} disabled={saving}>
                                <Send className="size-4" /> {saving ? 'Saving...' : mode === 'reschedule' ? 'Save New Schedule' : 'Save Schedule'}
                            </GoldButton>
                        </>
                        ) : null}
                </div>
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
                        {phase.changes && phase.changes.length > 0 && (
                <div className="mt-4">
                    <p className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">Rescheduled</p>
                    <ul className="grid gap-2">
                        {[...phase.changes].reverse().map((c) => (
                            <li key={c.changedAt} className="rounded-lg border border-black/10 p-3 text-sm">
                                <p className="text-ink">Reason: {c.reason}</p>
                                <p className="text-xs text-ink-soft">
                                    by {c.changedBy} on {formatDateTime(c.changedAt)}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Section>
    );
}