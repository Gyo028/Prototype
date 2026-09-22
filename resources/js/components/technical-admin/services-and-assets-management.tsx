import { ArrowLeft, ArrowRight, ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { PageHeader, Panel } from '@/components/dashboard/ui';
import AssetThemeManagement from '@/components/technical-admin/asset-theme-management';
import ServiceManagement from '@/components/technical-admin/service-management';

/*
 * Landing screen for service configuration (backlog item 11).
 * Two areas to choose from: Services and Assets — aligned with the
 * customer-facing Services & Assets step:
 *  - Services: the flat Event Styling fee plus add-on services (DJ,
 *    photography, catering...), matching Services Needed on the customer side.
 *  - Assets: Design Themes and Design Assets, matching those two sections in
 *    the customer's Selection Panel. Kept as one "Assets" area with two tabs
 *    rather than a third card, since both feed the same Layout Panel.
 * The card images are empty placeholders for now.
 */

type AreaId = 'services' | 'assets';

const areas: { id: AreaId; title: string; description: string }[] = [
    {
        id: 'services',
        title: 'Services',
        description: 'Manage the Event Styling fee and the add-on services customers can select, e.g. DJ, photography, catering.',
    },
    {
        id: 'assets',
        title: 'Assets',
        description: 'Manage design themes and the layout assets customers can include in their request.',
    },
];

export default function ServicesAndAssetsManagement() {
    const [activeId, setActiveId] = useState<AreaId | null>(null);
    const active = areas.find((a) => a.id === activeId) ?? null;

    /* ---- A selected area ---- */
    if (active) {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setActiveId(null)}
                    className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-gold-dark hover:underline"
                >
                    <ArrowLeft className="size-4" /> Back to Services &amp; Assets
                </button>
                <PageHeader title={`${active.title} Management`} description={active.description} />

                {active.id === 'services' ? <ServiceManagement /> : <AssetThemeManagement />}
            </>
        );
    }

    /* ---- Selection ---- */
    return (
        <>
            <PageHeader
                title="Services & Assets"
                description="Choose what you want to manage."
            />

            <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
                {areas.map((a) => (
                    <button
                        key={a.id}
                        type="button"
                        onClick={() => setActiveId(a.id)}
                        aria-label={`Open ${a.title}`}
                        className="group text-left"
                    >
                        <Panel className="flex h-full flex-col overflow-hidden p-0 transition group-hover:border-gold group-hover:shadow-md">
                            {/* Image placeholder */}
                            <div className="flex aspect-video items-center justify-center bg-neutral-200 text-neutral-400">
                                <ImageIcon className="size-16" />
                            </div>

                            <div className="flex flex-1 items-start justify-between gap-4 p-5">
                                <div>
                                    <h2 className="text-lg font-bold text-ink">{a.title}</h2>
                                    <p className="mt-1 text-xs text-ink-soft">{a.description}</p>
                                </div>
                                <ArrowRight className="mt-1 size-5 shrink-0 text-gold-dark transition group-hover:translate-x-1" />
                            </div>
                        </Panel>
                    </button>
                ))}
            </div>
        </>
    );
}
