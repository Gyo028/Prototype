import { router } from '@inertiajs/react';
import { CalendarDays, CalendarClock, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field, GoldButton, OutlineButton, cx, inputClass, selectClass, textareaClass } from '@/components/dashboard/ui';
import { Detail, Section, formatDate, formatDateTime } from '@/components/project-manager/request-details';
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
 * a missing Head or date blocks saving (2).
 * Decided with the user (Nov 26): one start date and one target completion date per phase
 * (the group's project_schedules); the phase's single activity is named after the phase.
 */

type Draft = Pick<ExecutionSchedule, PhaseKey>;

const newId = () => `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const emptyPhase = (): PhaseSchedule => ({
    headId: null,
    headName: null,
    activities: [{ id: newId(), activity: '', scheduledDate: '', targetDate: '' }],
});
const noErrors = (): ScheduleErrors => ({ fabrication: { activities: {} }, installation: { activities: {} } });

/** One phase as the backend expects it: the Head and one start / target completion date. */
const toForm = (phase: PhaseSchedule) => ({
    headId: phase.headId,
    activity: phase.activities[0]?.activity.trim() ?? '',
    startDate: phase.activities[0]?.scheduledDate ?? '',
    targetDate: phase.activities[0]?.targetDate ?? '',
});

/** The backend's errors ("fabrication.headId", "startDate", ...) in the editor's shape. */
function serverErrors(err: Record<string, string>, draft: Draft, only?: PhaseKey): ScheduleErrors {
    const e = noErrors();
    EXECUTION_PHASES.forEach(({ key }) => {
        const prefix = only ? (only === key ? '' : null) : `${key}.`;
        if (prefix === null) return;
        const id = draft[key].activities[0]?.id ?? '';
        if (err[`${prefix}headId`]) e[key].head = err[`${prefix}headId`];
        const activity = err[`${prefix}activity`];
        const scheduledDate = err[`${prefix}startDate`];
        const targetDate = err[`${prefix}targetDate`];
        if (activity || scheduledDate || targetDate) e[key].activities[id] = { activity, scheduledDate, targetDate };
    });
    return e;
}

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
            // Work orders (#33) are still sample data only, so the real page doesn't mention them yet.
            toast.success(
                mode === 'reschedule'
                    ? `${info.title} rescheduled.${usingSample ? ` Send the updated work order to ${draft[phaseKey].headName} below.` : ''}`
                    : `Schedule saved.${usingSample ? ` Send the work order to ${draft.fabrication.headName} below.` : ''}`,
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
        const data =
            mode === 'reschedule'
                ? { ...toForm(draft[phaseKey]), reason: text }
                : { fabrication: toForm(draft.fabrication), installation: toForm(draft.installation) };
        router.put(url, data, {
            preserveScroll: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onSuccess: finish,
            onError: (err) => {
                const e = err as Record<string, string>;
                setErrors(serverErrors(e, draft, mode === 'reschedule' ? phaseKey : undefined));
                if (e.reason) setReasonError(e.reason);
                if (e.schedule) toast.error(e.schedule);
            },
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
                            <b>The {info.title.toLowerCase()} schedule is saved.</b> Saved by {saved.savedBy}
                            {saved.savedAt ? ` on ${formatDateTime(saved.savedAt)}` : ''}.
                            {!phase.completion && phase.headName && !phase.workOrder && ` Send ${phase.headName} the work order below.`}
                            {!phase.headName && !phase.completion && ` No ${info.head} is assigned yet. Use Reschedule to assign one.`}
                        </CompletedNotice>
                        <PhaseSummary title={info.title} headLabel={info.head} phase={phase} />
                        {canReschedule && (
                            <div className="flex justify-end">
                                <OutlineButton onClick={startReschedule}>
                                    <CalendarClock className="size-4" /> Reschedule {info.title}
                                </OutlineButton>
                            </div>
                        )}
                        {/* Work order (backlog #33) */}
                        {!phase.completion && (
                        <WorkOrderPanel
                            project={project}
                            usingSample={usingSample}
                            managerName={managerName}
                            onSaved={onSaved}
                            phaseKey={phaseKey}
                            title={info.title}
                            setUpHeads={setUpHeads}
                        />
                        )}
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
                            ? 'Assign both Heads and fill in every activity, start date and target completion date.'
                            : 'Assign the Head, fill in the activity and both dates, and give the reason for rescheduling.'}
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
    const line = phase.activities[0] ?? { id: newId(), activity: '', scheduledDate: '', targetDate: '' };
    const e = errors.activities[line.id] ?? {};
    // One line per phase (decided with the user, Nov 27): the activity and its two dates.
    const setDates = (changes: { activity?: string; scheduledDate?: string; targetDate?: string }) => onChange({ activities: [{ ...line, ...changes }] });

    return (
        <Section title={`${title} Schedule`}>
            <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Activity" htmlFor={`${phaseKey}-activity`} required error={e.activity} className="sm:col-span-3">
                    <input
                        id={`${phaseKey}-activity`}
                        maxLength={255}
                        value={line.activity}
                        onChange={(ev) => setDates({ activity: ev.target.value })}
                        placeholder={
                            phaseKey === 'fabrication'
                                ? 'e.g. Build the stage backdrop, floral arch and welcome signage'
                                : 'e.g. Set up the stage, ceiling drapes and table centerpieces at the venue'
                        }
                        className={cx(inputClass, e.activity && 'border-red-500')}
                    />
                </Field>

                <Field label={headLabel} htmlFor={`${phaseKey}-head`} required error={errors.head}>
                    <select
                        id={`${phaseKey}-head`}
                        value={phase.headId ?? ''}
                        onChange={(ev) => {
                            const h = heads.find((x) => x.id === Number(ev.target.value));
                            onChange({ headId: h?.id ?? null, headName: h?.name ?? null });
                        }}
                        className={cx(selectClass, errors.head && 'border-red-500')}
                    >
                        <option value="">Select the {headLabel.toLowerCase()}...</option>
                        {heads.map((h) => (
                            <option key={h.id} value={h.id}>
                                {h.name} ({h.activeAssignments} active {h.activeAssignments === 1 ? 'project' : 'projects'})
                            </option>
                        ))}
                    </select>
                    {heads.length === 0 && <p className="mt-1 text-xs text-ink-soft">No active {headLabel} in the employee records.</p>}
                </Field>

                <Field label="Start date" htmlFor={`${phaseKey}-start`} required error={e.scheduledDate}>
                    <input
                        id={`${phaseKey}-start`}
                        type="date"
                        value={line.scheduledDate}
                        onChange={(ev) => setDates({ scheduledDate: ev.target.value })}
                        className={cx(inputClass, e.scheduledDate && 'border-red-500')}
                    />
                </Field>

                <Field label="Target completion date" htmlFor={`${phaseKey}-target`} required error={e.targetDate}>
                    <input
                        id={`${phaseKey}-target`}
                        type="date"
                        min={line.scheduledDate || undefined}
                        value={line.targetDate}
                        onChange={(ev) => setDates({ targetDate: ev.target.value })}
                        className={cx(inputClass, e.targetDate && 'border-red-500')}
                    />
                </Field>
            </div>
            {errors.general && <p className="mt-2 text-sm text-red-600">{errors.general}</p>}
        </Section>
    );
}

/** Read-only view of a saved phase. */
function PhaseSummary({ title, headLabel, phase }: { title: string; headLabel: string; phase: PhaseSchedule }) {
    const starts = phase.activities.map((a) => a.scheduledDate).sort();
    const targets = phase.activities.map((a) => a.targetDate).sort();

    return (
        <Section title={`${title} Schedule`}>
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-3">
                    <Detail label="Activity">{phase.activities.map((a) => a.activity).filter(Boolean).join('; ') || '—'}</Detail>
                </div>
                <Detail label={headLabel}>{phase.headName ?? 'Not assigned'}</Detail>
                <Detail label="Start date">
                    <CalendarDays className="mr-1 inline size-3.5 text-ink-soft" />
                    {starts[0] ? formatDate(starts[0]) : '—'}
                </Detail>
                <Detail label="Target completion date">{targets.at(-1) ? formatDate(targets.at(-1)!) : '—'}</Detail>
            </div>
            {phase.changes && phase.changes.length > 0 && (
                <div className="mt-4">
                    <p className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">Rescheduled</p>
                    <ul className="grid gap-2">
                        {[...phase.changes].reverse().map((c, i) => (
                            <li key={i} className="rounded-lg border border-black/10 p-3 text-sm">
                                <p className="text-ink">Reason: {c.reason}</p>
                                <p className="text-xs text-ink-soft">
                                    by {c.changedBy}
                                    {c.changedAt ? ` on ${formatDateTime(c.changedAt)}` : ''}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Section>
    );
}