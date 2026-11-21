import { FileText, ImageIcon, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Field, GoldButton, OutlineButton, cx, inputClass, textareaClass } from '@/components/dashboard/ui';
import { DialogFooter } from '@/components/ui/dialog';
import { PHOTO_EXTENSIONS, PHOTO_MAX_MB, REPORT_EXTENSIONS, REPORT_MAX_MB } from '@/data/project-manager/projects';
import type { Project, SitePhoto } from '@/data/project-manager/projects';

/*
 * Backlog #20: Record site assessment details.
 * The Project Manager uploads the site assessment report (PDF or DOCX) and venue photos.
 * The form will not save without a report (acceptance criterion 2).
 */

/** A photo picked in this form but not saved yet. `preview` is a temporary browser URL for the thumbnail. */
export type NewPhoto = { key: string; file: File; preview: string };

/** What the form hands back when it is valid. */
export type SiteAssessmentValues = {
    assessedOn: string;
    findings: string;
    reportFile: File | null; // null = keep the report that is already saved
    keptPhotos: SitePhoto[]; // saved photos the Project Manager did not remove
    newPhotos: NewPhoto[];
};

export type SiteAssessmentErrors = Partial<Record<'report' | 'photos' | 'assessedOn', string>>;

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const tooBig = (file: File, maxMb: number) => file.size > maxMb * 1024 * 1024;
const today = () => new Date().toISOString().slice(0, 10);

type Props = {
    project: Project;
    saving: boolean;
    /** Validation errors sent back by Laravel, if any. */
    serverErrors: SiteAssessmentErrors;
    onCancel: () => void;
    onSave: (values: SiteAssessmentValues) => void;
};

export default function SiteAssessmentForm({ project, saving, serverErrors, onCancel, onSave }: Props) {
    const saved = project.siteAssessment;

    const [assessedOn, setAssessedOn] = useState(saved?.assessedOn ?? project.ocularVisitAt?.slice(0, 10) ?? today());
    const [findings, setFindings] = useState(saved?.findings ?? '');
    const [reportFile, setReportFile] = useState<File | null>(null);
    const [keptPhotos, setKeptPhotos] = useState<SitePhoto[]>(saved?.photos ?? []);
    const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
    const [clientErrors, setClientErrors] = useState<SiteAssessmentErrors>({});

    const reportInput = useRef<HTMLInputElement>(null);
    const photoInput = useRef<HTMLInputElement>(null);

    const errors = { ...serverErrors, ...clientErrors };
    const hasReport = reportFile !== null || saved !== null;

    // Free the temporary preview URLs when the form closes without saving.
    const newPhotosRef = useRef(newPhotos);
    newPhotosRef.current = newPhotos;
    const savedRef = useRef(false);
    useEffect(
        () => () => {
            if (!savedRef.current) newPhotosRef.current.forEach((p) => URL.revokeObjectURL(p.preview));
        },
        [],
    );

    const setError = (key: keyof SiteAssessmentErrors, message?: string) =>
        setClientErrors((e) => {
            const next = { ...e };
            if (message) next[key] = message;
            else delete next[key];
            return next;
        });

    /** Checks the picked report: only PDF or DOCX, and not too large. */
    const pickReport = (file: File | undefined) => {
        if (!file) return;
        if (!(REPORT_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))) {
            setError('report', 'The report must be a PDF or DOCX file.');
        } else if (tooBig(file, REPORT_MAX_MB)) {
            setError('report', `The report must be ${REPORT_MAX_MB} MB or smaller.`);
        } else {
            setReportFile(file);
            setError('report');
        }
        if (reportInput.current) reportInput.current.value = ''; // lets the same file be picked again
    };

    /** Adds the picked photos, skipping any that are the wrong type or too large. */
    const pickPhotos = (files: FileList | null) => {
        if (!files) return;
        const accepted: NewPhoto[] = [];
        const skipped: string[] = [];

        Array.from(files).forEach((file) => {
            const okType = (PHOTO_EXTENSIONS as readonly string[]).includes(extensionOf(file.name));
            if (!okType || tooBig(file, PHOTO_MAX_MB)) {
                skipped.push(file.name);
                return;
            }
            accepted.push({ key: `${file.name}-${file.lastModified}-${Math.random()}`, file, preview: URL.createObjectURL(file) });
        });

        setNewPhotos((list) => [...list, ...accepted]);
        setError(
            'photos',
            skipped.length
                ? `Skipped ${skipped.join(', ')}. Photos must be JPG, PNG or WEBP and ${PHOTO_MAX_MB} MB or smaller.`
                : undefined,
        );
        if (photoInput.current) photoInput.current.value = '';
    };

    const removeNewPhoto = (key: string) =>
        setNewPhotos((list) => {
            const photo = list.find((p) => p.key === key);
            if (photo) URL.revokeObjectURL(photo.preview);
            return list.filter((p) => p.key !== key);
        });

    const submit = () => {
        const e: SiteAssessmentErrors = {};

        // Acceptance criterion 2: no report, no save.
        if (!hasReport) e.report = 'Upload the site assessment report (PDF or DOCX) before saving.';
        if (!assessedOn) e.assessedOn = 'Set the date of the site assessment.';

        setClientErrors(e);
        if (Object.keys(e).length) return;

        savedRef.current = true;
        onSave({ assessedOn, findings, reportFile, keptPhotos, newPhotos });
    };

    const photoCount = keptPhotos.length + newPhotos.length;

    return (
        <form
            className="grid gap-4"
            noValidate
            onSubmit={(e) => {
                e.preventDefault();
                submit();
            }}
        >
            {/* 1. Report (required) */}
            <section className="rounded-xl border border-black/10 p-4">
                <h3 className="mb-1 text-sm font-bold text-ink">
                    Site assessment report <span className="text-red-600">*</span>
                </h3>
                <p className="mb-3 text-xs text-ink-soft">
                    PDF or DOCX, up to {REPORT_MAX_MB} MB.
                    {saved && !reportFile && ' A report is already saved. Upload a new one only to replace it.'}
                </p>

                {(reportFile || saved) && (
                    <div className="mb-3 flex items-center gap-3 rounded-lg border border-gold/40 bg-gold/5 p-3">
                        <FileText className="size-5 shrink-0 text-red-600" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                            {reportFile ? reportFile.name : saved?.report.name}
                        </span>
                        {reportFile && (
                            <button
                                type="button"
                                onClick={() => setReportFile(null)}
                                aria-label="Remove the selected report"
                                className="rounded p-1 text-ink-soft hover:bg-black/5 hover:text-red-600"
                            >
                                <X className="size-4" />
                            </button>
                        )}
                    </div>
                )}

                <input
                    ref={reportInput}
                    id="sa-report"
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => pickReport(e.target.files?.[0])}
                />
                <OutlineButton
                    onClick={() => reportInput.current?.click()}
                    className={cx(errors.report && 'border-red-500 text-red-600')}
                >
                    <Upload className="size-4" />
                    {reportFile || saved ? 'Replace Report' : 'Upload Report'}
                </OutlineButton>
                {errors.report && <p className="mt-2 text-xs text-red-600">{errors.report}</p>}
            </section>

            {/* 2. Venue photos (optional) */}
            <section className="rounded-xl border border-black/10 p-4">
                <h3 className="mb-1 text-sm font-bold text-ink">Venue photos (optional)</h3>
                <p className="mb-3 text-xs text-ink-soft">
                    JPG, PNG or WEBP, up to {PHOTO_MAX_MB} MB each. {photoCount} selected.
                </p>

                {photoCount > 0 && (
                    <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {keptPhotos.map((p) => (
                            <PhotoTile
                                key={`saved-${p.id}`}
                                name={p.name}
                                src={p.url}
                                onRemove={() => setKeptPhotos((list) => list.filter((x) => x.id !== p.id))}
                            />
                        ))}
                        {newPhotos.map((p) => (
                            <PhotoTile key={p.key} name={p.file.name} src={p.preview} isNew onRemove={() => removeNewPhoto(p.key)} />
                        ))}
                    </div>
                )}

                <input
                    ref={photoInput}
                    id="sa-photos"
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => pickPhotos(e.target.files)}
                />
                <OutlineButton onClick={() => photoInput.current?.click()}>
                    <ImageIcon className="size-4" /> Add Photos
                </OutlineButton>
                {errors.photos && <p className="mt-2 text-xs text-red-600">{errors.photos}</p>}
            </section>

            {/* 3. Date and findings */}
            <section className="grid gap-4 rounded-xl border border-black/10 p-4 sm:grid-cols-3">
                <Field label="Assessment date" htmlFor="sa-date" required error={errors.assessedOn}>
                    <input
                        id="sa-date"
                        type="date"
                        value={assessedOn}
                        onChange={(e) => {
                            setAssessedOn(e.target.value);
                            setError('assessedOn');
                        }}
                        className={inputClass}
                    />
                </Field>
                <Field label="Findings / notes (optional)" htmlFor="sa-findings" className="sm:col-span-2">
                    <textarea
                        id="sa-findings"
                        value={findings}
                        onChange={(e) => setFindings(e.target.value)}
                        placeholder="e.g. Ceiling height 4 m; power outlets on the east wall only."
                        className={textareaClass}
                    />
                </Field>
            </section>

            {errors.report && (
                <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-700">
                    The site assessment was not saved. Upload the site assessment report first.
                </div>
            )}

            <DialogFooter>
                <OutlineButton onClick={onCancel} disabled={saving}>
                    Cancel
                </OutlineButton>
                <GoldButton type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Site Assessment'}
                </GoldButton>
            </DialogFooter>
        </form>
    );
}

/** One square photo thumbnail with a remove button. Shows an icon when there is no image to load. */
function PhotoTile({ name, src, isNew, onRemove }: { name: string; src: string; isNew?: boolean; onRemove: () => void }) {
    return (
        <div className="group relative aspect-square overflow-hidden rounded-lg border border-black/10 bg-neutral-100" title={name}>
            {src ? (
                <img src={src} alt={name} className="size-full object-cover" />
            ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
                    <ImageIcon className="size-6 text-ink-soft" />
                    <span className="line-clamp-2 text-[10px] break-all text-ink-soft">{name}</span>
                </div>
            )}
            {isNew && <span className="absolute bottom-1 left-1 rounded bg-gold px-1.5 text-[10px] font-bold text-white">NEW</span>}
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${name}`}
                className="absolute top-1 right-1 rounded-full bg-white/90 p-1 text-ink shadow hover:text-red-600"
            >
                <X className="size-3.5" />
            </button>
        </div>
    );
}
