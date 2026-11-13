import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock, Lock, X } from 'lucide-react';
import { useState } from 'react';
import { GoldButton, Panel, Pill, cx } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import { RequestDetails, formatDate } from '@/components/project-manager/request-details';
import ConsultationStep from '@/components/project-manager/steps/consultation-step';
import ContractStep from '@/components/project-manager/steps/contract-step';
import DesignAssignmentStep from '@/components/project-manager/steps/design-assignment-step';
import DesignProposalStep from '@/components/project-manager/steps/design-proposal-step';
import SiteAssessmentStep from '@/components/project-manager/steps/site-assessment-step';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import {
    SAMPLE_SPECIALISTS,
    STEPS,
    activeStep,
    getSampleProject,
    projectStatus,
    saveSampleProject,
    stepStates,
} from '@/data/project-manager/projects';
import type { DesignSpecialist, Project, ProjectStatus, StepKey, StepState } from '@/data/project-manager/projects';

/*
 * The project wizard: one page per project, with the planning steps across the top.
 * A step can only be opened once the step before it is complete. Completed steps can
 * still be opened to view or update them.
 */

const statusTone: Record<ProjectStatus, PillTone> = {
    'In Progress': 'yellow',
    Completed: 'green',
    'Not Proceeding': 'red',
};

const stateLabel: Record<StepState, string> = {
    done: 'Completed',
    skipped: 'Not required',
    current: 'Action needed',
    waiting: 'Waiting',
    locked: 'Locked',
    closed: 'Closed',
};

const canOpen = (state: StepState) => state !== 'locked' && state !== 'closed';

type Props = {
    /** Sent by the controller. Leave it out to use the sample data. */
    project?: Project;
    specialists?: DesignSpecialist[];
    /** Used to find the sample project while the backend is not ready. */
    projectId: number;
};

export default function ProjectWizard({ project: serverProject, specialists, projectId }: Props) {
    const { props } = usePage();
    const managerName = props.auth?.user?.name ?? 'Project Manager';

    const usingSample = serverProject === undefined;
    const [sampleProject, setSampleProject] = useState(() => getSampleProject(projectId));
    const project = serverProject ?? sampleProject;

    const [selected, setSelected] = useState<StepKey>(() => (project ? (activeStep(project) ?? 'consultation') : 'consultation'));
    const [showDetails, setShowDetails] = useState(false);

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
    const selectedIndex = STEPS.findIndex((s) => s.key === selected);
    const nextStep = STEPS[selectedIndex + 1];
    const canGoNext = nextStep !== undefined && canOpen(states[nextStep.key]);

    // Sample mode: save to the in-memory store so the Projects list sees the change too.
    const onSaved = (updated: Project) => {
        saveSampleProject(updated);
        setSampleProject(updated);
    };

    const stepProps: StepProps = { project, usingSample, managerName, onSaved };

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
                            {project.code} · {project.eventType}
                        </h1>
                        <Pill tone={statusTone[status]}>{status}</Pill>
                    </div>
                    <p className="text-sm text-ink-soft">
                        {project.customer.name} · {formatDate(project.eventDate)} · {project.venue}
                    </p>
                </div>
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

            {showDetails && (
                <Panel className="mb-5">
                    <RequestDetails request={project} />
                </Panel>
            )}

            {status === 'Not Proceeding' && (
                <div role="status" className="mb-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-ink">
                    <b>This project will not proceed.</b> {project.consultation?.decisionReason ?? ''} The remaining steps are closed.
                </div>
            )}

            {/* Stepper */}
            <Panel className="mb-5 overflow-x-auto p-4">
                <ol className="flex min-w-[720px] items-start">
                    {STEPS.map((step, index) => {
                        const state = states[step.key];
                        const open = canOpen(state);
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
                                    <span
                                        aria-hidden
                                        className={cx('mt-6 h-0.5 w-6 shrink-0', finished ? 'bg-green-600' : 'bg-black/15')}
                                    />
                                )}
                            </li>
                        );
                    })}
                </ol>
            </Panel>

            {/* Selected step */}
            <Panel>
                {selected === 'consultation' && <ConsultationStep key={project.id} {...stepProps} />}
                {selected === 'siteAssessment' && <SiteAssessmentStep key={project.id} {...stepProps} />}
                {selected === 'designAssignment' && (
                    <DesignAssignmentStep key={project.id} {...stepProps} specialists={specialists ?? SAMPLE_SPECIALISTS} />
                )}
                {selected === 'designProposal' && <DesignProposalStep key={project.id} {...stepProps} />}
                {selected === 'contract' && <ContractStep key={project.id} {...stepProps} />}

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
