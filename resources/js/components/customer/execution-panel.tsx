import { CalendarClock, CheckCircle2, Hammer, ImageIcon, MapPin, Truck } from 'lucide-react';
import { useState } from 'react';
import { Block, BlockHeader, Notice } from '@/components/customer/appointment-parts';
import { formatDate, formatLongDate } from '@/components/customer/project-types';
import type { ExecutionInfo, ExecutionStage } from '@/components/customer/project-types';
import PhotoViewer from '@/components/customer/photo-viewer';
import { Pill } from '@/components/dashboard/ui';

/*
 * Fabrication and installation (steps 5–6), read-only for the customer.
 *
 * The Project Manager sets the dates (start and target completion), may move
 * them with a reason, and marks the work done with photos of the finished
 * work as proof. The customer sees the dates, where it stands, any moves with
 * the reason, and the photos once it is done.
 */

type Props = {
    kind: 'fabrication' | 'installation';
    execution: ExecutionInfo;
};

const TEXT = {
    fabrication: {
        title: 'Fabrication',
        icon: <Hammer className="size-5" />,
        notScheduled: 'Our Project Manager will set the fabrication dates soon.',
        photos: 'Photos of the finished pieces',
    },
    installation: {
        title: 'Installation',
        icon: <Truck className="size-5" />,
        notScheduled: 'Our Project Manager will set the installation dates soon.',
        photos: 'Photos of the finished set-up',
    },
} as const;

const STATE: Record<ExecutionStage['state'], { label: string; tone: 'gray' | 'yellow' | 'blue' | 'green' }> = {
    not_scheduled: { label: 'Not scheduled yet', tone: 'gray' },
    scheduled: { label: 'Scheduled', tone: 'yellow' },
    in_progress: { label: 'In progress', tone: 'blue' },
    done: { label: 'Done', tone: 'green' },
};

const range = (start: string, end: string) => (start === end ? formatLongDate(start) : `${formatDate(start)} – ${formatDate(end)}`);

export default function ExecutionPanel({ kind, execution }: Props) {
    const stage = execution[kind];
    const text = TEXT[kind];
    const s = stage.schedule;

    return (
        <div className="grid gap-4">
            <Block>
                <BlockHeader title={text.title} icon={text.icon} action={<Pill tone={STATE[stage.state].tone}>{STATE[stage.state].label}</Pill>} />

                {s ? (
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-xs text-ink-soft">Start</dt>
                            <dd className="font-semibold text-ink">{formatLongDate(s.start)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-ink-soft">Target completion</dt>
                            <dd className="font-semibold text-ink">{formatLongDate(s.end)}</dd>
                        </div>
                        {s.completedAt && (
                            <div className="sm:col-span-2">
                                <dt className="text-xs text-ink-soft">Finished</dt>
                                <dd className="flex items-center gap-1.5 font-semibold text-green-700">
                                    <CheckCircle2 className="size-4" /> {formatLongDate(s.completedAt)}
                                </dd>
                            </div>
                        )}
                    </dl>
                ) : (
                    <Notice>{text.notScheduled}</Notice>
                )}

                {kind === 'installation' && (
                    <p className="mt-4 flex items-start gap-2 rounded-lg border border-black/10 bg-black/[0.02] p-3 text-sm text-ink">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-gold-dark" />
                        <span>
                            <span className="font-semibold">Your event:</span> {range(execution.installation.event.date, execution.installation.event.endDate)} at{' '}
                            {execution.installation.event.venue}
                        </span>
                    </p>
                )}

                {stage.changes.length > 0 && (
                    <div className="mt-4">
                        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">
                            <CalendarClock className="size-4" /> Schedule changes
                        </h4>
                        <ul className="grid gap-2">
                            {stage.changes.map((c, i) => (
                                <li key={i} className="rounded-lg border border-black/10 p-3 text-sm">
                                    <p className="text-ink">
                                        Moved from <span className="font-semibold">{range(c.start, c.end)}</span>
                                        {i === 0 && s ? (
                                            <>
                                                {' '}
                                                to <span className="font-semibold">{range(s.start, s.end)}</span>
                                            </>
                                        ) : null}
                                    </p>
                                    {c.reason && <p className="mt-1 text-ink-soft">Reason: {c.reason}</p>}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </Block>

            {stage.completion && <CompletionBlock title={text.photos} completion={stage.completion} />}
        </div>
    );
}

/** The work is done: the Project Manager's note and the photos as proof. */
function CompletionBlock({ title, completion: c }: { title: string; completion: NonNullable<ExecutionStage['completion']> }) {
    const [photo, setPhoto] = useState<number | null>(null);

    return (
        <Block>
            <BlockHeader title={title} description={`Recorded ${formatDate(c.recordedAt)}`} icon={<ImageIcon className="size-5" />} />

            {c.note && <p className="mb-4 text-sm whitespace-pre-line text-ink">{c.note}</p>}

            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {c.photos.map((p, i) => (
                    <li key={p.id}>
                        <button
                            type="button"
                            onClick={() => setPhoto(i)}
                            className="group block w-full overflow-hidden rounded-lg border border-black/10 bg-black/5 hover:border-gold"
                            aria-label={`View ${p.name}`}
                        >
                            <img src={p.url} alt={p.name} loading="lazy" className="aspect-[3/2] w-full object-cover transition group-hover:opacity-90" />
                        </button>
                    </li>
                ))}
            </ul>

            <PhotoViewer photos={c.photos} index={photo} onIndex={setPhoto} />
        </Block>
    );
}
