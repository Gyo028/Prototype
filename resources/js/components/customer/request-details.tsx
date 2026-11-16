import { Link } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, CalendarDays, Download, Eye, FileText, Info, ListChecks, Paperclip, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { budgetLabel, formatDate, formatWhen, peso, statusText, statusTone } from '@/components/customer/project-types';
import type { ProjectStatusInfo, RequestDetail } from '@/components/customer/project-types';
import { Panel, PanelHeader, Pill } from '@/components/dashboard/ui';

/*
 * Customer > My Projects > Request Details / Project Details.
 * Everything the customer submitted. Before approval it is "Request Details";
 * once approved it becomes "Project Details" and links to the project's progress.
 */

type Props = {
    request: RequestDetail;
    project: { id: number; code: string; status: ProjectStatusInfo } | null;
};

export default function RequestDetails({ request: r, project }: Props) {
    const custom = r.requestType === 'custom';
    const statusItem = { requestStatus: r.requestStatus, status: project?.status ?? null };

    return (
        <div className="mx-auto w-full max-w-[1150px]">
            <Link href="/customer/projects" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-gold-dark hover:underline">
                <ArrowLeft className="size-4" /> My Projects
            </Link>

            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                        {project ? `${project.code} · ${r.code}` : r.code} · {custom ? 'Custom Project' : 'Standard Event Styling'}
                    </p>
                    <h1 className="mt-1 text-2xl font-bold text-ink">{project ? 'Project Details' : 'Request Details'}</h1>
                    <p className="mt-1 text-base text-ink-soft">{r.title}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={statusTone(statusItem)}>{statusText(statusItem)}</Pill>
                    {project?.status.onHold && <Pill tone="yellow">On Hold</Pill>}
                    {project && (
                        <Link
                            href={`/customer/projects/${project.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-white hover:bg-gold-dark"
                        >
                            Go to project progress <ArrowRight className="size-4" />
                        </Link>
                    )}
                </div>
            </div>

            {r.requestStatus === 'pending' && (
                <Notice>Our Project Manager is reviewing your request. You'll be notified once there's a decision.</Notice>
            )}
            {r.requestStatus === 'rejected' && (
                <Notice tone="red">
                    <span className="font-bold">This request was not approved.</span>
                    {r.pmRemarks && <span className="block">Remarks: {r.pmRemarks}</span>}
                </Notice>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                <Panel>
                    <PanelHeader title={custom ? 'Project' : 'Event'} icon={<CalendarDays className="size-5" />} />
                    <dl className="grid gap-4 text-sm sm:grid-cols-2">
                        {custom ? <Row label="Project title" value={r.projectTitle ?? '—'} /> : <Row label="Event type" value={r.eventType ?? '—'} />}
                        <Row label={custom ? 'Project dates' : 'Date and time'} value={formatWhen(r)} />
                        <Row label={custom ? 'Venue or mall location' : 'Venue'} value={r.venue} wide />
                        {r.guests !== null && <Row label="Guests" value={String(r.guests)} />}
                        <Row label="Submitted" value={formatDate(r.requestDate)} />
                    </dl>
                </Panel>

                <Panel>
                    <PanelHeader title="Budget" icon={<Wallet className="size-5" />} />
                    <dl className="grid gap-4 text-sm sm:grid-cols-2">
                        <Row label="Budget range" value={budgetLabel(r.budgetMin, r.budgetMax)} />
                        <Row label="Reservation fee" value={`${peso(r.reservationFee)} (10% of your budget)`} />
                    </dl>
                    <p className="mt-4 text-xs text-ink-soft">
                        The reservation fee is billed after your consultation, once you decide to proceed. It reserves your date.
                    </p>
                </Panel>

                <Panel className="lg:col-span-2">
                    <PanelHeader
                        title={custom ? 'Quotation' : 'Services and initial quotation'}
                        description={custom ? undefined : 'Prices as of the day you sent the request'}
                        icon={<ListChecks className="size-5" />}
                    />
                    {custom || r.services.length === 0 ? (
                        <p className="text-sm text-ink-soft">
                            {custom
                                ? 'Your quotation is prepared after our Design Specialist submits the design proposal, and is reviewed by our Project Manager and Owner.'
                                : 'No services were saved with this request.'}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-xs text-ink-soft uppercase">
                                    <tr>
                                        <th className="py-2 pr-4 font-semibold">Service</th>
                                        <th className="py-2 pr-4 font-semibold">Quantity</th>
                                        <th className="py-2 pr-4 text-right font-semibold">Price</th>
                                        <th className="py-2 text-right font-semibold">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {r.services.map((s, i) => (
                                        <tr key={i} className="border-t border-black/10">
                                            <td className="py-2 pr-4">
                                                <div className="font-semibold text-ink">{s.name}</div>
                                                {s.category && <div className="text-xs text-ink-soft">{s.category}</div>}
                                            </td>
                                            <td className="py-2 pr-4 text-ink">{s.unit ? `${s.quantity} ${s.unit}` : s.quantity}</td>
                                            <td className="py-2 pr-4 text-right text-ink">
                                                {peso(s.unitPrice)}
                                                {s.unit && <span className="text-ink-soft"> / {s.unit}</span>}
                                            </td>
                                            <td className="py-2 text-right font-semibold text-ink">{peso(s.subtotal)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-black/15">
                                        <td colSpan={3} className="py-3 pr-4 text-right font-bold text-ink">
                                            Initial quotation
                                        </td>
                                        <td className="py-3 text-right text-base font-bold text-ink">{peso(r.servicesTotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                            <p className="mt-2 text-xs text-ink-soft">
                                This is an estimate. Your final quotation comes with your design proposal.
                            </p>
                        </div>
                    )}
                </Panel>

                <Panel>
                    <PanelHeader title="Description" icon={<FileText className="size-5" />} />
                    <p className="text-sm whitespace-pre-line text-ink">{r.description || <span className="text-ink-soft">No description was added.</span>}</p>
                </Panel>

                <Panel>
                    <PanelHeader title="Reference files" icon={<Paperclip className="size-5" />} />
                    {r.files.length === 0 ? (
                        <p className="text-sm text-ink-soft">No files were attached.</p>
                    ) : (
                        <ul className="grid gap-3 sm:grid-cols-2">
                            {r.files.map((f) => (
                                <li key={f.id} className="overflow-hidden rounded-xl border border-black/10">
                                    {f.isImage ? (
                                        <img src={f.url} alt={f.name} className="h-32 w-full bg-black/5 object-cover" loading="lazy" />
                                    ) : (
                                        <div className="flex h-32 items-center justify-center bg-black/5">
                                            <FileText className="size-10 text-ink-soft" />
                                        </div>
                                    )}
                                    <div className="grid gap-2 p-3">
                                        <p className="truncate text-xs font-semibold text-ink" title={f.name}>
                                            {f.name}
                                        </p>
                                        <div className="flex gap-3 text-xs font-bold text-gold-dark">
                                            <a href={f.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:underline">
                                                <Eye className="size-3.5" /> View
                                            </a>
                                            <a href={`${f.url}?download=1`} className="inline-flex items-center gap-1 hover:underline">
                                                <Download className="size-3.5" /> Download
                                            </a>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>
        </div>
    );
}

function Row({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
    return (
        <div className={wide ? 'sm:col-span-2' : undefined}>
            <dt className="text-xs text-ink-soft">{label}</dt>
            <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
        </div>
    );
}

function Notice({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'red' }) {
    return (
        <div
            className={
                tone === 'red'
                    ? 'mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800'
                    : 'mb-6 flex items-start gap-2 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-ink'
            }
        >
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>{children}</span>
        </div>
    );
}
