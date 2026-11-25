import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Download,
    Eye,
    FileText,
    Info,
    LayoutTemplate,
    ListChecks,
    MapPin,
    Palette,
    Paperclip,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import LayoutPreview from '@/components/customer/layout-preview';
import { budgetLabel, formatDate, formatTime, formatWhen, peso, statusText, statusTone } from '@/components/customer/project-types';
import type { ProjectStatusInfo, RequestDetail, RequestLayout } from '@/components/customer/project-types';
import { OutlineButton, Pill, cx } from '@/components/dashboard/ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/*
 * Customer > My Projects > Request Details / Project Details.
 * Everything the customer submitted, in one container like the project page.
 * Before approval it is "Request Details"; once approved it becomes
 * "Project Details" and links to the project's progress.
 *
 *  - Standard: Event | Venue and budget · Preliminary layout and quotation
 *    (fixed-height canvas, quotation totals, full list in a pop-up, the
 *    "initial only" disclaimer) · Design theme and layout assets ·
 *    Description | Reference files.
 *  - Custom: Project | Venue and budget · Reference files (the main material)
 *    · Description · a note that the quotation comes with the design proposal.
 */

type Props = {
    request: RequestDetail;
    layout: RequestLayout | null;
    project: { id: number; code: string; status: ProjectStatusInfo } | null;
};

type LayoutItem = RequestLayout['items'][number];

/** "₱45 per guest", "₱350 each · 1 per 10 guests", "₱8,000" */
function assetUnit(item: LayoutItem) {
    if (item.unitPrice === null) return 'To be priced';
    if (!item.perGuest) return peso(item.unitPrice);
    const per = item.guestsPerUnit ?? 1;
    return per === 1 ? `${peso(item.unitPrice)} per guest` : `${peso(item.unitPrice)} each · 1 per ${per} guests`;
}

/** Days from the first to the last day, counting both. */
function spanDays(start: string, end: string) {
    const [ys, ms, ds] = start.split('-').map(Number);
    const [ye, me, de] = end.split('-').map(Number);
    return Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86_400_000) + 1;
}

export default function RequestDetails({ request: r, layout, project }: Props) {
    const custom = r.requestType === 'custom';
    const statusItem = { requestStatus: r.requestStatus, status: project?.status ?? null };

    return (
        <div className="mx-auto w-full max-w-[1150px]">
            <Link href="/customer/projects" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-gold-dark hover:underline">
                <ArrowLeft className="size-4" /> My Projects
            </Link>

            <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                {/* Header */}
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 p-4 sm:p-6">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase sm:text-xs">
                            {project ? `${project.code} · ${r.code}` : r.code} · {custom ? 'Custom Project' : 'Standard Event Styling'}
                        </p>
                        <h1 className="mt-1 text-xl font-bold text-ink sm:text-2xl">{project ? 'Project Details' : 'Request Details'}</h1>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-sm text-ink-soft sm:text-base">{r.title}</span>
                            {/* "On hold · …" is part of the status text when it applies. */}
                            <Pill tone={statusTone(statusItem)}>{statusText(statusItem)}</Pill>
                        </div>
                    </div>
                    <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
                        <p className="text-xs text-ink-soft">Submitted {formatDate(r.requestDate)}</p>
                        {project && (
                            <Link
                                href={`/customer/projects/${project.id}`}
                                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-white hover:bg-gold-dark sm:w-auto"
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

                {custom ? <CustomSections request={r} /> : <StandardSections request={r} layout={layout} />}
            </div>
        </div>
    );
}

/* ---------------- Standard Event Styling ---------------- */

function StandardSections({ request: r, layout }: { request: RequestDetail; layout: RequestLayout | null }) {
    return (
        <>
            <Section>
                <div className="grid gap-6 md:grid-cols-2 md:gap-0">
                    <div className="md:pr-6">
                        <SectionTitle icon={<CalendarDays className="size-4" />} title="Event" />
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                            <Row label="Event type" value={r.eventType ?? '—'} />
                            {r.guests !== null && <Row label="Guests" value={String(r.guests)} />}
                            <Row label="Date" value={formatDate(r.startDate)} />
                            {r.startTime && r.endTime && <Row label="Time" value={`${formatTime(r.startTime)} – ${formatTime(r.endTime)}`} />}
                        </dl>
                    </div>
                    <VenueAndBudget request={r} />
                </div>
            </Section>

            <LayoutAndQuotation request={r} layout={layout} />

            {layout && <ThemeAndAssets layout={layout} />}

            <Section>
                <div className="grid gap-6 md:grid-cols-2 md:gap-0">
                    <div className="md:pr-6">
                        <SectionTitle icon={<FileText className="size-4" />} title="Description" />
                        <Description text={r.description} />
                    </div>
                    <div className="border-t border-black/10 pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-6">
                        <SectionTitle icon={<Paperclip className="size-4" />} title="Reference files" />
                        <Files files={r.files} />
                    </div>
                </div>
            </Section>
        </>
    );
}

/** A fixed-height layout canvas beside the quotation totals; the full list opens in a pop-up. */
function LayoutAndQuotation({ request: r, layout }: { request: RequestDetail; layout: RequestLayout | null }) {
    const [open, setOpen] = useState(false);

    const items = layout?.items ?? [];
    const servicesTotal = r.servicesTotal;
    const assetsTotal = layout?.assetsTotal ?? 0;
    const pricedAssets = items.filter((it) => it.unitPrice !== null).length;
    const toBePriced = layout?.toBePriced ?? 0;
    const total = layout?.total ?? servicesTotal;

    const previewItems = [
        // The Event Styling fee is the whole job, not a spot in the room.
        ...r.services
            .filter((s) => s.category !== 'Styling')
            .map((s, i) => ({ key: `service-${i}`, name: s.name, category: s.category ?? '', kind: 'service' as const })),
        ...items.map((it) => ({ key: `item-${it.id}`, name: it.name, category: it.category, kind: 'asset' as const })),
    ];

    return (
        <Section>
            <SectionTitle icon={<LayoutTemplate className="size-4" />} title="Preliminary layout and quotation" />

            {/* First, so it is read before the layout and the prices. */}
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                    <span className="font-bold">Initial estimate only.</span> This layout and quotation are not final. Our Design Specialist prepares the
                    final design, and your final quotation comes with the design proposal.
                </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
                <div>
                    {layout ? (
                        <>
                            {/* Fixed height: the canvas no longer stretches with the quotation. */}
                            <div className="flex h-72 flex-col sm:h-80">
                                <LayoutPreview themeName={layout.theme?.name ?? null} items={previewItems} />
                            </div>
                        </>
                    ) : (
                        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-black/15 p-6 text-center text-sm text-ink-soft">
                            No layout was saved with this request.
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-black/10 p-3 sm:p-4">
                    <p className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">Initial quotation</p>
                    <dl className="divide-y divide-black/5 text-sm">
                        <TotalRow label={`Services (${r.services.length})`} value={peso(servicesTotal)} />
                        {layout && <TotalRow label={`Design assets (${pricedAssets})`} value={peso(assetsTotal)} />}
                        {toBePriced > 0 && (
                            <TotalRow label="To be priced" value={`${toBePriced} ${toBePriced === 1 ? 'item' : 'items'}`} className="text-gold-dark" />
                        )}
                    </dl>
                    <div className="mt-2 flex items-center justify-between border-t-2 border-black/15 pt-3">
                        <span className="font-bold text-ink">Total</span>
                        <span className="text-lg font-bold text-ink">{peso(total)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-soft">Prices as of {formatDate(r.requestDate)}</p>
                    <OutlineButton className="mt-4 w-full justify-center py-2" onClick={() => setOpen(true)}>
                        <ListChecks className="size-4" /> View full quotation
                    </OutlineButton>
                </div>
            </div>


            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Initial quotation</DialogTitle>
                        <DialogDescription>Prices as of {formatDate(r.requestDate)}, the day you sent the request.</DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[60vh] overflow-y-auto pr-1">
                        <table className="w-full text-left text-sm">
                            <thead className="sticky top-0 bg-white text-xs text-ink-soft uppercase">
                                <tr>
                                    <th className="py-2 pr-4 font-semibold">Item</th>
                                    <th className="py-2 pr-4 font-semibold">Qty</th>
                                    <th className="py-2 text-right font-semibold">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {r.services.length > 0 && <GroupRow label="Services" />}
                                {r.services.map((s, i) => (
                                    <tr key={`s-${i}`} className="border-t border-black/10">
                                        <td className="py-2 pr-4">
                                            <div className="font-semibold text-ink">{s.name}</div>
                                            <div className="text-xs text-ink-soft">
                                                {peso(s.unitPrice)}
                                                {s.unit && ` / ${s.unit}`}
                                            </div>
                                        </td>
                                        <td className="py-2 pr-4 text-ink">{s.unit ? `${s.quantity} ${s.unit}` : s.quantity}</td>
                                        <td className="py-2 text-right font-semibold text-ink">{peso(s.subtotal)}</td>
                                    </tr>
                                ))}

                                {items.length > 0 && <GroupRow label="Design assets" />}
                                {items.map((it) => (
                                    <tr key={it.id} className="border-t border-black/10">
                                        <td className="py-2 pr-4">
                                            <div className="font-semibold text-gold-dark">{it.name}</div>
                                            <div className="text-xs text-ink-soft">{it.isCustom ? (it.description ?? 'Other item') : assetUnit(it)}</div>
                                        </td>
                                        <td className="py-2 pr-4 text-ink">{it.quantity}</td>
                                        <td className="py-2 text-right font-semibold text-ink">
                                            {it.subtotal === null ? <span className="text-xs font-bold text-gold-dark">To be priced</span> : peso(it.subtotal)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-black/15">
                                    <td colSpan={2} className="py-3 pr-4 font-bold text-ink">
                                        Total
                                        {toBePriced > 0 && (
                                            <span className="block text-xs font-normal text-ink-soft">
                                                Plus {toBePriced} {toBePriced === 1 ? 'item' : 'items'} to be priced
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 text-right text-base font-bold text-ink">{peso(total)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <p className="text-xs text-ink-soft">Initial estimate only. Your final quotation comes with the design proposal.</p>
                </DialogContent>
            </Dialog>
        </Section>
    );
}

/** The design theme, and every asset on the layout: the theme's defaults, the customer's picks and "Other" items. */
function ThemeAndAssets({ layout }: { layout: RequestLayout }) {
    const t = layout.theme;
    const others = layout.items.filter((it) => it.isCustom);

    return (
        <Section>
            <SectionTitle icon={<Palette className="size-4" />} title="Design theme and layout assets" />
            <div className="grid gap-6 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <div>
                    <p className="text-xs text-ink-soft">Theme</p>
                    {t ? (
                        <>
                            <p className="mt-0.5 font-semibold text-ink">{t.name}</p>
                            <p className="text-xs text-ink-soft">
                                {t.venue.charAt(0).toUpperCase() + t.venue.slice(1)} · {t.style} ·{' '}
                                {t.minGuests ? `${t.minGuests}–${t.maxGuests}` : `up to ${t.maxGuests}`} guests
                            </p>
                        </>
                    ) : (
                        <p className="mt-0.5 text-ink-soft">No theme was chosen. Our team will suggest one.</p>
                    )}
                </div>

                <div>
                    <p className="mb-1.5 text-xs text-ink-soft">Layout assets ({layout.items.length})</p>
                    {layout.items.length === 0 ? (
                        <p className="text-ink-soft">No design assets are on the layout.</p>
                    ) : (
                        <ul className="flex flex-wrap gap-2">
                            {layout.items.map((it) => (
                                <li
                                    key={it.id}
                                    title={it.description ?? undefined}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-xs font-semibold text-gold-dark"
                                >
                                    {it.name}
                                    {it.isDefault && <span className="font-normal text-ink-soft">· default</span>}
                                    {it.isCustom && <span className="font-normal text-ink-soft">· other</span>}
                                </li>
                            ))}
                        </ul>
                    )}
                    {others.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs text-ink-soft">
                            {others.map((it) => (
                                <li key={it.id}>
                                    <span className="font-semibold text-ink">{it.name}</span> ({it.category}): {it.description}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </Section>
    );
}

/* ---------------- Custom Project ---------------- */

function CustomSections({ request: r }: { request: RequestDetail }) {
    const days = spanDays(r.startDate, r.endDate);

    return (
        <>
            <Section>
                <div className="grid gap-6 md:grid-cols-2 md:gap-0">
                    <div className="md:pr-6">
                        <SectionTitle icon={<CalendarDays className="size-4" />} title="Project" />
                        <dl className="grid gap-4 text-sm">
                            <Row label="Project title" value={r.projectTitle ?? '—'} />
                            <Row label="Project dates" value={`${formatWhen(r)} · ${days} ${days === 1 ? 'day' : 'days'}`} />
                        </dl>
                    </div>
                    <VenueAndBudget request={r} />
                </div>
            </Section>

            <Section>
                <SectionTitle icon={<Paperclip className="size-4" />} title="Reference files" />
                <Files files={r.files} large />
            </Section>

            <Section>
                <SectionTitle icon={<FileText className="size-4" />} title="Description" />
                <Description text={r.description} />
            </Section>

            <Section>
                <div className="flex items-start gap-3 rounded-xl bg-gold/10 p-4 text-sm text-ink">
                    <LayoutTemplate className="mt-0.5 size-4 shrink-0 text-gold-dark" />
                    <p>
                        <span className="font-bold">Quotation comes later.</span> It is prepared with the design proposal from our Design Specialist, and
                        reviewed by our Project Manager and Owner.
                    </p>
                </div>
            </Section>
        </>
    );
}

/* ---------------- Shared parts ---------------- */

function VenueAndBudget({ request: r }: { request: RequestDetail }) {
    const custom = r.requestType === 'custom';

    return (
        <div className="border-t border-black/10 pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <SectionTitle icon={<MapPin className="size-4" />} title="Venue and budget" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Row label={custom ? 'Venue or mall location' : 'Venue'} value={r.venue} wide />
                <Row label="Budget range" value={budgetLabel(r.budgetMin, r.budgetMax)} />
                <Row label="Reservation fee" value={peso(r.reservationFee)} />
            </dl>
            <p className="mt-3 text-xs text-ink-soft">
                The reservation fee is 10% of your budget, billed after your consultation once you decide to proceed. It reserves your date.
            </p>
        </div>
    );
}

function Files({ files, large = false }: { files: RequestDetail['files']; large?: boolean }) {
    if (files.length === 0) return <p className="text-sm text-ink-soft">No files were attached.</p>;

    return (
        <ul className={cx('grid grid-cols-2 gap-3', large && 'lg:grid-cols-4')}>
            {files.map((f) => (
                <li key={f.id} className="overflow-hidden rounded-xl border border-black/10">
                    {f.isImage ? (
                        <img src={f.url} alt={f.name} className={cx('w-full bg-black/5 object-cover', large ? 'h-32 sm:h-44' : 'h-28 sm:h-32')} loading="lazy" />
                    ) : (
                        <div className={cx('flex items-center justify-center bg-black/5', large ? 'h-32 sm:h-44' : 'h-28 sm:h-32')}>
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
    );
}

function Description({ text }: { text: string | null }) {
    return <p className="text-sm whitespace-pre-line text-ink">{text || <span className="text-ink-soft">No description was added.</span>}</p>;
}

function Section({ children }: { children: ReactNode }) {
    return <section className="border-t border-black/10 p-4 sm:p-6">{children}</section>;
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
    return (
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-ink sm:mb-4">
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-gold/20 text-gold-dark">{icon}</span>
            {title}
        </h2>
    );
}

function TotalRow({ label, value, className }: { label: string; value: string; className?: string }) {
    return (
        <div className={cx('flex items-center justify-between py-1.5', className)}>
            <dt>{label}</dt>
            <dd className="font-semibold">{value}</dd>
        </div>
    );
}

function GroupRow({ label }: { label: string }) {
    return (
        <tr>
            <td colSpan={3} className="pt-3 pb-1 text-xs font-bold text-gold-dark">
                {label}
            </td>
        </tr>
    );
}

function Row({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
    return (
        <div className={cx('min-w-0', wide && 'col-span-2')}>
            <dt className="text-xs text-ink-soft">{label}</dt>
            <dd className="mt-0.5 font-semibold break-words text-ink">{value}</dd>
        </div>
    );
}

function Notice({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'red' }) {
    return (
        <div
            className={cx(
                'flex items-start gap-2 border-t px-4 py-3 text-sm sm:px-6',
                tone === 'red' ? 'border-red-200 bg-red-50 text-red-800' : 'border-black/10 bg-neutral-50 text-ink-soft',
            )}
        >
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>{children}</span>
        </div>
    );
}
