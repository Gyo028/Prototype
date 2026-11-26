import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import LayoutPreview, { LAYOUT_VIEW_KEY } from '@/components/customer/layout-preview';
import type { LayoutViewData } from '@/components/customer/layout-preview';

/*
 * Customer > the layout canvas, full screen (opened in a new tab by clicking
 * a canvas). It reads what the opening page put in localStorage, and follows
 * changes made there while this tab stays open.
 */

const read = (): LayoutViewData | null => {
    try {
        const raw = window.localStorage.getItem(LAYOUT_VIEW_KEY);
        return raw ? (JSON.parse(raw) as LayoutViewData) : null;
    } catch {
        return null;
    }
};

export default function LayoutView() {
    const [data, setData] = useState<LayoutViewData | null>(null);

    useEffect(() => {
        setData(read());
        const onStorage = (e: StorageEvent) => e.key === LAYOUT_VIEW_KEY && setData(read());
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    return (
        <div className="flex h-svh flex-col bg-neutral-100 p-3 sm:p-5">
            <Head title="Layout preview" />
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Preliminary layout</p>
                    <h1 className="text-lg font-bold text-ink">{data?.themeName ?? 'Layout preview'}</h1>
                </div>
                <p className="text-xs text-ink-soft">
                    Initial estimate only. Close this tab to go back. <span className="sm:hidden">Turn your phone sideways for more room.</span>
                </p>
            </div>

            {data ? (
                <LayoutPreview themeName={data.themeName} items={data.items} className="flex-1 [&_span]:text-sm" />
            ) : (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-black/15 bg-white p-6 text-center text-sm text-ink-soft">
                    Open this from a layout preview by clicking its canvas.
                </div>
            )}
        </div>
    );
}
