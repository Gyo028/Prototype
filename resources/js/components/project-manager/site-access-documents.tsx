import { router } from '@inertiajs/react';
import { Check, ExternalLink, FileText, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DangerButton, Field, GoldButton, OutlineButton, Pill, cx, textareaClass } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import { Section, formatDateTime } from '@/components/project-manager/request-details';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';
import type { Project, SiteAccessDocument } from '@/data/project-manager/projects';

/*
 * Part of backlog #20 (decided with the user, Nov 25): the site access documents.
 * For an ocular visit at a third-party venue, the customer uploads an authorization letter
 * and a venue permit. The Project Manager approves or rejects each one (a reason is required
 * when rejecting). When both are approved, the visit is confirmed.
 * Real data only (the sample projects have no documents).
 */

const statusTone: Record<SiteAccessDocument['status'], PillTone> = { Submitted: 'yellow', Approved: 'green', Rejected: 'red' };
const statusLabel: Record<SiteAccessDocument['status'], string> = { Submitted: 'For Review', Approved: 'Approved', Rejected: 'Rejected' };

export default function SiteAccessDocuments({ project }: { project: Project }) {
    const docs = project.siteAccessDocuments ?? [];
    const pending = project.ocularVisitStatus === 'pending';

    return (
        <Section title="Site Access Documents">
            <p className="mb-3 text-sm text-ink-soft">
                {pending
                    ? 'The ocular visit is at a third-party venue. Approve both documents to confirm the visit. If one is wrong, reject it with a reason so the customer can upload a new one.'
                    : 'The ocular visit is at a third-party venue. Both documents were approved.'}
            </p>
            <div className="grid gap-3">
                {docs.map((doc) => (
                    <DocumentRow key={doc.id} project={project} doc={doc} />
                ))}
            </div>
        </Section>
    );
}

function DocumentRow({ project, doc }: { project: Project; doc: SiteAccessDocument }) {
    const [rejecting, setRejecting] = useState(false);
    const [remarks, setRemarks] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const send = (decision: 'approve' | 'reject') => {
        const text = remarks.trim();
        if (decision === 'reject' && !text) {
            setError('Give the reason for rejecting this document. The customer will see it.');
            return;
        }

        router.patch(
            `${PROJECTS_URL}/${project.id}/site-access-documents/${doc.id}`,
            { decision, remarks: decision === 'reject' ? text : null },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => {
                    toast.success(
                        decision === 'approve'
                            ? `${doc.type} approved.`
                            : `${doc.type} rejected. The customer has been asked to upload a new one.`,
                    );
                    setRejecting(false);
                },
                onError: (errors) => setError(errors.remarks ?? errors.decision ?? 'The review could not be saved. Please try again.'),
            },
        );
    };

        return (
        <div className="grid gap-3 rounded-xl border border-black/10 p-4">
            <div className="flex flex-wrap items-center gap-3">
                <FileText className="size-5 shrink-0 text-red-600" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{doc.type}</p>
                    <p className="truncate text-xs text-ink-soft">
                        {doc.name}
                        {doc.uploadedAt && ` · uploaded ${formatDateTime(doc.uploadedAt)}`}
                    </p>
                </div>
                <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold text-gold-dark hover:underline"
                >
                    Open <ExternalLink className="size-3.5" />
                </a>
                <Pill tone={statusTone[doc.status]}>{statusLabel[doc.status]}</Pill>
            </div>

            {doc.status === 'Rejected' && doc.remarks && <p className="text-xs text-red-700">Reason: {doc.remarks}</p>}

            {doc.status === 'Submitted' &&
                (rejecting ? (
                    <form
                        className="grid gap-3 rounded-lg border border-gold/40 bg-gold/5 p-3"
                        onSubmit={(e) => {
                            e.preventDefault();
                            send('reject');
                        }}
                    >
                        <Field label="Reason for rejection" htmlFor={`doc-remarks-${doc.id}`} required error={error}>
                            <textarea
                                id={`doc-remarks-${doc.id}`}
                                autoFocus
                                value={remarks}
                                maxLength={255}
                                onChange={(e) => {
                                    setRemarks(e.target.value);
                                    if (error) setError('');
                                }}
                                placeholder="e.g. The venue permit has expired. Please upload the current one."
                                className={cx(textareaClass, error && 'border-red-500')}
                            />
                        </Field>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <OutlineButton onClick={() => setRejecting(false)} disabled={saving}>
                                Back
                            </OutlineButton>
                            <DangerButton type="submit" disabled={saving}>
                                {saving ? 'Rejecting...' : 'Confirm Rejection'}
                            </DangerButton>
                        </div>
                    </form>
                ) : (
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        {error && <p className="text-xs text-red-600 sm:mr-auto">{error}</p>}
                        <DangerButton
                            onClick={() => {
                                setRemarks('');
                                setError('');
                                setRejecting(true);
                            }}
                            disabled={saving}
                        >
                            <X className="size-4" /> Reject
                        </DangerButton>
                        <GoldButton onClick={() => send('approve')} disabled={saving}>
                            <Check className="size-4" /> {saving ? 'Approving...' : 'Approve'}
                        </GoldButton>
                    </div>
                ))}
        </div>
    );
}