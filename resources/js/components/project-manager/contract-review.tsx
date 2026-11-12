import { router, usePage } from '@inertiajs/react';
import { Check, ExternalLink, FileText, X } from 'lucide-react';
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
import type { PillTone } from '@/components/dashboard/ui';
import { Detail, Section, formatDate, formatDateTime, peso } from '@/components/project-manager/request-details';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { CONTRACT_CHECKLIST, SAMPLE_CONTRACTS } from '@/data/project-manager/contracts';
import type { ChecklistId, Contract, ContractStatus } from '@/data/project-manager/contracts';

/*
 * Backlog #18: Review and verify the submitted signed project contract.
 * The Project Manager opens the signed contract, ticks the verification checklist,
 * then approves or rejects it.
 *   - Approve is only possible when every checklist item is ticked
 *     (so only valid and properly signed contracts are approved).
 *   - Reject cannot be sent without remarks (acceptance criterion 2).
 */

const CONTRACTS_URL = '/project-manager/contracts';

type Filter = 'All' | ContractStatus;
type Decision = 'approve' | 'reject';

const FILTERS: Filter[] = ['For Review', 'Approved', 'Rejected', 'All'];

const statusTone: Record<ContractStatus, PillTone> = {
    'For Review': 'yellow',
    Approved: 'green',
    Rejected: 'red',
};

type Props = {
    /** Sent by the controller. Leave it out to use the sample data. */
    contracts?: Contract[];
};

export default function ContractReview({ contracts }: Props) {
    const { props } = usePage();
    const managerName = props.auth?.user?.name ?? 'Project Manager';

    // While the backend is not ready, reviews are applied to a local copy of the sample data.
    const usingSample = contracts === undefined;
    const [sampleContracts, setSampleContracts] = useState(SAMPLE_CONTRACTS);
    const allContracts = contracts ?? sampleContracts;

    // Toolbar
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('For Review');

    // Dialog
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const selected = allContracts.find((c) => c.id === selectedId) ?? null;

    // Review step inside the dialog
    const [checked, setChecked] = useState<ChecklistId[]>([]);
    const [decision, setDecision] = useState<Decision | null>(null);
    const [remarks, setRemarks] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const allChecked = checked.length === CONTRACT_CHECKLIST.length;

    const count = (f: Filter) => (f === 'All' ? allContracts.length : allContracts.filter((c) => c.status === f).length);

    const q = query.trim().toLowerCase();
    const visibleContracts = allContracts
        .filter((c) => filter === 'All' || c.status === filter)
        .filter(
            (c) =>
                !q ||
                c.code.toLowerCase().includes(q) ||
                c.project.code.toLowerCase().includes(q) ||
                c.project.customerName.toLowerCase().includes(q) ||
                c.project.eventType.toLowerCase().includes(q),
        )
        // Oldest first, so contracts are reviewed in the order they came in.
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

    const openContract = (c: Contract) => {
        setSelectedId(c.id);
        setChecked([]);
        setDecision(null);
        setRemarks('');
        setError('');
    };

    const closeContract = () => setSelectedId(null);

    const toggleCheck = (id: ChecklistId) =>
        setChecked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

    const startDecision = (d: Decision) => {
        setDecision(d);
        setRemarks('');
        setError('');
    };

    const submitReview = () => {
        if (!selected || !decision) return;

        const text = remarks.trim();

        // Only a fully verified contract can be approved.
        if (decision === 'approve' && !allChecked) {
            setError('Tick every checklist item before approving the contract.');
            return;
        }

        // Acceptance criterion 2: a rejection without remarks is never sent.
        if (decision === 'reject' && !text) {
            setError('Remarks are required when rejecting a contract. Tell the customer what to fix.');
            return;
        }

        const message =
            decision === 'approve'
                ? `${selected.code} approved. The customer has been notified.`
                : `${selected.code} rejected. The customer has been asked to re-submit.`;

        const finish = () => {
            toast.success(message);
            closeContract();
        };

        // Acceptance criterion 1: the decision is saved.
        if (usingSample) {
            const status: ContractStatus = decision === 'approve' ? 'Approved' : 'Rejected';
            setSampleContracts((list) =>
                list.map((c) =>
                    c.id === selected.id
                        ? {
                              ...c,
                              status,
                              review: {
                                  remarks: text || null,
                                  checklist: checked,
                                  reviewedBy: managerName,
                                  reviewedAt: new Date().toISOString(),
                              },
                          }
                        : c,
                ),
            );
            finish();
            return;
        }

        router.patch(
            `${CONTRACTS_URL}/${selected.id}/${decision}`,
            { remarks: text || null, checklist: checked },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: finish,
                onError: (errors) =>
                    setError(errors.remarks ?? errors.checklist ?? 'The review could not be saved. Please try again.'),
            },
        );
    };
    
    return (
        <>
            <PageHeader
                title="Contracts"
                description="Review the signed contracts submitted by customers. Only valid and properly signed contracts can be approved."
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
                        placeholder="Search by contract no., project no., customer or event..."
                        aria-label="Search contracts"
                        className={inputClass}
                    />
                </div>
            </div>

            {/* Contracts table: click a row to review that contract */}
            <Panel className="overflow-x-auto p-0">
                <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-neutral-200/70 text-xs text-ink-soft uppercase">
                        <tr>
                            <th className="px-4 py-3 font-medium">Contract No.</th>
                            <th className="px-2 py-3 font-medium">Project</th>
                            <th className="px-2 py-3 font-medium">Customer</th>
                            <th className="px-2 py-3 font-medium">Event Date</th>
                            <th className="px-2 py-3 font-medium">Amount</th>
                            <th className="px-2 py-3 font-medium">Submitted</th>
                            <th className="px-2 py-3 pr-4 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                        {visibleContracts.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-ink-soft">
                                    {q ? 'No contracts match your search.' : 'No contracts here.'}
                                </td>
                            </tr>
                        ) : (
                            visibleContracts.map((c) => (
                                <tr
                                    key={c.id}
                                    tabIndex={0}
                                    aria-label={`Review ${c.code} from ${c.project.customerName}`}
                                    onClick={() => openContract(c)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') openContract(c);
                                    }}
                                    className="cursor-pointer transition hover:bg-gold/10 focus-visible:bg-gold/10 focus-visible:outline-none"
                                >
                                    <td className="px-4 py-3 font-semibold text-ink">
                                        {c.code}
                                        {c.version > 1 && (
                                            <span className="ml-2 align-middle">
                                                <Pill tone="blue">Re-submitted</Pill>
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-2 py-3 text-ink">
                                        {c.project.code} · {c.project.eventType}
                                    </td>
                                    <td className="px-2 py-3 text-ink">{c.project.customerName}</td>
                                    <td className="px-2 py-3 text-ink">{formatDate(c.project.eventDate)}</td>
                                    <td className="px-2 py-3 text-ink">{peso(c.amount)}</td>
                                    <td className="px-2 py-3 text-ink-soft">{formatDateTime(c.submittedAt)}</td>
                                    <td className="px-2 py-3 pr-4">
                                        <Pill tone={statusTone[c.status]}>{c.status}</Pill>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Panel>

            {/* ---------------- Contract details + review ---------------- */}
            <Dialog open={selected !== null} onOpenChange={(open) => !open && closeContract()}>
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
                    {selected && (
                        <>
                            <DialogHeader>
                                <div className="flex flex-wrap items-center gap-3 pr-6">
                                    <DialogTitle>
                                        {selected.code} · {selected.project.code}
                                    </DialogTitle>
                                    <Pill tone={statusTone[selected.status]}>{selected.status}</Pill>
                                </div>
                                <DialogDescription>
                                    Version {selected.version}, submitted by {selected.project.customerName} on{' '}
                                    {formatDateTime(selected.submittedAt)}
                                </DialogDescription>
                            </DialogHeader>

                            <Section title="Project">
                                <div className="grid grid-cols-2 gap-3">
                                    <Detail label="Customer">{selected.project.customerName}</Detail>
                                    <Detail label="Event">{selected.project.eventType}</Detail>
                                    <Detail label="Event date">{formatDate(selected.project.eventDate)}</Detail>
                                    <Detail label="Contract amount">{peso(selected.amount)}</Detail>
                                    <div className="col-span-2">
                                        <Detail label="Venue">{selected.project.venue}</Detail>
                                    </div>
                                </div>
                            </Section>

                            <Section title="Signed Contract">
                                <a
                                    href={selected.file.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-3 rounded-lg border border-black/15 p-3 transition hover:border-gold hover:bg-gold/10"
                                >
                                    <FileText className="size-6 shrink-0 text-red-600" />
                                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{selected.file.name}</span>
                                    <span className="flex items-center gap-1 text-xs font-semibold text-gold-dark">
                                        Open <ExternalLink className="size-3.5" />
                                    </span>
                                </a>
                                <p className="mt-2 text-xs text-ink-soft">Open the file and check it against the checklist below.</p>
                            </Section>

                            {/* Already reviewed: show the saved result (read-only) */}
                            {selected.review && (
                                <div
                                    className={cx(
                                        'rounded-xl border p-4',
                                        selected.status === 'Approved' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50',
                                    )}
                                >
                                    <p className="text-sm font-bold text-ink">
                                        {selected.status} by {selected.review.reviewedBy} on {formatDateTime(selected.review.reviewedAt)}
                                    </p>
                                    <p className="mt-1 text-sm text-ink-soft">
                                        {selected.review.remarks ? `Remarks: ${selected.review.remarks}` : 'No remarks.'}
                                    </p>
                                    <ul className="mt-3 grid gap-1">
                                        {CONTRACT_CHECKLIST.map((item) => {
                                            const ok = selected.review?.checklist.includes(item.id);
                                            return (
                                                <li key={item.id} className="flex items-start gap-2 text-sm text-ink">
                                                    {ok ? (
                                                        <Check className="mt-0.5 size-4 shrink-0 text-green-600" />
                                                    ) : (
                                                        <X className="mt-0.5 size-4 shrink-0 text-red-600" />
                                                    )}
                                                    {item.label}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            {/* For Review: verification checklist */}
                            {selected.status === 'For Review' && (
                                <Section title="Verification Checklist">
                                    <div className="grid gap-2">
                                        {CONTRACT_CHECKLIST.map((item) => (
                                            <label
                                                key={item.id}
                                                className={cx(
                                                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm text-ink transition',
                                                    checked.includes(item.id) ? 'border-gold bg-gold/10' : 'border-black/10 hover:bg-gold/5',
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked.includes(item.id)}
                                                    onChange={() => {
                                                        toggleCheck(item.id);
                                                        if (error) setError('');
                                                    }}
                                                    className="mt-0.5 size-4 accent-[#C9A013]"
                                                />
                                                {item.label}
                                            </label>
                                        ))}
                                    </div>
                                    <p className="mt-3 text-xs text-ink-soft">
                                        {allChecked
                                            ? 'All items verified. The contract can be approved.'
                                            : `${checked.length} of ${CONTRACT_CHECKLIST.length} verified. Tick every item to enable Approve.`}
                                    </p>
                                </Section>
                            )}

                            {/* For Review, no decision started yet */}
                            {selected.status === 'For Review' && decision === null && (
                                <DialogFooter>
                                    <OutlineButton onClick={closeContract}>Close</OutlineButton>
                                    <DangerButton onClick={() => startDecision('reject')}>
                                        <X className="size-4" /> Reject
                                    </DangerButton>
                                    <GoldButton
                                        onClick={() => startDecision('approve')}
                                        disabled={!allChecked}
                                        title={allChecked ? undefined : 'Tick every checklist item first'}
                                    >
                                        <Check className="size-4" /> Approve
                                    </GoldButton>
                                </DialogFooter>
                            )}

                            {/* For Review, decision started: remarks, then confirm */}
                            {selected.status === 'For Review' && decision !== null && (
                                <form
                                    className="space-y-4 rounded-xl border border-gold/40 bg-gold/5 p-4"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        submitReview();
                                    }}
                                >
                                    <Field
                                        label={decision === 'reject' ? 'Reason for rejection' : 'Remarks (optional)'}
                                        htmlFor="contract-remarks"
                                        required={decision === 'reject'}
                                        error={error}
                                    >
                                        <textarea
                                            id="contract-remarks"
                                            autoFocus
                                            value={remarks}
                                            onChange={(e) => {
                                                setRemarks(e.target.value);
                                                if (error) setError('');
                                            }}
                                            placeholder={
                                                decision === 'reject'
                                                    ? 'e.g. Page 3 is missing the customer signature. Please sign every page and upload again.'
                                                    : 'e.g. Contract verified. Please proceed with the down payment.'
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