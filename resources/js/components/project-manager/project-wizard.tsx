import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Ban, Check, ChevronDown, Clock, Lock, X } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { DangerButton, GoldButton, Panel, Pill, cx } from '@/components/dashboard/ui';
import ProjectStatusPanel, { CancelProjectForm, projectStatusTone } from '@/components/project-manager/project-status';
import { RequestDetails, formatDate } from '@/components/project-manager/request-details';
import ConsultationStep from '@/components/project-manager/steps/consultation-step';
import ContractStep from '@/components/project-manager/steps/contract-step';
import DesignAssignmentStep from '@/components/project-manager/steps/design-assignment-step';
import DesignProposalStep from '@/components/project-manager/steps/design-proposal-step';
import ExecutionStep from '@/components/project-manager/steps/execution-step';
import PaymentsStep from '@/components/project-manager/steps/payments-step';
import ReservationFeeStep from '@/components/project-manager/steps/reservation-fee-step';
import SiteAssessmentStep from '@/components/project-manager/steps/site-assessment-step';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { SAMPLE_SET_UP_HEADS } from '@/data/project-manager/execution';
import type { SetUpHead } from '@/data/project-manager/execution';
import {
    SAMPLE_SPECIALISTS,
    STEPS,
    activeStep,
    executionStatus,
    getSampleProject,
    isNotProceeding,
    isStepComplete,
    projectStatus,
    saveSampleProject,
    stepStates,
} from '@/data/project-manager/projects';
import type { DesignSpecialist, PartKey, Project, StepKey, StepState } from '@/data/project-manager/projects';
import { requestTitle } from '@/data/project-manager/project-requests';

/*
 * The project wizard: one page per project, with the planning steps across the top.
 * Revision (leader, Nov 19): 7 steps. Some steps hold two parts, shown one under the other:
 *   Ocular Visit = Reservation Fee + Site Assessment, Design = Design Assignment + Design Proposal,
 *   Contract = Contract + Payments.
 * A step (and a part inside a step) can only be opened once the one before it is complete.
 * "Cancel Project" at the top works from any step.
 */

const stateLabel: Record<StepState, string> = {
    done: 'Completed',
    skipped: 'Not required',
    current: 'Action needed',
    waiting: 'Waiting',
    locked: 'Locked',
    closed: 'Closed',
};

const PART_TITLES: Record<PartKey, string> = {
    consultation: 'Consultation',
    reservationFee: 'Reservation Fee',
    siteAssessment: 'Site Assessment',
    designAssignment: 'Design Assignment',
    designProposal: 'Design Proposal',
    contract: 'Contract',
    payments: 'Payments',
    fabrication: 'Fabrication',
    installation: 'Installation',
    completed: 'Completed',
};

/**
 * Parts whose actions are connected to the backend so far (add each one as its backlog is connected).
 * With real data, the other parts show a notice instead of forms that would have nowhere to save yet.
 */
const CONNECTED_PARTS: PartKey[] = ['consultation', 'reservationFee'];

/** A step is connected when at least one of its parts is. */
const stepConnected = (key: StepKey) =>
    (STEPS.find((s) => s.key === key)?.parts as readonly PartKey[] | undefined)?.some((p) => CONNECTED_PARTS.includes(p)) ?? false;

/** Shown in place of a step or part that is not connected to the database yet. */
function NotConnected({ title }: { title: string }) {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-black/15 bg-neutral-50 p-4 text-sm text-ink-soft">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <p>
                <b className="text-ink">{title}</b> is not connected to the database yet. It will be connected with its backlog.
            </p>
        </div>
    );
}

// A cancelled project's Completed step stays open so its status history can be seen.
const canOpen = (state: StepState, key?: StepKey) => state !== 'locked' && (state !== 'closed' || key === 'completed');

/** Shown in place of a part that cannot be opened yet. */
function LockedPart({ title, after }: { title: string; after: string }) {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-black/15 bg-neutral-50 p-4 text-sm text-ink-soft">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <p>
                <b className="text-ink">{title}</b> opens once the {after.toLowerCase()} is done.
            </p>
        </div>
    );
}

type Props = {
    /** Sent by the controller. Leave it out to use the sample data. */
    project?: Project;
    specialists?: DesignSpecialist[];
    setUpHeads?: SetUpHead[];
    /** Used to find the sample project while the backend is not ready. */
    projectId: number;
};

export default function ProjectWizard({ project: serverProject, specialists, setUpHeads, projectId }: Props) {
    const { props } = usePage();
    const managerName = props.auth?.user?.name ?? 'Project Manager';

    const usingSample = serverProject === undefined;
    const [sampleProject, setSampleProject] = useState(() => getSampleProject(projectId));
    const project = serverProject ?? sampleProject;

    const [selected, setSelected] = useState<StepKey>(() => (project ? (activeStep(project) ?? 'completed') : 'consultation'));
    const [showDetails, setShowDetails] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    if (!project) {
        return (
            <Panel className="text-center">
                <p className="mb-3 text-ink">This project could not be found.</p>
                <Link href={PROJECTS_URL} className="font-semibold text-gold-dark underline">
                    Back to Projects
                </Link>
            </Panel>
        );
    }

    const states = stepStates(project);
    const status = projectStatus(project);
    const notProceeding = isNotProceeding(project);
    const heads = setUpHeads ?? SAMPLE_SET_UP_HEADS;
    // Cancelling is connected to the backend with backlog #35; until then, sample data only.
    const canCancel = usingSample && !notProceeding && executionStatus(project) === null;

    const selectedIndex = STEPS.findIndex((s) => s.key === selected);
    const nextStep = STEPS[selectedIndex + 1];
    const canGoNext = nextStep !== undefined && canOpen(states[nextStep.key], nextStep.key);

    // Sample mode: save to the in-memory store so the Projects list sees the change too.
    const onSaved = (updated: Project) => {
        saveSampleProject(updated);
        setSampleProject(updated);
    };

    const stepProps: StepProps = { project, usingSample, managerName, onSaved };

    /** A part of the selected step: shown only once the part before it is complete. */
    const part = (key: PartKey, before: PartKey | null, content: ReactNode) => (
        <div key={key} className="border-b border-black/10 pb-6 last:border-0 last:pb-0">
            {before && !isStepComplete(project, before) ? <LockedPart title={PART_TITLES[key]} after={PART_TITLES[before]} /> : !usingSample && !CONNECTED_PARTS.includes(key) ? <NotConnected title={PART_TITLES[key]} /> : content}
        </div>
    );

    const ocularNotRequired = project.consultation?.ocularVisit.required === false;

    return (
        <>
            <Head title={`${project.code} · Projects`} />

            {/* Header */}
            <Link href={PROJECTS_URL} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-gold-dark hover:underline">
                <ArrowLeft className="size-4" /> All Projects
            </Link>

            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-bold text-ink">
                            {project.code} · {requestTitle(project)}
                        </h1>
                        <Pill tone={projectStatusTone[status]}>{status}</Pill>
                        {project.onHold && <Pill tone="yellow">On hold</Pill>}
                    </div>
                    <p className="text-sm text-ink-soft">
                        {project.customer.name} · {formatDate(project.eventDate)} · {project.venue}
                        {project.requestCode && ` · Request ${project.requestCode}`}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {canCancel && !cancelling && (
                        <DangerButton onClick={() => setCancelling(true)}>
                            <Ban className="size-4" /> Cancel Project
                        </DangerButton>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowDetails((s) => !s)}
                        aria-expanded={showDetails}
                        className="inline-flex items-center gap-1 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:border-gold"
                    >
                        Request details
                        <ChevronDown className={cx('size-4 transition-transform', showDetails && 'rotate-180')} />
                    </button>
                </div>
            </div>

            {cancelling && canCancel && <CancelProjectForm {...stepProps} setUpHeads={heads} onClose={() => setCancelling(false)} />}

            {showDetails && (
                <Panel className="mb-5">
                    <RequestDetails request={project} />
                </Panel>
            )}

            {executionStatus(project) === 'Cancelled' && (
                <div role="status" className="mb-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-ink">
                    <b>This project was cancelled.</b> {project.statusUpdates.at(-1)?.remarks ?? ''} The remaining steps are closed.
                </div>
            )}

            {notProceeding && (
                <div role="status" className="mb-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-ink">
                    <b>This project will not proceed.</b> {project.consultation?.decisionReason ?? ''} The remaining steps are closed.
                </div>
            )}

            
            {/* Stepper */}
            <Panel className="mb-5 overflow-x-auto p-4">
                <ol className="flex min-w-[880px] items-start">
                    {STEPS.map((step, index) => {
                        const state = states[step.key];
                        const open = canOpen(state, step.key) && !(state === 'closed' && notProceeding);
                        const isSelected = step.key === selected;
                        const finished = state === 'done' || state === 'skipped';

                        return (
                            <li key={step.key} className="flex flex-1 items-start">
                                <button
                                    type="button"
                                    disabled={!open}
                                    onClick={() => setSelected(step.key)}
                                    aria-current={isSelected ? 'step' : undefined}
                                    className={cx(
                                        'flex w-full flex-col items-center gap-1.5 rounded-lg px-1 py-2 text-center transition',
                                        open ? 'hover:bg-gold/10' : 'cursor-not-allowed opacity-60',
                                        isSelected && 'bg-gold/10',
                                    )}
                                >
                                    <span
                                        className={cx(
                                            'flex size-9 items-center justify-center rounded-full border-2 text-sm font-bold',
                                            finished && 'border-green-600 bg-green-600 text-white',
                                            state === 'current' && 'border-gold bg-gold text-white',
                                            state === 'waiting' && 'border-sky-500 bg-sky-50 text-sky-600',
                                            (state === 'locked' || state === 'closed') && 'border-black/15 bg-neutral-100 text-ink-soft',
                                            isSelected && 'ring-4 ring-gold/30',
                                        )}
                                    >
                                        {finished ? (
                                            <Check className="size-4" />
                                        ) : state === 'waiting' ? (
                                            <Clock className="size-4" />
                                        ) : state === 'locked' ? (
                                            <Lock className="size-4" />
                                        ) : state === 'closed' ? (
                                            <X className="size-4" />
                                        ) : (
                                            index + 1
                                        )}
                                    </span>
                                    <span className={cx('text-sm font-semibold', isSelected ? 'text-ink' : 'text-ink-soft')}>{step.title}</span>
                                    <span className="text-xs text-ink-soft">{stateLabel[state]}</span>
                                </button>
                                {index < STEPS.length - 1 && (
                                    <span aria-hidden className={cx('mt-6 h-0.5 w-6 shrink-0', finished ? 'bg-green-600' : 'bg-black/15')} />
                                )}
                            </li>
                        );
                    })}
                </ol>
            </Panel>

            {/* Selected step */}
            <Panel>
                {!usingSample && !stepConnected(selected) ? (
                    <NotConnected title={STEPS[selectedIndex].title} />
                ) : (
                    <div className="grid gap-6">
                        {selected === 'consultation' && <ConsultationStep key={project.id} {...stepProps} />}

                        {selected === 'ocularVisit' && (
                            <>
                                {part('reservationFee', null, <ReservationFeeStep key={project.id} {...stepProps} />)}
                                {part(
                                    'siteAssessment',
                                    'reservationFee',
                                    ocularNotRequired ? (
                                        <p className="rounded-xl border border-black/10 p-4 text-sm text-ink-soft">
                                            <b className="text-ink">Site Assessment:</b> not required. No ocular visit was needed for this project.
                                        </p>
                                    ) : (
                                        <SiteAssessmentStep key={project.id} {...stepProps} />
                                    ),
                                )}
                            </>
                        )}

                        {selected === 'design' && (
                            <>
                                {part(
                                    'designAssignment',
                                    null,
                                    <DesignAssignmentStep key={project.id} {...stepProps} specialists={specialists ?? SAMPLE_SPECIALISTS} />,
                                )}
                                {part('designProposal', 'designAssignment', <DesignProposalStep key={project.id} {...stepProps} />)}
                            </>
                        )}

                        {selected === 'contract' && (
                            <>
                                {part('contract', null, <ContractStep key={project.id} {...stepProps} />)}
                                {part('payments', 'contract', <PaymentsStep key={project.id} {...stepProps} />)}
                            </>
                        )}

                        {selected === 'fabrication' && (
                            <ExecutionStep key={`${project.id}-fabrication`} {...stepProps} setUpHeads={heads} phaseKey="fabrication" />
                        )}
                        {selected === 'installation' && (
                            <ExecutionStep key={`${project.id}-installation`} {...stepProps} setUpHeads={heads} phaseKey="installation" />
                        )}

                        {selected === 'completed' && <ProjectStatusPanel key={project.id} {...stepProps} setUpHeads={heads} />}
                    </div>
                )}

                {/* Move on once the next step is unlocked */}
                {canGoNext && (
                    <div className="mt-6 flex justify-end border-t border-black/10 pt-4">
                        <GoldButton onClick={() => setSelected(nextStep.key)}>
                            Next: {nextStep.title} <ArrowRight className="size-4" />
                        </GoldButton>
                    </div>
                )}
            </Panel>
        </>
    );
}