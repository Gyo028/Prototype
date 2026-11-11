import { router, usePage } from '@inertiajs/react';
import { ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { GoldButton, OutlineButton, PageHeader, Panel, cx, inputClass } from '@/components/dashboard/ui';
import ConsultationForm from '@/components/project-manager/consultation-form';
import type { ConsultationErrors, ConsultationValues } from '@/components/project-manager/consultation-form';
import {
    ConsultationBadge,
    ConsultationSummary,
    RequestDetails,
    formatDate,
    formatDateTime,
} from '@/components/project-manager/request-details';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SAMPLE_PROJECT_REQUESTS } from '@/data/project-manager/project-requests';
import type { Consultation, ProjectRequest } from '@/data/project-manager/project-requests';

/*
 * Backlog #16: Record consultation outcomes.
 * The Projects page lists approved requests. The Project Manager opens one,
 * records the consultation (see consultation-form.tsx), updates the project
 * details, and decides whether the project can proceed.
 */

const PROJECTS_URL = '/project-manager/projects';

type Filter = 'Awaiting' | 'Proceed' | 'Not proceeding' | 'All';

const FILTERS: { value: Filter; label: string }[] = [
    { value: 'Awaiting', label: 'Awaiting Consultation' },
    { value: 'Proceed', label: 'Proceed' },
    { value: 'Not proceeding', label: 'Not Proceeding' },
    { value: 'All', label: 'All' },
];

// Which tab a project belongs to, based on its consultation.
const stageOf = (p: ProjectRequest): Exclude<Filter, 'All'> =>
    !p.consultation ? 'Awaiting' : p.consultation.decision === 'Proceed' ? 'Proceed' : 'Not proceeding';

type Props = {
    /** Sent by the controller (approved requests only). Leave it out to use the sample data. */
    projects?: ProjectRequest[];
};

export default function ProjectList({ projects }: Props) {
    const { props } = usePage();
    const managerName = props.auth?.user?.name ?? 'Project Manager';

    // Sample mode: only approved requests become projects.
    const usingSample = projects === undefined;
    const [sampleProjects, setSampleProjects] = useState(() => SAMPLE_PROJECT_REQUESTS.filter((r) => r.status === 'Approved'));
    const allProjects = projects ?? sampleProjects;

    // Toolbar
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('Awaiting');

    // Dialog
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const selected = allProjects.find((p) => p.id === selectedId) ?? null;
    const [consulting, setConsulting] = useState(false);
    const [consultErrors, setConsultErrors] = useState<ConsultationErrors>({});
    const [saving, setSaving] = useState(false);

    const count = (f: Filter) => (f === 'All' ? allProjects.length : allProjects.filter((p) => stageOf(p) === f).length);

    const q = query.trim().toLowerCase();
    const visibleProjects = allProjects
        .filter((p) => filter === 'All' || stageOf(p) === filter)
        .filter(
            (p) =>
                !q ||
                p.code.toLowerCase().includes(q) ||
                p.customer.name.toLowerCase().includes(q) ||
                p.eventType.toLowerCase().includes(q) ||
                p.venue.toLowerCase().includes(q),
        )
        // Nearest event first.
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

    const openProject = (p: ProjectRequest) => {
        setSelectedId(p.id);
        setConsulting(false);
        setConsultErrors({});
    };

    const closeProject = () => setSelectedId(null);

    /** Saves the consultation and updates the project details (acceptance criterion 1). */
    const saveConsultation = (v: ConsultationValues) => {
        if (!selected) return;

        // The form already checked that outcome, ocular visit and decision are filled in,
        // so the `as` casts below are safe.
        const payload = {
            outcome: v.outcome as Consultation['outcome'],
            summary: v.summary.trim(),
            additionalNotes: v.additionalNotes.trim() || null,
            eventDate: v.eventDate,
            startTime: v.startTime,
            endTime: v.endTime,
            venue: v.venue.trim(),
            venueSetting: v.venueSetting,
            guests: v.guests ? Number(v.guests) : null,
            budget: v.budget,
            ocularVisitRequired: v.ocularVisitRequired === 'yes',
            ocularVisitAt: v.ocularVisitRequired === 'yes' ? `${v.ocularVisitDate}T${v.ocularVisitTime}` : null,
            decision: v.decision as Consultation['decision'],
            decisionReason: v.decision === 'Do not proceed' ? v.decisionReason.trim() : null,
        };

        const message =
            payload.decision === 'Proceed'
                ? `Consultation saved for ${selected.code}. The project can proceed.`
                : `Consultation saved for ${selected.code}. The project will not proceed.`;

        const finish = () => {
            toast.success(message);
            setConsulting(false); // back to the details view, which now shows the saved consultation
        };

        if (usingSample) {
            setSampleProjects((list) =>
                list.map((p) =>
                    p.id === selected.id
                        ? {
                              ...p,
                              // the project information is updated...
                              eventDate: payload.eventDate,
                              startTime: payload.startTime,
                              endTime: payload.endTime,
                              venue: payload.venue,
                              venueSetting: payload.venueSetting,
                              guests: payload.guests,
                              budget: payload.budget,
                              // ...and the consultation outcome is saved
                              consultation: {
                                  outcome: payload.outcome,
                                  summary: payload.summary,
                                  additionalNotes: payload.additionalNotes,
                                  ocularVisit: { required: payload.ocularVisitRequired, scheduledAt: payload.ocularVisitAt },
                                  decision: payload.decision,
                                  decisionReason: payload.decisionReason,
                                  recordedBy: managerName,
                                  recordedAt: new Date().toISOString(),
                              },
                          }
                        : p,
                ),
            );
            finish();
            return;
        }

        router.patch(`${PROJECTS_URL}/${selected.id}/consultation`, payload, {
            preserveScroll: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onSuccess: finish,
            onError: (errors) => {
                // Laravel names the ocular date/time "ocularVisitAt"; the form shows it under the date field.
                const { ocularVisitAt, ...rest } = errors;
                setConsultErrors({ ...rest, ...(ocularVisitAt ? { ocularVisitDate: ocularVisitAt } : {}) });
            },
        });
    };

    return (
        <>
            <PageHeader
                title="Projects"
                description="Approved requests. Record each consultation outcome and decide whether the project can proceed."
            />

            {/* Toolbar: consultation tabs on the left, search on the right */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-sm" role="tablist" aria-label="Filter by consultation">
                    {FILTERS.map((f) => (
                        <button
                            key={f.value}
                            type="button"
                            role="tab"
                            aria-selected={filter === f.value}
                            onClick={() => setFilter(f.value)}
                            className={cx(
                                'rounded-lg px-4 py-1.5 text-sm font-semibold transition',
                                filter === f.value ? 'bg-gold text-white' : 'text-ink-soft hover:bg-gold/10',
                            )}
                        >
                            {f.label} <span className="ml-1 text-xs opacity-80">{count(f.value)}</span>
                        </button>
                    ))}
                </div>

                <div className="ml-auto w-full max-w-sm">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by project no., customer, event or venue..."
                        aria-label="Search projects"
                        className={inputClass}
                    />
                </div>
            </div>

            {/* Projects table: click a row to open the project */}
            <Panel className="overflow-x-auto p-0">
                <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-neutral-200/70 text-xs text-ink-soft uppercase">
                        <tr>
                            <th className="px-4 py-3 font-medium">Project No.</th>
                            <th className="px-2 py-3 font-medium">Customer</th>
                            <th className="px-2 py-3 font-medium">Event Type</th>
                            <th className="px-2 py-3 font-medium">Event Date</th>
                            <th className="px-2 py-3 font-medium">Venue</th>
                            <th className="px-2 py-3 font-medium">Ocular Visit</th>
                            <th className="px-2 py-3 pr-4 font-medium">Consultation</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                                                {visibleProjects.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-ink-soft">
                                    {q ? 'No projects match your search.' : 'No projects here yet.'}
                                </td>
                            </tr>
                        ) : (
                            visibleProjects.map((p) => (
                                                                <tr
                                    key={p.id}
                                    tabIndex={0}
                                    aria-label={`Open ${p.code} for ${p.customer.name}`}
                                    onClick={() => openProject(p)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') openProject(p);
                                    }}
                                    className="cursor-pointer transition hover:bg-gold/10 focus-visible:bg-gold/10 focus-visible:outline-none"
                                >
                                    <td className="px-4 py-3 font-semibold text-ink">{p.code}</td>
                                    <td className="px-2 py-3 text-ink">{p.customer.name}</td>
                                    <td className="px-2 py-3 text-ink">{p.eventType}</td>
                                    <td className="px-2 py-3 text-ink">{formatDate(p.eventDate)}</td>
                                    <td className="max-w-[220px] truncate px-2 py-3 text-ink" title={p.venue}>
                                        {p.venue}
                                    </td>
                                    <td className="px-2 py-3 text-ink-soft">
                                        {!p.consultation
                                            ? '—'
                                            : p.consultation.ocularVisit.required
                                              ? p.consultation.ocularVisit.scheduledAt
                                                  ? formatDateTime(p.consultation.ocularVisit.scheduledAt)
                                                  : 'Required'
                                              : 'Not required'}
                                    </td>
                                    <td className="px-2 py-3 pr-4">
                                        <ConsultationBadge consultation={p.consultation} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Panel>

            {/* ---------------- Project details + consultation ---------------- */}
            <Dialog open={selected !== null} onOpenChange={(open) => !open && closeProject()}>
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
                    {selected && (
                        <>
                            <DialogHeader>
                                <div className="flex flex-wrap items-center gap-3 pr-6">
                                    <DialogTitle>
                                        {selected.code} · {selected.eventType}
                                    </DialogTitle>
                                    <ConsultationBadge consultation={selected.consultation} />
                                </div>
                                <DialogDescription>
                                    {consulting
                                        ? `Record the consultation with ${selected.customer.name} and decide if the project can proceed.`
                                        : `${selected.customer.name} · ${formatDate(selected.eventDate)}`}
                                </DialogDescription>
                            </DialogHeader>

                            {consulting ? (
                                <ConsultationForm
                                    key={selected.id}
                                    request={selected}
                                    saving={saving}
                                    serverErrors={consultErrors}
                                    onCancel={() => setConsulting(false)}
                                    onSave={saveConsultation}
                                />
                            ) : (
                                <>
                                    {selected.consultation ? (
                                        <ConsultationSummary consultation={selected.consultation} />
                                    ) : (
                                        <div className="rounded-xl border border-gold/40 bg-gold/5 p-4 text-sm text-ink">
                                            No consultation recorded yet. After meeting the customer, click{' '}
                                            <b>Record Consultation</b> to save the outcome.
                                        </div>
                                    )}

                                    <RequestDetails request={selected} />

                                    <DialogFooter>
                                        <OutlineButton onClick={closeProject}>Close</OutlineButton>
                                        <GoldButton
                                            onClick={() => {
                                                setConsultErrors({});
                                                setConsulting(true);
                                            }}
                                        >
                                            <ClipboardList className="size-4" />
                                            {selected.consultation ? 'Update Consultation' : 'Record Consultation'}
                                        </GoldButton>
                                    </DialogFooter>
                                </>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}