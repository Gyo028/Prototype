import { Link } from '@inertiajs/react';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Clock, FileText, Lock, SkipForward, X, XCircle } from 'lucide-react';
import { useState } from 'react';
import ConsultationPanel from '@/components/customer/consultation-panel';
import OcularVisitPanel from '@/components/customer/ocular-visit-panel';
import ReservationFeePanel from '@/components/customer/reservation-fee-panel';
import { PHASE_LABELS, formatWhen, statusText, statusTone } from '@/components/customer/project-types';
import type {
    ConsultationInfo,
    ConsultationRules,
    NextAction,
    OcularVisitInfo,
    ProjectDetail,
    ReservationFeeInfo,
    Step,
    StepKey,
} from '@/components/customer/project-types';
import { Pill, cx } from '@/components/dashboard/ui';

/*
 * Customer > My Projects > one project: the Plan Project progress page.
 *
 * One container, two sides:
 *  - left:  the 8-step timeline (a horizontal strip on small screens)
 *  - right: the selected step's details, opening on the current step
 *
 * "Where things stand" sits at the top of the right side, on the current
 * step only. Other steps show a thin "Now at" line that leads back to it.
 * Done, skipped and cancelled steps can be opened; locked steps can't.
 *
 * Step states, summaries and details come from the server (ProjectProgress).
 * The request details live on their own page ("View project details").
 */

type Props = {
    project: ProjectDetail;
    steps: Step[];
    currentStep: StepKey;
    nextAction: NextAction;
    consultation: ConsultationInfo;
    reservationFee: ReservationFeeInfo;
    ocularVisit: OcularVisitInfo;
    availableSlots: Record<string, string[]>;
    rules: ConsultationRules;
};

const STATE_LABEL: Record<Step['state'], string> = {
    done: 'Done',
    current: 'Now',
    skipped: 'Skipped',
    cancelled: 'Cancelled',
    locked: 'Locked',
};

export default function ProjectFolder({ project, steps, currentStep, nextAction, consultation, reservationFee, ocularVisit, availableSlots, rules }: Props) {
    const [selected, setSelected] = useState<StepKey>(currentStep);
    const step = steps.find((s) => s.key === selected) ?? steps[0];
    const number = steps.indexOf(step) + 1;
    const current = steps.find((s) => s.key === currentStep) ?? steps[0];
    const onCurrent = step.key === currentStep;

    return (
        <div className="mx-auto w-full max-w-[1150px]">
            <Link href="/customer/projects" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-gold-dark hover:underline">
                <ArrowLeft className="size-4" /> My Projects
            </Link>

            {/* One container: header on top, then timeline | selected step. */}
            <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                {/* Compact header: the full request is on its own page. */}
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/10 px-5 py-4 lg:px-6">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                            {project.code} · {project.requestType === 'custom' ? 'Custom Project' : 'Standard Event Styling'}
                        </p>
                        <h1 className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xl font-bold text-ink">
                            {project.title}
                            <span className="text-base font-normal text-ink-soft">{formatWhen(project)}</span>
                        </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={statusTone(project)}>{statusText(project)}</Pill>
                        {project.status.onHold && <Pill tone="yellow">On Hold</Pill>}
                        <Link
                            href={`/customer/requests/${project.requestId}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gold bg-white px-3 py-1.5 text-sm font-bold text-ink hover:bg-gold/10"
                        >
                            <FileText className="size-4" /> View project details
                        </Link>
                    </div>
                </div>

                <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
                    <aside className="border-b border-black/10 bg-black/[0.015] lg:border-r lg:border-b-0">
                        <TimelineStrip steps={steps} selected={step.key} onSelect={setSelected} />
                        <Timeline steps={steps} selected={step.key} onSelect={setSelected} />
                    </aside>

                    <div className="min-w-0 p-5 lg:p-6">
                        {onCurrent ? (
                            <NextActionBanner action={nextAction} cancelled={project.status.name === 'Cancelled'} />
                        ) : (
                            <button
                                type="button"
                                onClick={() => setSelected(currentStep)}
                                className="mb-5 flex w-full items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2 text-left text-sm hover:border-gold"
                            >
                                <span className="text-ink-soft">
                                    Now at: <span className="font-bold text-ink">{steps.indexOf(current) + 1}. {current.label}</span>
                                </span>
                                <ArrowRight className="size-4 shrink-0 text-gold-dark" />
                            </button>
                        )}

                        <StepHeader step={step} number={number} />

                        {step.key === 'consultation' ? (
                            <ConsultationPanel
                                projectId={project.id}
                                consultation={consultation}
                                availableSlots={availableSlots}
                                rules={rules}
                                decision={project.decision}
                            />
                        ) : step.key === 'reservation_fee' ? (
                            <ReservationFeePanel projectId={project.id} fee={reservationFee} stepState={step.state} />
                        ) : step.key === 'ocular_visit' && step.state !== 'skipped' && step.state !== 'cancelled' ? (
                            <OcularVisitPanel projectId={project.id} venue={project.venue} ocularVisit={ocularVisit} />
                        ) : (
                            <StepBody step={step} />
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}

/** "Where things stand": gold when the customer has something to do, plain when they are waiting. */
function NextActionBanner({ action, cancelled }: { action: NextAction; cancelled: boolean }) {
    const Icon = cancelled ? XCircle : action.actionNeeded ? AlertCircle : Clock;

    return (
        <div
            className={cx(
                'mb-5 flex items-start gap-3 rounded-xl border p-4',
                cancelled ? 'border-red-200 bg-red-50' : action.actionNeeded ? 'border-gold bg-gold/10' : 'border-black/10 bg-black/[0.02]',
            )}
        >
            <Icon className={cx('mt-0.5 size-5 shrink-0', cancelled ? 'text-red-600' : action.actionNeeded ? 'text-gold-dark' : 'text-ink-soft')} />
            <div>
                <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">{action.actionNeeded ? 'What to do now' : 'Where things stand'}</p>
                <p className="font-bold text-ink">{action.title}</p>
                <p className="text-sm text-ink-soft">{action.detail}</p>
            </div>
        </div>
    );
}

/** Large screens: the vertical timeline, grouped by phase. */
function Timeline({ steps, selected, onSelect }: { steps: Step[]; selected: StepKey; onSelect: (k: StepKey) => void }) {
    return (
        <nav aria-label="Project steps" className="hidden p-4 lg:block">
            {(['planning', 'execution', 'closed'] as const).map((phase) => (
                <div key={phase} className="mb-2 last:mb-0">
                    <p className="px-2 pt-1 pb-2 text-[11px] font-bold tracking-wide text-ink-soft uppercase">{PHASE_LABELS[phase]}</p>
                    <ol>
                        {steps
                            .filter((s) => s.phase === phase)
                            .map((s) => {
                                const number = steps.indexOf(s) + 1;
                                // steps[number] is the next step (number is 1-based).
                                const joinsNext = steps[number]?.phase === s.phase;
                                const locked = s.state === 'locked';
                                const active = s.key === selected;
                                return (
                                    <li key={s.key} className="relative">
                                        {joinsNext && (
                                            <span
                                                aria-hidden
                                                className="absolute w-0.5"
                                                // Inline position: from under this icon to the next one (icon centre is 24px from the left).
                                                style={{
                                                    top: 40,
                                                    bottom: -8,
                                                    left: 23,
                                                    backgroundColor: s.state === 'done' || s.state === 'skipped' ? '#86EFAC' : 'rgba(0, 0, 0, 0.1)',
                                                }}
                                            />
                                        )}
                                        <button
                                            type="button"
                                            disabled={locked}
                                            aria-current={s.state === 'current' ? 'step' : undefined}
                                            aria-pressed={active}
                                            onClick={() => onSelect(s.key)}
                                            className={cx(
                                                'relative flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition',
                                                active && 'bg-gold/15 ring-1 ring-gold/60',
                                                !active && !locked && 'hover:bg-black/[0.04]',
                                                locked && 'cursor-not-allowed',
                                            )}
                                        >
                                            <StepIcon step={s} number={number} />
                                            <span className="min-w-0 pt-0.5">
                                                <span className={cx('block text-sm font-bold', locked ? 'text-ink-soft/70' : 'text-ink')}>{s.label}</span>
                                                {s.note && (
                                                    <span className={cx('block text-xs', s.state === 'cancelled' ? 'text-red-700' : 'text-ink-soft')}>{s.note}</span>
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                    </ol>
                </div>
            ))}
        </nav>
    );
}

/** Small screens: the steps as a scrollable row of icons, with the selected step's name. */
function TimelineStrip({ steps, selected, onSelect }: { steps: Step[]; selected: StepKey; onSelect: (k: StepKey) => void }) {
    return (
        <nav aria-label="Project steps" className="overflow-x-auto p-3 lg:hidden">
            <ol className="flex min-w-max items-center gap-1">
                {steps.map((s, i) => {
                    const locked = s.state === 'locked';
                    const active = s.key === selected;
                    return (
                        <li key={s.key} className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={locked}
                                aria-pressed={active}
                                aria-label={`${i + 1}. ${s.label} (${STATE_LABEL[s.state]})`}
                                onClick={() => onSelect(s.key)}
                                className={cx('flex flex-col items-center gap-1 rounded-lg px-1.5 py-1', active && 'bg-gold/15', locked && 'cursor-not-allowed')}
                            >
                                <StepIcon step={s} number={i + 1} />
                                <span className={cx('text-[10px] font-semibold', active ? 'text-ink' : 'text-ink-soft')}>{s.label}</span>
                            </button>
                            {i < steps.length - 1 && <span aria-hidden className="h-0.5 w-3 bg-black/10" />}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

function StepIcon({ step, number }: { step: Step; number: number }) {
    const base = 'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold';

    switch (step.state) {
        case 'done':
            return (
                <span className={cx(base, 'bg-green-100 text-green-700')}>
                    <Check className="size-4" />
                </span>
            );
        case 'current':
            return <span className={cx(base, 'bg-gold text-white ring-4 ring-gold/20')}>{number}</span>;
        case 'skipped':
            return (
                <span className={cx(base, 'bg-black/5 text-ink-soft')}>
                    <SkipForward className="size-4" />
                </span>
            );
        case 'cancelled':
            return (
                <span className={cx(base, 'bg-red-100 text-red-700')}>
                    <X className="size-4" />
                </span>
            );
        default:
            return (
                <span className={cx(base, 'border border-black/10 bg-white text-ink-soft/70')}>
                    <Lock className="size-3.5" />
                </span>
            );
    }
}

/** Title of the selected step, with its state and summary. */
function StepHeader({ step, number }: { step: Step; number: number }) {
    const tag =
        step.state === 'current' ? (
            <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-white uppercase">Now</span>
        ) : (
            <span className={cx('text-xs font-semibold', step.state === 'cancelled' ? 'text-red-700' : 'text-ink-soft')}>{STATE_LABEL[step.state]}</span>
        );

    return (
        <div className="mb-4">
            <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold text-ink">
                {number}. {step.label} {tag}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">{step.description}</p>
            {step.summary && step.state !== 'current' && <p className="mt-1 text-sm font-semibold text-ink">{step.summary}</p>}
        </div>
    );
}

/** The body of a step that has no actions yet: what has happened there so far. */
function StepBody({ step }: { step: Step }) {
    if (step.details.length === 0) {
        // On the current step the banner above already says where things stand.
        return step.state === 'current' ? null : (
            <p className="rounded-xl border border-dashed border-black/15 p-4 text-sm text-ink-soft">
                This step is complete. Its full record will appear here once this part of the system is ready.
            </p>
        );
    }

    return (
        <dl className="grid gap-x-6 gap-y-3 rounded-xl border border-black/10 p-4 text-sm sm:grid-cols-2">
            {step.details.map((d) => (
                <div key={d.label}>
                    <dt className="text-xs text-ink-soft">{d.label}</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{d.value}</dd>
                </div>
            ))}
        </dl>
    );
}
