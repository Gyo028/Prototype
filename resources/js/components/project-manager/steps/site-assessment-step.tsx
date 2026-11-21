import { router } from '@inertiajs/react';
import { ClipboardList, ExternalLink, FileText, ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { GoldButton, cx } from '@/components/dashboard/ui';
import { Detail, Section, formatDate, formatDateTime } from '@/components/project-manager/request-details';
import SiteAssessmentForm from '@/components/project-manager/site-assessment-form';
import type { SiteAssessmentErrors, SiteAssessmentValues } from '@/components/project-manager/site-assessment-form';
import { CompletedNotice, PROJECTS_URL, StepIntro, WaitingNotice } from '@/components/project-manager/steps/step-ui';
import type { StepProps } from '@/components/project-manager/steps/step-ui';
import { waitingReason } from '@/data/project-manager/projects';
import type { SiteAssessment } from '@/data/project-manager/projects';

/*
 * Step 2 · Site Assessment (backlog #20).
 * After the customer pays the reservation fee and books the ocular visit, the Project Manager
 * conducts it and uploads the site assessment report (PDF or DOCX) and venue photos.
 * Skipped when the consultation said no ocular visit is needed.
 */
export default function SiteAssessmentStep({ project, usingSample, managerName, onSaved }: StepProps) {
    const [editing, setEditing] = useState(false);
    const [serverErrors, setServerErrors] = useState<SiteAssessmentErrors>({});
    const [saving, setSaving] = useState(false);

    const ocularRequired = project.consultation?.ocularVisit.required ?? true;
    const waiting = waitingReason(project, 'siteAssessment');

    const save = (v: SiteAssessmentValues) => {
        const finish = () => {
            toast.success(`Site assessment saved for ${project.code}.`);
            setEditing(false);
        };

        if (usingSample) {
            const report: SiteAssessment['report'] = v.reportFile
                ? {
                      name: v.reportFile.name,
                      url: URL.createObjectURL(v.reportFile),
                      type: v.reportFile.name.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf',
                  }
                : project.siteAssessment!.report; // safe: the form only allows "keep" when a report exists

            let nextId = Date.now();
            onSaved({
                ...project,
                siteAssessment: {
                    assessedOn: v.assessedOn,
                    findings: v.findings.trim() || null,
                    report,
                    photos: [...v.keptPhotos, ...v.newPhotos.map((p) => ({ id: nextId++, name: p.file.name, url: p.preview }))],
                    recordedBy: managerName,
                    recordedAt: new Date().toISOString(),
                },
            });
            finish();
            return;
        }

        // Files are sent as multipart form data. POST is used because browsers cannot upload files with PATCH.
        router.post(
            `${PROJECTS_URL}/${project.id}/site-assessment`,
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
                    const photoError = Object.entries(errors).find(([key]) => key.startsWith('photos'))?.[1];
                    setServerErrors({ report: errors.report, assessedOn: errors.assessedOn, photos: photoError });
                },
            },
        );
    };

    return (
        <>
            <StepIntro title="Site Assessment">
                Upload the site assessment report and venue photos from the ocular visit, so the designer has complete information.
            </StepIntro>

            {!ocularRequired ? (
                <CompletedNotice>
                    <b>Skipped.</b> The consultation recorded that no ocular visit is needed for this project.
                </CompletedNotice>
            ) : waiting && !project.siteAssessment ? (
                <WaitingNotice>
                    <b>{waiting}</b>
                    <span className="mt-1 block text-ink-soft">This step opens once the ocular visit is booked.</span>
                </WaitingNotice>
            ) : (
                <div className="grid gap-4">
                    <Section title="Ocular Visit">
                        <Detail label="Booked by the customer for">
                            {project.ocularVisitAt ? formatDateTime(project.ocularVisitAt) : '—'}
                        </Detail>
                    </Section>

                    {editing ? (
                        <SiteAssessmentForm
                            project={project}
                            saving={saving}
                            serverErrors={serverErrors}
                            onCancel={() => setEditing(false)}
                            onSave={save}
                        />
                    ) : (
                        <>
                            {project.siteAssessment && <AssessmentSummary assessment={project.siteAssessment} />}
                            <div className="flex justify-end">
                                <GoldButton
                                    onClick={() => {
                                        setServerErrors({});
                                        setEditing(true);
                                    }}
                                >
                                    <ClipboardList className="size-4" />
                                    {project.siteAssessment ? 'Update Site Assessment' : 'Record Site Assessment'}
                                </GoldButton>
                            </div>
                        </>
                    )}
                </div>
            )}
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
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
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
