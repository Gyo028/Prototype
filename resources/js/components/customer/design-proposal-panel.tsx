import { router } from '@inertiajs/react';
import { Box, CheckCircle2, Download, ExternalLink, FileText, History, Link2, MessageSquare, Palette, Receipt } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Block, BlockHeader, Notice } from '@/components/customer/appointment-parts';
import { formatDate, peso } from '@/components/customer/project-types';
import type { DesignFile, DesignInfo, DesignProposalVersion } from '@/components/customer/project-types';
import { Field, GoldButton, OutlineButton, Pill, cx, textareaClass } from '@/components/dashboard/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/*
 * Review, approve or request revisions of the design proposal (Plan Project, step 4).
 *
 * The customer sees the newest version approved by the Project Manager and the
 * Owner: the 2D design, any 3D output, and the quotation's line items. They
 * approve it (the project moves to Contract) or ask for changes with comments;
 * the designer then prepares the next version. Earlier versions stay listed.
 */

type Props = {
    projectId: number;
    design: DesignInfo;
};

const DECISION: Record<DesignProposalVersion['decision'], { label: string; tone: 'yellow' | 'green' | 'red' }> = {
    pending: { label: 'Waiting for your review', tone: 'yellow' },
    approved: { label: 'Approved', tone: 'green' },
    revision_requested: { label: 'Revision requested', tone: 'red' },
};

export default function DesignProposalPanel({ projectId, design }: Props) {
    const { latest, history, canDecide, revisionInProgress, reservationFeePaid, remarksMax } = design;

    const [dialog, setDialog] = useState<'approve' | 'revise' | null>(null);
    const [comments, setComments] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const open = (kind: 'approve' | 'revise') => {
        setComments('');
        setError(null);
        setDialog(kind);
    };

    const submit = (kind: 'approve' | 'revise') => {
        if (!latest) return;
        if (kind === 'revise' && comments.trim().length < 10) {
            setError('Tell us what you would like changed (at least 10 characters).');
            return;
        }

        setSaving(true);
        router.post(
            `/customer/projects/${projectId}/design-proposals/${latest.id}/${kind === 'approve' ? 'approve' : 'revision'}`,
            kind === 'approve' ? {} : { comments },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    const errors = (page.props.errors ?? {}) as Record<string, string>;
                    if (errors.design || errors.comments) {
                        setError(errors.design ?? errors.comments);
                        return;
                    }
                    toast.success(
                        kind === 'approve'
                            ? 'Design approved. Your contract and final billing are next.'
                            : 'Revision request sent. We will let you know when the new version is ready.',
                    );
                    setDialog(null);
                },
                onError: (errors) => setError((errors as Record<string, string>).comments ?? (errors as Record<string, string>).design ?? null),
                onFinish: () => setSaving(false),
            },
        );
    };

    if (!latest) {
        return (
            <Block>
                <BlockHeader title="Design proposal" icon={<Palette className="size-5" />} />
                <Notice>
                    {design.designerAssigned
                        ? 'Our Design Specialist is preparing your design proposal and quotation. It will appear here once our Project Manager and Owner have reviewed it.'
                        : 'A Design Specialist will be assigned to your project soon.'}
                </Notice>
            </Block>
        );
    }

    return (
        <div className="grid gap-4">
            {revisionInProgress && (
                <Notice>
                    You asked for changes to version {latest.version}. Our Design Specialist is working on the next version; it will appear here once our
                    Project Manager and Owner have reviewed it.
                </Notice>
            )}

            <ProposalBlock proposal={latest} reservationFeePaid={reservationFeePaid} current />

            {canDecide && (
                <Block className="border-gold/50 bg-gold/5">
                    <h3 className="font-bold text-ink">What do you think?</h3>
                    <p className="mt-1 text-sm text-ink-soft">
                        Approve the design and quotation to move on to your contract, or tell us what you would like changed.
                    </p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        <GoldButton onClick={() => open('approve')}>
                            <CheckCircle2 className="size-4" /> Approve Design
                        </GoldButton>
                        <OutlineButton onClick={() => open('revise')}>
                            <MessageSquare className="size-4" /> Request Revisions
                        </OutlineButton>
                    </div>
                </Block>
            )}

            {history.length > 0 && (
                <Block>
                    <BlockHeader title="Earlier versions" description="What you saw before, and your comments" icon={<History className="size-5" />} />
                    <ul className="grid gap-3">
                        {history.map((p) => (
                            <EarlierVersion key={p.id} proposal={p} />
                        ))}
                    </ul>
                </Block>
            )}

            <Dialog open={dialog === 'approve'} onOpenChange={(o) => !o && setDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Approve version {latest.version}?</DialogTitle>
                        <DialogDescription>
                            You approve this design and the quotation of <b>{peso(latest.quotationAmount)}</b>. Your contract and final billing are prepared
                            next. This can't be undone here; contact our Project Manager if you change your mind.
                        </DialogDescription>
                    </DialogHeader>
                    {error && <Notice tone="error">{error}</Notice>}
                    <DialogFooter>
                        <OutlineButton onClick={() => setDialog(null)}>Back</OutlineButton>
                        <GoldButton onClick={() => submit('approve')} disabled={saving}>
                            {saving ? 'Approving…' : 'Yes, Approve'}
                        </GoldButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={dialog === 'revise'} onOpenChange={(o) => !o && setDialog(null)}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Request revisions to version {latest.version}</DialogTitle>
                        <DialogDescription>Tell our Design Specialist what to change: colours, pieces, layout or the quotation.</DialogDescription>
                    </DialogHeader>
                    <Field label="Your comments" htmlFor="design-comments" required error={error ?? undefined}>
                        <textarea
                            id="design-comments"
                            className={cx(textareaClass, 'min-h-32')}
                            maxLength={remarksMax}
                            placeholder="e.g. Please change the backdrop to sage green and add more flowers at the entrance."
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                        />
                        <span className="text-right text-[11px] text-ink-soft">
                            {comments.length}/{remarksMax}
                        </span>
                    </Field>
                    <DialogFooter>
                        <OutlineButton onClick={() => setDialog(null)}>Back</OutlineButton>
                        <GoldButton onClick={() => submit('revise')} disabled={saving}>
                            {saving ? 'Sending…' : 'Send Revision Request'}
                        </GoldButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** One version: its status, files and quotation. */
function ProposalBlock({ proposal: p, reservationFeePaid, current = false }: { proposal: DesignProposalVersion; reservationFeePaid: number | null; current?: boolean }) {
    const d = DECISION[p.decision];

    return (
        <Block>
            <BlockHeader
                title={`Design proposal · Version ${p.version}`}
                description={p.submittedAt ? `Submitted ${formatDate(p.submittedAt)}` : undefined}
                icon={<Palette className="size-5" />}
                action={<Pill tone={d.tone}>{d.label}</Pill>}
            />

            {p.decision === 'approved' && p.decidedAt && (
                <p className="mb-4 flex items-center gap-2 text-sm text-ink">
                    <CheckCircle2 className="size-4 text-green-700" /> You approved this version on {formatDate(p.decidedAt)}.
                </p>
            )}
            {p.decision === 'revision_requested' && p.comments && current && <Comments text={p.comments} date={p.decidedAt} />}

            <Section title="2D design" icon={<FileText className="size-4" />}>
                {p.designFiles.length > 0 ? (
                    <ul className="grid gap-2">
                        {p.designFiles.map((f) => (
                            <FileRow key={f.id} file={f} />
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-ink-soft">No file attached.</p>
                )}
            </Section>

            {(p.visualizationFiles.length > 0 || p.externalLink) && (
                <Section title="3D visualization" icon={<Box className="size-4" />}>
                    <ul className="grid gap-2">
                        {p.visualizationFiles.map((f) => (
                            <FileRow key={f.id} file={f} />
                        ))}
                        {p.externalLink && (
                            <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 p-3 text-sm">
                                <span className="flex min-w-0 items-center gap-2 font-semibold text-ink">
                                    <Link2 className="size-5 shrink-0 text-gold-dark" /> 3D files (shared link)
                                </span>
                                <a
                                    href={p.externalLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-1.5 text-sm font-bold text-ink hover:border-gold"
                                >
                                    <ExternalLink className="size-4" /> Open link
                                </a>
                            </li>
                        )}
                    </ul>
                </Section>
            )}

            {p.otherFiles.length > 0 && (
                <Section title="Other files" icon={<FileText className="size-4" />}>
                    <ul className="grid gap-2">
                        {p.otherFiles.map((f) => (
                            <FileRow key={f.id} file={f} />
                        ))}
                    </ul>
                </Section>
            )}

            <Section title="Quotation" icon={<Receipt className="size-4" />}>
                <Quotation proposal={p} reservationFeePaid={reservationFeePaid} />
            </Section>
        </Block>
    );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
    return (
        <div className="mt-4 first:mt-0">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">
                {icon} {title}
            </h4>
            {children}
        </div>
    );
}

function Quotation({ proposal: p, reservationFeePaid }: { proposal: DesignProposalVersion; reservationFeePaid: number | null }) {
    const balance = reservationFeePaid !== null ? Math.max(p.quotationAmount - reservationFeePaid, 0) : null;

    return (
        <div className="overflow-x-auto rounded-lg border border-black/10">
            <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-black/[0.03] text-left text-xs text-ink-soft">
                    <tr>
                        <th className="px-3 py-2 font-medium">Item</th>
                        <th className="px-3 py-2 text-right font-medium">Qty</th>
                        <th className="px-3 py-2 text-right font-medium">Unit price</th>
                        <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    {p.items.map((i) => (
                        <tr key={i.id} className="border-t border-black/5 align-top">
                            <td className="px-3 py-2">
                                <span className="font-semibold text-ink">{i.name}</span>
                                {i.description && <span className="block text-xs text-ink-soft">{i.description}</span>}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                {i.quantity} {i.unit ?? ''}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{peso(i.unitPrice)}</td>
                            <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{peso(i.subtotal)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="border-t border-black/10">
                    <tr>
                        <td colSpan={3} className="px-3 py-2 text-right font-bold text-ink">
                            Total
                        </td>
                        <td className="px-3 py-2 text-right font-bold whitespace-nowrap text-ink">{peso(p.quotationAmount)}</td>
                    </tr>
                    {reservationFeePaid !== null && balance !== null && (
                        <>
                            <tr className="text-ink-soft">
                                <td colSpan={3} className="px-3 py-1 text-right">
                                    Reservation fee paid
                                </td>
                                <td className="px-3 py-1 text-right whitespace-nowrap">− {peso(reservationFeePaid)}</td>
                            </tr>
                            <tr>
                                <td colSpan={3} className="px-3 py-2 text-right font-bold text-ink">
                                    Remaining balance
                                </td>
                                <td className="px-3 py-2 text-right font-bold whitespace-nowrap text-gold-dark">{peso(balance)}</td>
                            </tr>
                        </>
                    )}
                </tfoot>
            </table>
        </div>
    );
}

/** An earlier version, folded: open to see its files and quotation. */
function EarlierVersion({ proposal: p }: { proposal: DesignProposalVersion }) {
    const [open, setOpen] = useState(false);
    const d = DECISION[p.decision];

    return (
        <li className="rounded-xl border border-black/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-ink">
                    Version {p.version}
                    <span className="font-normal text-ink-soft">
                        {' · '}
                        {peso(p.quotationAmount)}
                        {p.submittedAt && ` · ${formatDate(p.submittedAt)}`}
                    </span>
                </span>
                <span className="flex items-center gap-2">
                    <Pill tone={d.tone}>{d.label}</Pill>
                    <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-gold-dark hover:underline">
                        {open ? 'Hide' : 'View'}
                    </button>
                </span>
            </div>
            {p.comments && <Comments text={p.comments} date={p.decidedAt} />}
            {open && (
                <div className="mt-3 border-t border-black/10 pt-3">
                    <ul className="grid gap-2">
                        {[...p.designFiles, ...p.visualizationFiles, ...p.otherFiles].map((f) => (
                            <FileRow key={f.id} file={f} />
                        ))}
                    </ul>
                    <div className="mt-3">
                        <Quotation proposal={p} reservationFeePaid={null} />
                    </div>
                </div>
            )}
        </li>
    );
}

function Comments({ text, date }: { text: string; date: string | null }) {
    return (
        <div className="mt-2 mb-2 rounded-lg border border-black/10 bg-black/[0.02] p-3 text-sm">
            <p className="text-xs font-semibold text-ink-soft">Your comments{date && ` · ${formatDate(date)}`}</p>
            <p className="mt-1 whitespace-pre-line text-ink">{text}</p>
        </div>
    );
}

function FileRow({ file }: { file: DesignFile }) {
    return (
        <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 p-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
                <FileText className="size-5 shrink-0 text-gold-dark" />
                <span className="truncate">{file.name}</span>
                <span className="text-xs font-normal text-ink-soft uppercase">{file.extension}</span>
            </span>
            <span className="flex gap-2">
                {file.viewable && (
                    <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-1.5 text-sm font-bold text-ink hover:border-gold"
                    >
                        <ExternalLink className="size-4" /> View
                    </a>
                )}
                <a
                    href={`${file.url}?download=1`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gold bg-white px-3 py-1.5 text-sm font-bold text-ink hover:bg-gold/10"
                >
                    <Download className="size-4" /> Download
                </a>
            </span>
        </li>
    );
}
