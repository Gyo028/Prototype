import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DangerButton, Field, GoldButton, OutlineButton, Panel, Pill, cx, textareaClass } from '@/components/dashboard/ui';
import { REQUESTS_URL } from '@/components/project-manager/project-request-review';
import { RequestDetails, formatDateTime, statusTone } from '@/components/project-manager/request-details';
import { getSampleRequest, saveSampleRequest } from '@/data/project-manager/project-requests';
import type { ProjectRequest, RequestStatus } from '@/data/project-manager/project-requests';

/*
 * Backlog #13 (review): one service request on its own page.
 * The Project Manager reads what the customer submitted, then approves or rejects it.
 *   - The decision is saved and the customer is notified (acceptance criterion 1).
 *   - A rejection cannot be sent without remarks (acceptance criterion 2).
 * Revision (leader, Nov 19): this used to be a pop-up on the list; it is now a page.
 */

type Decision = 'approve' | 'reject';

type Props = {
    /** Sent by the controller. Leave it out to use the sample data. */
    request?: ProjectRequest;
    /** Used to find the sample request while the backend is not ready. */
    requestId: number;
};

export default function ProjectRequestDetail({ request: serverRequest, requestId }: Props) {
    const { props } = usePage();
    const managerName = props.auth?.user?.name ?? 'Project Manager';

    const usingSample = serverRequest === undefined;
    const [sampleRequest, setSampleRequest] = useState(() => getSampleRequest(requestId));
    const request = serverRequest ?? sampleRequest;

    const [decision, setDecision] = useState<Decision | null>(null);
    const [remarks, setRemarks] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    if (!request) {
        return (
            <Panel className="text-center">
                <p className="mb-3 text-ink">This service request could not be found.</p>
                <Link href={REQUESTS_URL} className="font-semibold text-gold-dark underline">
                    Back to Service Requests
                </Link>
            </Panel>
        );
    }
    
    const startDecision = (d: Decision) => {
        setDecision(d);
        setRemarks('');
        setError('');
    };

    const submitDecision = () => {
        if (!decision) return;
        const text = remarks.trim();

        // Acceptance criterion 2: a rejection without remarks is never sent.
        if (decision === 'reject' && !text) {
            setError('Remarks are required when rejecting a request. Tell the customer why it was rejected.');
            return;
        }

        const finish = () => {
            toast.success(`${request.code} ${decision === 'approve' ? 'approved' : 'rejected'}. The customer has been notified.`);
            setDecision(null);
        };

        if (usingSample) {
            const status: RequestStatus = decision === 'approve' ? 'Approved' : 'Rejected';
            const updated: ProjectRequest = {
                ...request,
                status,
                decision: { remarks: text || null, decidedBy: managerName, decidedAt: new Date().toISOString() },
            };
            saveSampleRequest(updated);
            setSampleRequest(updated);
            finish();
            return;
        }

        // Real backend: saves the decision and notifies the customer (acceptance criterion 1).
        router.patch(
            `${REQUESTS_URL}/${request.id}/${decision}`,
            { remarks: text || null },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: finish,
                onError: (errors) => setError(errors.remarks ?? 'The decision could not be saved. Please try again.'),
            },
        );
    };
    
    return (
        <>
            <Head title={`${request.code} · Service Requests`} />

            {/* Header */}
            <Link href={REQUESTS_URL} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-gold-dark hover:underline">
                <ArrowLeft className="size-4" /> All Service Requests
            </Link>

            <div className="mb-5">
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold text-ink">
                        {request.code} · {request.eventType}
                    </h1>
                    <Pill tone={statusTone[request.status]}>{request.status}</Pill>
                </div>
                <p className="text-sm text-ink-soft">
                    Submitted by {request.customer.name} on {formatDateTime(request.submittedAt)}
                </p>
            </div>

            {/* Everything the customer submitted */}
            <RequestDetails request={request} />

            {/* Already decided: show the saved decision (read-only) */}
            {request.status !== 'Pending' && request.decision && (
                <div
                    className={cx(
                        'mt-4 rounded-xl border p-4',
                        request.status === 'Approved' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50',
                    )}
                >
                    <p className="text-sm font-bold text-ink">
                        {request.status} by {request.decision.decidedBy} on {formatDateTime(request.decision.decidedAt)}
                    </p>
                    <p className="mt-1 text-sm text-ink-soft">
                        {request.decision.remarks ? `Remarks: ${request.decision.remarks}` : 'No remarks.'}
                    </p>
                    {request.status === 'Approved' && (
                        <p className="mt-2 text-sm text-ink">
                            Next step: this is now a project. Continue its planning on the{' '}
                            <Link href="/project-manager/projects" className="font-semibold text-gold-dark underline">
                                Projects
                            </Link>{' '}
                            page.
                        </p>
                    )}
                </div>
            )}
            
            {/* Pending, no decision started yet: show the two choices */}
            {request.status === 'Pending' && decision === null && (
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <DangerButton onClick={() => startDecision('reject')}>
                        <X className="size-4" /> Reject
                    </DangerButton>
                    <GoldButton onClick={() => startDecision('approve')}>
                        <Check className="size-4" /> Approve
                    </GoldButton>
                </div>
            )}

            {/* Pending, decision started: ask for remarks, then confirm */}
            {request.status === 'Pending' && decision !== null && (
                <form
                    noValidate
                    className="mt-4 space-y-4 rounded-xl border border-gold/40 bg-gold/5 p-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submitDecision();
                    }}
                >
                    <Field
                        label={decision === 'reject' ? 'Reason for rejection' : 'Remarks (optional)'}
                        htmlFor="decision-remarks"
                        required={decision === 'reject'}
                        error={error}
                    >
                        <textarea
                            id="decision-remarks"
                            autoFocus
                            value={remarks}
                            onChange={(e) => {
                                setRemarks(e.target.value);
                                if (error) setError('');
                            }}
                            placeholder={
                                decision === 'reject'
                                    ? 'e.g. The budget does not cover the selected services for this guest count.'
                                    : 'e.g. Requirements are complete. Please book a consultation.'
                            }
                            className={cx(textareaClass, error && 'border-red-500')}
                        />
                    </Field>
                    <p className="text-xs text-ink-soft">The customer will be notified and will see these remarks.</p>

                    <div className="flex flex-wrap justify-end gap-2">
                        <OutlineButton onClick={() => setDecision(null)} disabled={saving}>
                            Back
                        </OutlineButton>
                        {decision === 'reject' ? (
                            <DangerButton type="submit" disabled={saving}>
                                {saving ? 'Rejecting...' : 'Confirm Rejection'}
                            </DangerButton>
                        ) : (
                            <GoldButton type="submit" disabled={saving}>
                                {saving ? 'Approving...' : 'Confirm Approval'}
                            </GoldButton>
                        )}
                    </div>
                </form>
            )}
        </>
    );
}