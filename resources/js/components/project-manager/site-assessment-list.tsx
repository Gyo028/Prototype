import { router, usePage } from '@inertiajs/react';
import { ClipboardList, ExternalLink, FileText, ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { GoldButton, OutlineButton, PageHeader, Panel, Pill, cx, inputClass } from '@/components/dashboard/ui';
import { Detail, Section, formatDate, formatDateTime } from '@/components/project-manager/request-details';
import SiteAssessmentForm from '@/components/project-manager/site-assessment-form';
import type { SiteAssessmentErrors, SiteAssessmentValues } from '@/components/project-manager/site-assessment-form';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SAMPLE_ASSESSMENT_PROJECTS } from '@/data/project-manager/site-assessments';
import type { AssessmentProject, SiteAssessment } from '@/data/project-manager/site-assessments';

/*
 * Backlog #20: Record site assessment details.
 * Lists the projects that can proceed. The Project Manager opens one and uploads the
 * site assessment report and venue photos, which are saved with the project's
 * specifications for the designing phase.
 */

const SITE_ASSESSMENTS_URL = '/project-manager/site-assessments';

type Filter = 'Pending' | 'Completed' | 'All';

const FILTERS: { value: Filter; label: string }[] = [
    { value: 'Pending', label: 'Pending Assessment' },
    { value: 'Completed', label: 'Completed' },
    { value: 'All', label: 'All' },
];

const stageOf = (p: AssessmentProject): Exclude<Filter, 'All'> => (p.assessment ? 'Completed' : 'Pending');

type Props = {
    /** Sent by the controller. Leave it out to use the sample data. */
    projects?: AssessmentProject[];
};

export default function SiteAssessmentList({ projects }: Props) {
    const { props } = usePage();
    const managerName = props.auth?.user?.name ?? 'Project Manager';

    const usingSample = projects === undefined;
    const [sampleProjects, setSampleProjects] = useState(SAMPLE_ASSESSMENT_PROJECTS);
    const allProjects = projects ?? sampleProjects;

    // Toolbar
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('Pending');

    // Dialog
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const selected = allProjects.find((p) => p.id === selectedId) ?? null;
    const [editing, setEditing] = useState(false);
    const [serverErrors, setServerErrors] = useState<SiteAssessmentErrors>({});
    const [saving, setSaving] = useState(false);

    const count = (f: Filter) => (f === 'All' ? allProjects.length : allProjects.filter((p) => stageOf(p) === f).length);

    const q = query.trim().toLowerCase();
    const visibleProjects = allProjects
        .filter((p) => filter === 'All' || stageOf(p) === filter)
        .filter(
            (p) =>
                !q ||
                p.code.toLowerCase().includes(q) ||
                p.customerName.toLowerCase().includes(q) ||
                p.eventType.toLowerCase().includes(q) ||
                p.venue.toLowerCase().includes(q),
        )
        // Nearest event first.
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

    const openProject = (p: AssessmentProject) => {
        setSelectedId(p.id);
        setEditing(false);
        setServerErrors({});
    };

    const closeProject = () => setSelectedId(null);

    /** Acceptance criterion 1: the report and photos are saved as part of the project's specifications. */
    const saveAssessment = (v: SiteAssessmentValues) => {
        if (!selected) return;

        const message = `Site assessment saved for ${selected.code}.`;
        const finish = () => {
            toast.success(message);
            setEditing(false);
        };

        if (usingSample) {
            const report: SiteAssessment['report'] = v.reportFile
                ? {
                      name: v.reportFile.name,
                      url: URL.createObjectURL(v.reportFile),
                      type: v.reportFile.name.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf',
                  }
                : selected.assessment!.report; // safe: the form only allows "keep" when a report exists

            let nextId = Date.now();
            const assessment: SiteAssessment = {
                assessedOn: v.assessedOn,
                findings: v.findings.trim() || null,
                report,
                photos: [...v.keptPhotos, ...v.newPhotos.map((p) => ({ id: nextId++, name: p.file.name, url: p.preview }))],
                recordedBy: managerName,
                recordedAt: new Date().toISOString(),
            };

            setSampleProjects((list) => list.map((p) => (p.id === selected.id ? { ...p, assessment } : p)));
            finish();
            return;
        }

        // Real backend: files are sent as multipart form data.
        // POST is used because browsers cannot upload files with PATCH.
        router.post(
            `${SITE_ASSESSMENTS_URL}/${selected.id}`,
            {
                assessedOn: v.assessedOn,
                findings: v.findings.trim() || null,
                report: v.reportFile, // null = keep the saved report
                keepPhotoIds: v.keptPhotos.map((p) => p.id),
                photos: v.newPhotos.map((p) => p.file),
            },
            {
                forceFormData: true,
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => {
                    v.newPhotos.forEach((p) => URL.revokeObjectURL(p.preview));
                    finish();
                },
                onError: (errors) => {
                    // Laravel reports each photo as photos.0, photos.1, ...; show them together.
                    const photoError = Object.entries(errors).find(([key]) => key.startsWith('photos'))?.[1];
                    setServerErrors({ report: errors.report, assessedOn: errors.assessedOn, photos: photoError });
                },
            },
        );
    };
    
    return (
        <>
            <PageHeader
                title="Site Assessments"
                description="Upload the site assessment report and venue photos so complete project information is available for the designing phase."
            />

            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-sm" role="tablist" aria-label="Filter by assessment">
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
                        aria-label="Search site assessments"
                        className={inputClass}
                    />
                </div>
            </div>

            {/* Table */}
            <Panel className="overflow-x-auto p-0">
                <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-neutral-200/70 text-xs text-ink-soft uppercase">
                        <tr>
                            <th className="px-4 py-3 font-medium">Project No.</th>
                            <th className="px-2 py-3 font-medium">Customer</th>
                            <th className="px-2 py-3 font-medium">Event</th>
                            <th className="px-2 py-3 font-medium">Event Date</th>
                            <th className="px-2 py-3 font-medium">Venue</th>
                            <th className="px-2 py-3 font-medium">Ocular Visit</th>
                            <th className="px-2 py-3 pr-4 font-medium">Assessment</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                        {visibleProjects.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-ink-soft">
                                    {q ? 'No projects match your search.' : 'No projects here.'}
                                </td>
                            </tr>
                        ) : (
                            visibleProjects.map((p) => (
                                <tr
                                    key={p.id}
                                    tabIndex={0}
                                    aria-label={`Open ${p.code} for ${p.customerName}`}
                                    onClick={() => openProject(p)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') openProject(p);
                                    }}
                                    className="cursor-pointer transition hover:bg-gold/10 focus-visible:bg-gold/10 focus-visible:outline-none"
                                >
                                    <td className="px-4 py-3 font-semibold text-ink">{p.code}</td>
                                    <td className="px-2 py-3 text-ink">{p.customerName}</td>
                                    <td className="px-2 py-3 text-ink">{p.eventType}</td>
                                    <td className="px-2 py-3 text-ink">{formatDate(p.eventDate)}</td>
                                    <td className="max-w-[220px] truncate px-2 py-3 text-ink" title={p.venue}>
                                        {p.venue}
                                    </td>
                                    <td className="px-2 py-3 text-ink-soft">{p.ocularVisitAt ? formatDateTime(p.ocularVisitAt) : '—'}</td>
                                    <td className="px-2 py-3 pr-4">
                                        {p.assessment ? <Pill tone="green">Completed</Pill> : <Pill tone="yellow">Pending</Pill>}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Panel>

            {/* ---------------- Project + site assessment ---------------- */}
            <Dialog open={selected !== null} onOpenChange={(open) => !open && closeProject()}>
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
                    {selected && (
                        <>
                            <DialogHeader>
                                <div className="flex flex-wrap items-center gap-3 pr-6">
                                    <DialogTitle>
                                        {selected.code} · {selected.eventType}
                                    </DialogTitle>
                                    {selected.assessment ? <Pill tone="green">Completed</Pill> : <Pill tone="yellow">Pending</Pill>}
                                </div>
                                <DialogDescription>
                                    {selected.customerName} · {formatDate(selected.eventDate)}
                                </DialogDescription>
                            </DialogHeader>

                            <Section title="Venue">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <Detail label="Venue">
                                            {selected.venue} ({selected.venueSetting})
                                        </Detail>
                                    </div>
                                    <Detail label="Ocular visit">
                                        {selected.ocularVisitAt ? formatDateTime(selected.ocularVisitAt) : 'Not scheduled'}
                                    </Detail>
                                    <Detail label="Event date">{formatDate(selected.eventDate)}</Detail>
                                </div>
                            </Section>

                            {editing ? (
                                <SiteAssessmentForm
                                    key={selected.id}
                                    project={selected}
                                    saving={saving}
                                    serverErrors={serverErrors}
                                    onCancel={() => setEditing(false)}
                                    onSave={saveAssessment}
                                />
                            ) : (
                                <>
                                    {selected.assessment ? (
                                        <AssessmentSummary assessment={selected.assessment} />
                                    ) : (
                                        <div className="rounded-xl border border-gold/40 bg-gold/5 p-4 text-sm text-ink">
                                            No site assessment recorded yet. After the ocular visit, click{' '}
                                            <b>Record Site Assessment</b> to upload the report and venue photos.
                                        </div>
                                    )}

                                    <DialogFooter>
                                        <OutlineButton onClick={closeProject}>Close</OutlineButton>
                                        <GoldButton
                                            onClick={() => {
                                                setServerErrors({});
                                                setEditing(true);
                                            }}
                                        >
                                            <ClipboardList className="size-4" />
                                            {selected.assessment ? 'Update Site Assessment' : 'Record Site Assessment'}
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

/** Read-only view of a saved site assessment. */
function AssessmentSummary({ assessment: a }: { assessment: SiteAssessment }) {
    return (
        <Section title="Site Assessment">
            <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                    <Detail label="Assessment date">{formatDate(a.assessedOn)}</Detail>
                    <Detail label="Venue photos">{a.photos.length}</Detail>
                    {a.findings && (
                        <div className="col-span-2">
                            <Detail label="Findings / notes">{a.findings}</Detail>
                        </div>
                    )}
                </div>

                <a
                    href={a.report.url || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-black/15 p-3 transition hover:border-gold hover:bg-gold/10"
                >
                    <FileText className={cx('size-6 shrink-0', a.report.type === 'pdf' ? 'text-red-600' : 'text-sky-600')} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{a.report.name}</span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-gold-dark">
                        Open <ExternalLink className="size-3.5" />
                    </span>
                </a>

                {a.photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {a.photos.map((p) => (
                            <a
                                key={p.id}
                                href={p.url || undefined}
                                target="_blank"
                                rel="noreferrer"
                                title={p.name}
                                className="aspect-square overflow-hidden rounded-lg border border-black/10 bg-neutral-100"
                            >
                                {p.url ? (
                                    <img src={p.url} alt={p.name} className="size-full object-cover" />
                                ) : (
                                    <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
                                        <ImageIcon className="size-6 text-ink-soft" />
                                        <span className="line-clamp-2 text-[10px] break-all text-ink-soft">{p.name}</span>
                                    </div>
                                )}
                            </a>
                        ))}
                    </div>
                )}

                <p className="text-xs text-ink-soft">
                    Recorded by {a.recordedBy} on {formatDateTime(a.recordedAt)}
                </p>
            </div>
        </Section>
    );
}