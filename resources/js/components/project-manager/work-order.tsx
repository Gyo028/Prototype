import { router } from '@inertiajs/react';
import { AlertTriangle, Mail, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field, GoldButton, OutlineButton, cx, textareaClass } from '@/components/dashboard/ui';
import { Detail, formatDate, formatDateTime } from '@/components/project-manager/request-details';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { workOrderProblems } from '@/data/project-manager/execution';
import type { PhaseKey, SetUpHead, WorkOrder } from '@/data/project-manager/execution';

/*
 * Backlog #33: email the work order to the assigned Fabrication / Installation Head.
 * Shown under each saved phase in step 8 (Execution).
 *   - The work order holds the project details, the schedule and the Project Manager's
 *     instructions, and is emailed to the Head (acceptance criterion 1).
 *   - If the Head (or their email) or the required work assignment information is missing,
 *     the work order cannot be sent (acceptance criterion 2).
 */

type Props = StepProps & { phaseKey: PhaseKey; title: string; setUpHeads: SetUpHead[] };

export default function WorkOrderPanel({ project, usingSample, managerName, onSaved, phaseKey, title, setUpHeads }: Props) {
    const phase = project.execution?.[phaseKey];
    const sent = phase?.workOrder ?? null;
    const head = setUpHeads.find((h) => h.id === phase?.headId);

    const [open, setOpen] = useState(false);
    const [instructions, setInstructions] = useState(sent?.instructions ?? '');
    const [tried, setTried] = useState(false);
    const [saving, setSaving] = useState(false);

    if (!phase || !project.execution) return null;

    const code = `WO-${project.code.replace('REQ-', '')}-${phaseKey === 'fabrication' ? 'F' : 'I'}`;
    const problems = workOrderProblems(phase, head, instructions);

    const send = () => {
        // Acceptance criterion 2: incomplete information means the email is never sent.
        setTried(true);
        if (problems.length || !head?.email) return;

        const finish = () => {
            toast.success(
                `Work order ${code} was emailed to ${head.name} (${head.email}). A work summary confirmation was sent to you.`,
            );
            setOpen(false);
            setTried(false);
        };

        // Acceptance criterion 1: the work order with the project instructions is sent to the Head.
        if (usingSample) {
            const workOrder: WorkOrder = {
                code,
                instructions: instructions.trim(),
                sentTo: head.name,
                sentToEmail: head.email,
                sentBy: managerName,
                sentAt: new Date().toISOString(),
            };
            onSaved({ ...project, execution: { ...project.execution!, [phaseKey]: { ...phase, workOrder } } });
            finish();
            return;
        }

        router.post(
            `${PROJECTS_URL}/${project.id}/work-orders/${phaseKey}`,
            { instructions: instructions.trim() },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: finish,
            },
        );
    };

        return (
        <div className="grid gap-3 rounded-xl border border-dashed border-black/15 p-4">
            {/* Status line */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                {sent ? (
                    <p className="flex items-start gap-2 text-sm text-ink">
                        <MailCheck className="mt-0.5 size-4 shrink-0 text-green-600" />
                        <span>
                            <b>Work order {sent.code}</b> was emailed to {sent.sentTo} ({sent.sentToEmail}) by {sent.sentBy} on{' '}
                            {formatDateTime(sent.sentAt)}.
                        </span>
                    </p>
                ) : (
                    <p className="flex items-start gap-2 text-sm text-ink-soft">
                        <Mail className="mt-0.5 size-4 shrink-0" />
                        The {title.toLowerCase()} work order has not been sent to the Head yet.
                    </p>
                )}
                {!open && (
                    <OutlineButton onClick={() => setOpen(true)}>
                        <Mail className="size-4" /> {sent ? 'View / Resend Work Order' : 'Prepare Work Order'}
                    </OutlineButton>
                )}
            </div>

            {/* The work order */}
            {open && (
                <div className="grid gap-4 rounded-xl border border-gold/40 bg-gold/5 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-base font-bold text-ink">
                            Work Order {code} · {title}
                        </p>
                        <p className="text-sm text-ink-soft">
                            To: {head ? `${head.name} (${head.email ?? 'no email on record'})` : 'no Head assigned'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Detail label="Project">{project.code}</Detail>
                        <Detail label="Event">
                            {project.eventType} · {formatDate(project.eventDate)}
                        </Detail>
                        <Detail label="Customer">{project.customer.name}</Detail>
                        <Detail label="Venue">{project.venue}</Detail>
                    </div>

                    <div>
                        <p className="mb-1 text-xs text-ink-soft">Assigned work</p>
                        <ul className="list-disc pl-5 text-sm text-ink">
                            {phase.activities.map((a) => (
                                <li key={a.id}>
                                    {a.activity || <i>(no activity name)</i>} · {a.scheduledDate ? formatDate(a.scheduledDate) : '—'} to{' '}
                                    {a.targetDate ? formatDate(a.targetDate) : '—'}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {project.designProposal?.notes && <Detail label="Approved design notes">{project.designProposal.notes}</Detail>}

                    <Field
                        label="Project instructions for the Head"
                        htmlFor={`wo-instructions-${phaseKey}`}
                        required
                        error={tried && !instructions.trim() ? 'Write the project instructions for the Head.' : undefined}
                    >
                        <textarea
                            id={`wo-instructions-${phaseKey}`}
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder={
                                phaseKey === 'fabrication'
                                    ? 'e.g. Use the pastel palette from the approved design. Deliver all pieces to the warehouse by the target date.'
                                    : 'e.g. Ingress at 7:00 AM. Coordinate with the venue coordinator before setting up the stage.'
                            }
                            className={cx(textareaClass, tried && !instructions.trim() && 'border-red-500')}
                        />
                    </Field>

                    {tried && problems.length > 0 && (
                        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                            <div>
                                <p className="font-bold">The work order was not sent. The information is incomplete:</p>
                                <ul className="mt-1 list-disc pl-5">
                                    {problems.map((p) => (
                                        <li key={p}>{p}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <OutlineButton
                            onClick={() => {
                                setOpen(false);
                                setTried(false);
                            }}
                            disabled={saving}
                        >
                            Cancel
                        </OutlineButton>
                        <GoldButton onClick={send} disabled={saving}>
                            <Mail className="size-4" /> {saving ? 'Sending...' : sent ? 'Resend by Email' : 'Send Work Order by Email'}
                        </GoldButton>
                    </div>
                </div>
            )}
        </div>
    );
}