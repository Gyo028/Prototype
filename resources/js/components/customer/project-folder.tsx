import { Deferred, Link } from '@inertiajs/react';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Clock, FileText, Lock, SkipForward, X, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import BillCard from '@/components/customer/bill-card';
import ConsultationPanel from '@/components/customer/consultation-panel';
import ContractPanel from '@/components/customer/contract-panel';
import DesignProposalPanel from '@/components/customer/design-proposal-panel';
import ExecutionPanel from '@/components/customer/execution-panel';
import OcularVisitPanel from '@/components/customer/ocular-visit-panel';
import { PHASE_LABELS, formatDay, peso, statusText, statusTone } from '@/components/customer/project-types';
import type {
    ConsultationInfo,
    ConsultationRules,
    ContractInfo,
    DesignInfo,
    ExecutionInfo,
    NextAction,
    OcularVisitInfo,
    ProjectDetail,
    ReservationFeeCard,
    Step,
    StepKey,
} from '@/components/customer/project-types';
import { Pill, cx } from '@/components/dashboard/ui';
import { Skeleton } from '@/components/ui/skeleton';

/*
 * Customer > My Projects > one project: the Plan Project progress page.
 *
 * One container, stacked:
 *  - header: project code, title, date (no time), status
 *  - progress: the 7 steps in a row under the header, grouped by phase
 *    (tablet and up), or a scrollable strip that keeps the selected step in view (phones)
 *  - body: the selected step's details at full width, opening on the current step
 *
 * The progress row sits above the body rather than beside it, so a long step
 * (many design revisions, say) doesn't leave an empty column next to it.
 *
 * "Where things stand" sits at the top of the body, on the current
 * step only. Other steps show a thin "Now at" line that leads back to it.
 * Done, skipped and cancelled steps can be opened; locked steps can't.
 *
 * Step states, summaries and details come from the server (ProjectProgress).
 * The request details live on their own page ("View project details").
 *
 * Only the current step's details come with the page. The other steps' details
 * (consultation, ocular visit, design, contract, execution) are deferred: the
 * browser fetches them right after the page appears, and a step opened before
 * they arrive shows a skeleton until then.
 */

type Props = {
    project: ProjectDetail;
    steps: Step[];
    currentStep: StepKey;
    nextAction: NextAction;
    reservationFee: ReservationFeeCard;
    // Deferred unless it is the current step's: undefined until the second request arrives.
    consultation?: ConsultationInfo;
    ocularVisit?: OcularVisitInfo;
    design?: DesignInfo;
    contract?: ContractInfo;
    execution?: ExecutionInfo;
    availableSlots?: Record<string, string[]>;
    rules?: ConsultationRules;
};

const STATE_LABEL: Record<Step['state'], string> = {
    done: 'Done',
    current: 'Now',
    skipped: 'Skipped',
    cancelled: 'Cancelled',
    locked: 'Locked',
};

export default function ProjectFolder({ project, steps, currentStep, nextAction, consultation, reservationFee, ocularVisit, design, contract, execution, availableSlots, rules }: Props) {
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

            {/* One container: header, then the progress row, then the selected step. */}
            <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                {/* Code · title · date (no time) · status, as on My Projects. The request type and times are on "View project details". */}
                <div className="flex flex-col gap-3 border-b border-black/10 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5 lg:px-6">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{project.code}</p>
                        <h1 className="mt-1 text-xl font-bold break-words text-ink sm:text-2xl">{project.title}</h1>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                            {formatDay(project)}
                            <Pill tone={statusTone(project)} className="whitespace-nowrap">
                                {statusText(project)}
                            </Pill>
                        </p>
                    </div>
                    <div className="flex shrink-0">
                        <Link
                            href={`/customer/requests/${project.requestId}`}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-gold bg-white px-3 py-2 text-sm font-bold text-ink hover:bg-gold/10 sm:w-auto sm:py-1.5"
                        >
                            <FileText className="size-4" /> View project details
                        </Link>
                    </div>
                </div>

                <div className="border-b border-black/10 bg-black/[0.015]">
                    <TimelineStrip steps={steps} selected={step.key} onSelect={setSelected} />
                    <Stepper steps={steps} selected={step.key} onSelect={setSelected} />
                </div>

                <div className="min-w-0 p-4 sm:p-5 lg:p-6">
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

                    {/* After the consultation: the reservation fee comes first (paid on Billing & Payments). */}
                    {reservationFee && onCurrent && <ReservationFeeBlock fee={reservationFee} />}

                    {/* Deferred renders its children once the step's data is there, the skeleton until then. */}
                    {step.key === 'consultation' ? (
                        <Deferred data={['consultation', 'availableSlots', 'rules']} fallback={<StepSkeleton />}>
                            {() => (
                                <ConsultationPanel
                                    projectId={project.id}
                                    consultation={consultation!}
                                    availableSlots={availableSlots!}
                                    rules={rules!}
                                    decision={project.decision}
                                />
                            )}
                        </Deferred>
                    ) : step.key === 'ocular_visit' && step.state !== 'skipped' && step.state !== 'cancelled' ? (
                        <Deferred data="ocularVisit" fallback={<StepSkeleton />}>
                            {() => <OcularVisitPanel projectId={project.id} venue={project.venue} ocularVisit={ocularVisit!} />}
                        </Deferred>
                    ) : step.key === 'design' && step.state !== 'cancelled' ? (
                        <Deferred data="design" fallback={<StepSkeleton />}>
                            {() =>
                                step.state === 'current' || design!.latest ? (
                                    <DesignProposalPanel projectId={project.id} design={design!} />
                                ) : (
                                    <StepBody step={step} />
                                )
                            }
                        </Deferred>
                    ) : step.key === 'contract' && step.state !== 'cancelled' ? (
                        <Deferred data="contract" fallback={<StepSkeleton />}>
                            {() =>
                                contract!.current ? (
                                    <ContractPanel projectId={project.id} contract={contract!} stepState={step.state} />
                                ) : (
                                    <StepBody step={step} />
                                )
                            }
                        </Deferred>
                    ) : (step.key === 'fabrication' || step.key === 'installation') && (step.state === 'current' || step.state === 'done') ? (
                        <Deferred data="execution" fallback={<StepSkeleton />}>
                            {() => <ExecutionPanel kind={step.key as 'fabrication' | 'installation'} execution={execution!} />}
                        </Deferred>
                    ) : (
                        <StepBody step={step} />
                    )}
                </div>
            </section>
        </div>
    );
}

/** Grey placeholder shaped like a step panel, shown while the step's details load. */
function StepSkeleton() {
    return (
        <div className="space-y-4" aria-busy="true" aria-label="Loading this step">
            <div className="rounded-xl border border-black/10 p-4 sm:p-5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-3 h-4 w-full max-w-md" />
                <Skeleton className="mt-2 h-4 w-2/3 max-w-sm" />
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            </div>
            <div className="rounded-xl border border-black/10 p-4 sm:p-5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-3 h-24 w-full" />
            </div>
            <div className="flex justify-end">
                <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
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

/** Medium screens and up: the steps in a row under the header, with their phase above each group. */
function Stepper({ steps, selected, onSelect }: { steps: Step[]; selected: StepKey; onSelect: (k: StepKey) => void }) {
    const columns = { gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` };
    const groups = (['planning', 'execution', 'closed'] as const)
        .map((phase) => ({ phase, count: steps.filter((s) => s.phase === phase).length }))
        .filter((g) => g.count > 0);
    // A connector is green once the step on its left is behind the customer.
    const passed = (s: Step | undefined) => s?.state === 'done' || s?.state === 'skipped';

    return (
        <nav aria-label="Project steps" className="hidden px-3 pt-3 pb-2 md:block lg:px-4">
            <div className="grid" style={columns}>
                {groups.map((g) => (
                    <p
                        key={g.phase}
                        style={{ gridColumn: `span ${g.count}` }}
                        className="mx-2 mb-1 border-b border-black/10 pb-1 text-center text-[11px] font-bold tracking-wide text-ink-soft uppercase"
                    >
                        {PHASE_LABELS[g.phase]}
                    </p>
                ))}
            </div>
            <ol className="grid" style={columns}>
                {steps.map((s, i) => {
                    const locked = s.state === 'locked';
                    const active = s.key === selected;
                    return (
                        <li key={s.key} className="relative">
                            {/* Connector halves, through the middle of the icon (button pt-2 + half of size-8 = 24px). */}
                            {i > 0 && (
                                <span
                                    aria-hidden
                                    className={cx('absolute left-0 h-0.5 w-1/2', passed(steps[i - 1]) ? 'bg-green-300' : 'bg-black/10')}
                                    style={{ top: 23 }}
                                />
                            )}
                            {i < steps.length - 1 && (
                                <span
                                    aria-hidden
                                    className={cx('absolute right-0 h-0.5 w-1/2', passed(s) ? 'bg-green-300' : 'bg-black/10')}
                                    style={{ top: 23 }}
                                />
                            )}
                            <button
                                type="button"
                                disabled={locked}
                                aria-current={s.state === 'current' ? 'step' : undefined}
                                aria-pressed={active}
                                onClick={() => onSelect(s.key)}
                                className={cx(
                                    'relative mx-auto flex w-full flex-col items-center gap-1 rounded-xl px-1 pt-2 pb-2 text-center transition',
                                    active && 'bg-gold/15 ring-1 ring-gold/60',
                                    !active && !locked && 'hover:bg-black/[0.04]',
                                    locked && 'cursor-not-allowed',
                                )}
                            >
                                <StepIcon step={s} number={i + 1} />
                                {/* Label only: what happened at a step is in its body when opened. */}
                                <span className={cx('text-xs leading-tight font-bold lg:text-sm', locked ? 'text-ink-soft/70' : 'text-ink')}>{s.label}</span>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

/** Small screens: the steps as a scrollable row of icons, with the selected step's name. */
function TimelineStrip({ steps, selected, onSelect }: { steps: Step[]; selected: StepKey; onSelect: (k: StepKey) => void }) {
    const navRef = useRef<HTMLElement>(null);

    // Keep the selected step in view (on opening, the current step may be past the screen's edge).
    useEffect(() => {
        const nav = navRef.current;
        const button = nav?.querySelector<HTMLElement>('[aria-pressed="true"]');
        if (!nav || !button) return;
        nav.scrollTo({ left: button.offsetLeft - (nav.clientWidth - button.offsetWidth) / 2, behavior: 'smooth' });
    }, [selected]);

    return (
        <nav ref={navRef} aria-label="Project steps" className="relative overflow-x-auto p-3 md:hidden">
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
                                <span className={cx('text-[11px] font-semibold whitespace-nowrap', active ? 'text-ink' : 'text-ink-soft')}>{s.label}</span>
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
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold text-ink sm:text-xl">
                {number}. {step.label} {tag}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">{step.description}</p>
            {step.summary && step.state !== 'current' && <p className="mt-1 text-sm font-semibold text-ink">{step.summary}</p>}
        </div>
    );
}

/** The reservation fee bill (or the bill to come), with "Pay now" to its page on Billing & Payments. */
function ReservationFeeBlock({ fee }: { fee: NonNullable<ReservationFeeCard> }) {
    if (!fee.bill) {
        return (
            <p className="mb-4 rounded-xl border border-dashed border-black/15 p-4 text-sm text-ink-soft">
                Your reservation fee bill of {peso(fee.expectedAmount)} (10% of {fee.basis ?? 'your budget'}) is being prepared. You will be able to pay it on Billing &amp;
                Payments.
            </p>
        );
    }

    return (
        <BillCard
            bill={fee.bill}
            className="mb-4"
            note="Your event date is confirmed once your reservation fee is verified. If it is not paid by the due date, the project is cancelled."
        />
    );
}

/** The body of a step that has no actions yet: what has happened there so far. */
function StepBody({ step }: { step: Step }) {
    if (step.details.length === 0) {
        // On the current step the banner above already says where things stand.
        return step.state === 'current' || step.state === 'cancelled' ? null : (
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
