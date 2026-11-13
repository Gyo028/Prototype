import { FileText, ImageIcon, LayoutGrid } from 'lucide-react';
import type { ReactNode } from 'react';
import { Pill } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import type { Consultation, ProjectRequest, RequestStatus, RequestedService } from '@/data/project-manager/project-requests';

/*
 * Pieces shared by the Service Requests page (backlog #13) and the Projects page (backlog #16).
 * Keeping them in one file means both pages format and display a request the same way.
 */

/* ---------- formatting helpers ---------- */

export const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

// 'YYYY-MM-DD' → "Jan 16, 2027". The "T00:00" keeps the date from shifting a day because of time zones.
export const formatDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

// ISO date-time → "Nov 8, 2026, 9:24 AM"
export const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

// '14:00' → "2:00 PM"
export const formatTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

const servicePrice = (s: RequestedService) => (s.unit ? `${peso(s.price)} / ${s.unit}` : peso(s.price));

export const statusTone: Record<RequestStatus, PillTone> = {
    Pending: 'yellow',
    Approved: 'green',
    Rejected: 'red',
};

/* ---------- small layout pieces ---------- */

export function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-black/10 p-4">
            <h3 className="mb-3 text-xs font-bold tracking-wide text-ink-soft uppercase">{title}</h3>
            {children}
        </section>
    );
}

export function Detail({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <p className="text-xs text-ink-soft">{label}</p>
            <div className="text-sm text-ink">{children}</div>
        </div>
    );
}

/* ---------- everything the customer submitted ---------- */

export function RequestDetails({ request: r }: { request: ProjectRequest }) {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <Section title="Customer">
                <div className="grid gap-3">
                    <Detail label="Name">{r.customer.name}</Detail>
                    <Detail label="Email">
                        <a href={`mailto:${r.customer.email}`} className="text-gold-dark underline">
                            {r.customer.email}
                        </a>
                    </Detail>
                    <Detail label="Contact number">{r.customer.phone ?? '—'}</Detail>
                </div>
            </Section>

            <Section title="Event Details">
                <div className="grid grid-cols-2 gap-3">
                    <Detail label="Event date">{formatDate(r.eventDate)}</Detail>
                    <Detail label="Time">
                        {formatTime(r.startTime)} – {formatTime(r.endTime)}
                    </Detail>
                    <Detail label="Guests">{r.guests ?? 'Not applicable'}</Detail>
                    <Detail label="Budget">{r.budget}</Detail>
                    <div className="col-span-2">
                        <Detail label="Venue">
                            {r.venue} ({r.venueSetting})
                        </Detail>
                    </div>
                </div>
            </Section>

            <div className="md:col-span-2">
                <Section title="Description">
                    <p className="text-sm whitespace-pre-line text-ink">{r.description || 'No description provided.'}</p>
                </Section>
            </div>

            <Section title="Services">
                {r.services.length === 0 ? (
                    <p className="text-sm text-ink-soft">No services selected.</p>
                ) : (
                    <ul className="divide-y divide-black/10">
                        {r.services.map((s) => (
                            <li key={s.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                                <div>
                                    <p className="text-sm text-ink">{s.name}</p>
                                    <p className="text-xs text-ink-soft">{s.category}</p>
                                </div>
                                <span className="text-sm font-semibold text-ink">{servicePrice(s)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section title="Design Theme and Layout Assets">
                <Detail label="Theme">{r.theme ?? 'No theme selected'}</Detail>
                <p className="mt-3 mb-1.5 text-xs text-ink-soft">Layout assets</p>
                {r.assets.length === 0 ? (
                    <p className="text-sm text-ink-soft">No layout assets selected.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {r.assets.map((a) => (
                            <Pill key={a.id} tone="cream">
                                {a.name}
                            </Pill>
                        ))}
                    </div>
                )}
            </Section>

            <div className="md:col-span-2">
                <PreliminaryLayoutAndQuotation request={r} />
            </div>

            <div className="md:col-span-2">
                <Section title="Reference Files">
                    {r.files.length === 0 ? (
                        <p className="text-sm text-ink-soft">No files uploaded.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {r.files.map((f) => (
                                <a
                                    key={f.id}
                                    href={f.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 rounded-lg border border-black/15 px-3 py-2 text-sm text-ink transition hover:border-gold hover:bg-gold/10"
                                >
                                    {f.type === 'pdf' ? (
                                        <FileText className="size-4 text-red-600" />
                                    ) : (
                                        <ImageIcon className="size-4 text-sky-600" />
                                    )}
                                    {f.name}
                                </a>
                            ))}
                        </div>
                    )}
                </Section>
            </div>
        </div>
    );
}

/* ---------- preliminary layout and quotation (Manage Service Request use case) ---------- */

/** One line of the preliminary quotation. Per-guest services are multiplied by the guest count. */
export function quotationLines(r: ProjectRequest) {
    return r.services.map((s) => {
        const quantity = s.unit === 'pax' ? (r.guests ?? 0) : 1;
        return { id: s.id, name: s.name, unitLabel: s.unit ? `${peso(s.price)} / ${s.unit}` : peso(s.price), quantity, total: s.price * quantity };
    });
}

/** The preliminary 2D layout and quotation the customer saw when submitting the request. */
function PreliminaryLayoutAndQuotation({ request: r }: { request: ProjectRequest }) {
    const lines = quotationLines(r);
    const total = lines.reduce((sum, line) => sum + line.total, 0);

    return (
        <Section title="Preliminary Layout and Quotation">
            <div className="grid gap-4 md:grid-cols-2">
                {/* Layout snapshot exported by the 2D Layout Designer */}
                <div className="overflow-hidden rounded-lg border border-black/10 bg-neutral-100">
                    {r.layoutSnapshotUrl ? (
                        <a href={r.layoutSnapshotUrl} target="_blank" rel="noreferrer">
                            <img src={r.layoutSnapshotUrl} alt={`Preliminary layout for ${r.code}`} className="w-full object-contain" />
                        </a>
                    ) : (
                        <div className="flex aspect-video flex-col items-center justify-center gap-2 p-4 text-center">
                            <LayoutGrid className="size-8 text-ink-soft" />
                            <p className="text-sm font-semibold text-ink">{r.theme ?? 'No theme selected'}</p>
                            <p className="text-xs text-ink-soft">
                                {r.assets.length} layout {r.assets.length === 1 ? 'asset' : 'assets'} · layout snapshot not available
                            </p>
                        </div>
                    )}
                </div>

                {/* Preliminary quotation */}
                <div>
                    {lines.length === 0 ? (
                        <p className="text-sm text-ink-soft">No services selected.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="text-xs text-ink-soft">
                                <tr>
                                    <th className="pb-2 text-left font-medium">Service</th>
                                    <th className="pb-2 text-right font-medium">Qty</th>
                                    <th className="pb-2 text-right font-medium">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/10">
                                {lines.map((line) => (
                                    <tr key={line.id}>
                                        <td className="py-2 text-ink">
                                            {line.name}
                                            <span className="block text-xs text-ink-soft">{line.unitLabel}</span>
                                        </td>
                                        <td className="py-2 text-right text-ink">{line.quantity}</td>
                                        <td className="py-2 text-right text-ink">{peso(line.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-black/20">
                                    <td colSpan={2} className="pt-2 font-bold text-ink">
                                        Estimated total
                                    </td>
                                    <td className="pt-2 text-right font-bold text-ink">{peso(total)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                    <p className="mt-2 text-xs text-ink-soft">Preliminary only. The final quotation is set after the design proposal.</p>
                </div>
            </div>
        </Section>
    );
}

/* ---------- consultation (backlog #16) ---------- */

/** Read-only view of a saved consultation. */
export function ConsultationSummary({ consultation: c }: { consultation: Consultation }) {
    const proceed = c.decision === 'Proceed';

    return (
        <Section title="Consultation">
            <div className="grid gap-3 sm:grid-cols-3">
                <Detail label="Outcome">{c.outcome}</Detail>
                <Detail label="Ocular visit">{c.ocularVisit.required ? 'Required' : 'Not required'}</Detail>
                <Detail label="Project decision">
                    <Pill tone={proceed ? 'blue' : 'red'}>{proceed ? 'Proceed' : 'Do not proceed'}</Pill>
                </Detail>
                <div className="sm:col-span-3">
                    <Detail label="Summary">{c.summary}</Detail>
                </div>
                {c.additionalNotes && (
                    <div className="sm:col-span-3">
                        <Detail label="Additional details">{c.additionalNotes}</Detail>
                    </div>
                )}
                {!proceed && c.decisionReason && (
                    <div className="sm:col-span-3">
                        <Detail label="Reason for not proceeding">{c.decisionReason}</Detail>
                    </div>
                )}
            </div>
            <p className="mt-3 text-xs text-ink-soft">
                Recorded by {c.recordedBy} on {formatDateTime(c.recordedAt)}
            </p>
        </Section>
    );
}
