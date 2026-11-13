import { Link, router, usePage } from '@inertiajs/react';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    DangerButton,
    Field,
    GoldButton,
    OutlineButton,
    PageHeader,
    Panel,
    Pill,
    cx,
    inputClass,
    textareaClass,
} from '@/components/dashboard/ui';
import { RequestDetails, formatDate, formatDateTime, statusTone } from '@/components/project-manager/request-details';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SAMPLE_PROJECT_REQUESTS } from '@/data/project-manager/project-requests';
import type { ProjectRequest, RequestStatus } from '@/data/project-manager/project-requests';

/*
 * Backlog #13: Review and manage incoming project requests.
 * The Project Manager opens a request, reads what the customer submitted,
 * then approves or rejects it. A rejection cannot be sent without remarks.
 * Approved requests become projects on the Projects page.
 */

const REQUESTS_URL = '/project-manager/service-requests';

type Filter = 'All' | RequestStatus;
type Decision = 'approve' | 'reject';

const FILTERS: Filter[] = ['Pending', 'Approved', 'Rejected', 'All'];

type Props = {
    /** Sent by the controller. Leave it out to use the sample data. */
    requests?: ProjectRequest[];
};

export default function ProjectRequestReview({ requests }: Props) {
    const { props } = usePage();
    const managerName = props.auth?.user?.name ?? 'Project Manager';

    // While the backend is not ready, decisions are applied to a local copy of the sample data.
    const usingSample = requests === undefined;
    const [sampleRequests, setSampleRequests] = useState(SAMPLE_PROJECT_REQUESTS);
    const allRequests = requests ?? sampleRequests;

    // Toolbar
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('Pending');

    // Dialog: we keep the id, then look the request up, so the dialog always shows the latest data.
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const selected = allRequests.find((r) => r.id === selectedId) ?? null;

    // Approve / reject step inside the dialog
    const [decision, setDecision] = useState<Decision | null>(null);
    const [remarks, setRemarks] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const count = (f: Filter) => (f === 'All' ? allRequests.length : allRequests.filter((r) => r.status === f).length);

    const q = query.trim().toLowerCase();
    const visibleRequests = allRequests
        .filter((r) => filter === 'All' || r.status === filter)
        .filter(
            (r) =>
                !q ||
                r.code.toLowerCase().includes(q) ||
                r.customer.name.toLowerCase().includes(q) ||
                r.eventType.toLowerCase().includes(q) ||
                r.venue.toLowerCase().includes(q),
        )
        // Oldest first, so requests are reviewed in the order they came in.
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

    const openRequest = (r: ProjectRequest) => {
        setSelectedId(r.id);
        setDecision(null);
        setRemarks('');
        setError('');
    };

    const closeRequest = () => setSelectedId(null);

    const startDecision = (d: Decision) => {
        setDecision(d);
        setRemarks('');
        setError('');
    };

    const submitDecision = () => {
        if (!selected || !decision) return;

        const text = remarks.trim();

        // Acceptance criterion 2: a rejection without remarks is never sent.
        if (decision === 'reject' && !text) {
            setError('Remarks are required when rejecting a request. Tell the customer why it was rejected.');
            return;
        }

        const message =
            decision === 'approve'
                ? `${selected.code} approved. The customer has been notified.`
                : `${selected.code} rejected. The customer has been notified.`;

        const finish = () => {
            toast.success(message);
            closeRequest();
        };

        if (usingSample) {
            const status: RequestStatus = decision === 'approve' ? 'Approved' : 'Rejected';
            setSampleRequests((list) =>
                list.map((r) =>
                    r.id === selected.id
                        ? {
                              ...r,
                              status,
                              decision: { remarks: text || null, decidedBy: managerName, decidedAt: new Date().toISOString() },
                          }
                        : r,
                ),
            );
            finish();
            return;
        }

        // Real backend: saves the decision and notifies the customer (acceptance criterion 1).
        router.patch(
            `${REQUESTS_URL}/${selected.id}/${decision}`,
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
            <PageHeader
                title="Service Requests"
                description="Review incoming project requests and approve or reject them based on the submitted requirements."
            />

            {/* Toolbar: status tabs on the left, search on the right */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-sm" role="tablist" aria-label="Filter by status">
                    {FILTERS.map((f) => (
                        <button
                            key={f}
                            type="button"
                            role="tab"
                            aria-selected={filter === f}
                            onClick={() => setFilter(f)}
                            className={cx(
                                'rounded-lg px-4 py-1.5 text-sm font-semibold transition',
                                filter === f ? 'bg-gold text-white' : 'text-ink-soft hover:bg-gold/10',
                            )}
                        >
                            {f} <span className="ml-1 text-xs opacity-80">{count(f)}</span>
                        </button>
                    ))}
                </div>

                <div className="ml-auto w-full max-w-sm">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by request no., customer, event or venue..."
                        aria-label="Search requests"
                        className={inputClass}
                    />
                </div>
            </div>

            {/* Requests table: click a row to review that request */}
            <Panel className="overflow-x-auto p-0">
                <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-neutral-200/70 text-xs text-ink-soft uppercase">
                        <tr>
                            <th className="px-4 py-3 font-medium">Request No.</th>
                            <th className="px-2 py-3 font-medium">Customer</th>
                            <th className="px-2 py-3 font-medium">Event Type</th>
                            <th className="px-2 py-3 font-medium">Event Date</th>
                            <th className="px-2 py-3 font-medium">Budget</th>
                            <th className="px-2 py-3 font-medium">Submitted</th>
                            <th className="px-2 py-3 pr-4 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                        {visibleRequests.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-ink-soft">
                                    {q ? 'No requests match your search.' : `No ${filter === 'All' ? '' : filter.toLowerCase() + ' '}requests.`}
                                </td>
                            </tr>
                        ) : (
                            visibleRequests.map((r) => (
                                <tr
                                    key={r.id}
                                    tabIndex={0}
                                    aria-label={`Review ${r.code} from ${r.customer.name}`}
                                    onClick={() => openRequest(r)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') openRequest(r);
                                    }}
                                    className="cursor-pointer transition hover:bg-gold/10 focus-visible:bg-gold/10 focus-visible:outline-none"
                                >
                                    <td className="px-4 py-3 font-semibold text-ink">{r.code}</td>
                                    <td className="px-2 py-3 text-ink">{r.customer.name}</td>
                                    <td className="px-2 py-3 text-ink">{r.eventType}</td>
                                    <td className="px-2 py-3 text-ink">{formatDate(r.eventDate)}</td>
                                    <td className="px-2 py-3 text-ink">{r.budget}</td>
                                    <td className="px-2 py-3 text-ink-soft">{formatDateTime(r.submittedAt)}</td>
                                    <td className="px-2 py-3 pr-4">
                                        <Pill tone={statusTone[r.status]}>{r.status}</Pill>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Panel>

            {/* ---------------- Request details + decision ---------------- */}
            <Dialog open={selected !== null} onOpenChange={(open) => !open && closeRequest()}>
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
                    {selected && (
                        <>
                            <DialogHeader>
                                <div className="flex flex-wrap items-center gap-3 pr-6">
                                    <DialogTitle>
                                        {selected.code} · {selected.eventType}
                                    </DialogTitle>
                                    <Pill tone={statusTone[selected.status]}>{selected.status}</Pill>
                                </div>
                                <DialogDescription>
                                    Submitted by {selected.customer.name} on {formatDateTime(selected.submittedAt)}
                                </DialogDescription>
                            </DialogHeader>

                            <RequestDetails request={selected} />

                            {/* Already decided: show the saved decision (read-only) */}
                            {selected.status !== 'Pending' && selected.decision && (
                                <div
                                    className={cx(
                                        'rounded-xl border p-4',
                                        selected.status === 'Approved' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50',
                                    )}
                                >
                                    <p className="text-sm font-bold text-ink">
                                        {selected.status} by {selected.decision.decidedBy} on {formatDateTime(selected.decision.decidedAt)}
                                    </p>
                                    <p className="mt-1 text-sm text-ink-soft">
                                        {selected.decision.remarks ? `Remarks: ${selected.decision.remarks}` : 'No remarks.'}
                                    </p>
                                    {selected.status === 'Approved' && (
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
                            {selected.status === 'Pending' && decision === null && (
                                <DialogFooter>
                                    <OutlineButton onClick={closeRequest}>Close</OutlineButton>
                                    <DangerButton onClick={() => startDecision('reject')}>
                                        <X className="size-4" /> Reject
                                    </DangerButton>
                                    <GoldButton onClick={() => startDecision('approve')}>
                                        <Check className="size-4" /> Approve
                                    </GoldButton>
                                </DialogFooter>
                            )}

                            {/* Pending, decision started: ask for remarks, then confirm */}
                            {selected.status === 'Pending' && decision !== null && (
                                <form
                                    className="space-y-4 rounded-xl border border-gold/40 bg-gold/5 p-4"
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

                                    <DialogFooter>
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
                                    </DialogFooter>
                                </form>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
