import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/*
 * A grey placeholder for the page that is loading, shown in the content area
 * (the sidebar and top bar stay) from the moment a link is clicked until the
 * new page arrives.
 *
 * Only for moving to another page: not for form submits, filters that keep
 * the page (preserveState), background loads of deferred props (partial
 * reloads), prefetching or reloading the same page.
 *
 * Its shape follows the kind of page that is coming:
 *   dashboard  the section's home (stat tiles and cards)
 *   detail     one record or a form (a project, a bill, My Profile)
 *   list       a table with its toolbar
 */

export type PageKind = 'dashboard' | 'detail' | 'list';

/** Wait this long before showing it, so a quick page doesn't flash a skeleton. */
const SHOW_AFTER_MS = 120;

/** Paths that open one record or a form rather than a list. */
const DETAIL_PAGES = ['/profile', '/new-request', '/website-content'];

/** What kind of page a path inside the section (e.g. /customer) opens. */
export function pageKind(path: string, root: string): PageKind {
    const clean = path.replace(/\/+$/, '') || '/';

    if (clean === root) return 'dashboard';
    // A number in the path is a record: /customer/projects/19, /customer/billing/projects/18.
    if (/\/\d+(\/|$)/.test(clean) || DETAIL_PAGES.some((p) => clean.endsWith(p))) return 'detail';

    return 'list';
}

/** The kind of page being loaded inside the section, or null when nothing is loading. */
export function usePendingPage(root: string): PageKind | null {
    const [pending, setPending] = useState<PageKind | null>(null);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;

        const stopStart = router.on('start', (event) => {
            const visit = event.detail.visit;
            const target = visit.url.pathname;
            const isPageChange =
                visit.method === 'get' &&
                visit.only.length === 0 &&
                visit.except.length === 0 &&
                !visit.prefetch &&
                visit.preserveState !== true &&
                target !== window.location.pathname &&
                target.startsWith(root);

            if (!isPageChange) return;

            clearTimeout(timer);
            timer = setTimeout(() => setPending(pageKind(target, root)), SHOW_AFTER_MS);
        });

        // Done, cancelled or failed: back to the page (a new page replaces the layout anyway).
        const stopFinish = router.on('finish', () => {
            clearTimeout(timer);
            setPending(null);
        });

        return () => {
            clearTimeout(timer);
            stopStart();
            stopFinish();
        };
    }, [root]);

    return pending;
}

const panel = 'rounded-2xl border border-black/10 bg-white shadow-sm';

export default function PageSkeleton({ kind }: { kind: PageKind }) {
    return (
        <div className="mx-auto w-full max-w-[1150px]" aria-busy="true" aria-label="Loading the page">
            {kind === 'dashboard' && <DashboardShape />}
            {kind === 'detail' && <DetailShape />}
            {kind === 'list' && <ListShape />}
        </div>
    );
}

function Heading() {
    return (
        <div className="mb-6 space-y-2">
            <Skeleton className="h-8 w-56 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
        </div>
    );
}

function DashboardShape() {
    return (
        <div className="space-y-5 md:space-y-6">
            <Heading />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`${panel} space-y-3 p-5`}>
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                {[4, 3].map((rows, i) => (
                    <div key={i} className={`${panel} p-5`}>
                        <Skeleton className="h-5 w-36" />
                        <div className="mt-5 space-y-4">
                            {Array.from({ length: rows }, (_, r) => (
                                <div key={r} className="flex items-center gap-3">
                                    <Skeleton className="size-9 shrink-0 rounded-full" />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function DetailShape() {
    return (
        <div className="space-y-5">
            <Skeleton className="h-4 w-28" />
            <div className={`${panel} overflow-hidden`}>
                <div className="space-y-2 border-b border-black/10 px-5 py-4">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-7 w-72 max-w-full" />
                    <div className="flex gap-3">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                </div>
                <div className="flex gap-3 border-b border-black/10 px-5 py-4">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-8 flex-1" />
                    ))}
                </div>
                <div className="space-y-4 p-5">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-4 w-full max-w-xl" />
                    <Skeleton className="h-4 w-2/3 max-w-md" />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                    <Skeleton className="h-28 w-full" />
                </div>
            </div>
        </div>
    );
}

function ListShape() {
    return (
        <div>
            <Heading />
            <div className={`${panel} overflow-hidden`}>
                <div className="flex flex-col gap-3 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-9 w-full sm:w-64" />
                </div>
                <div className="hidden gap-4 border-b border-black/10 px-5 py-3 sm:flex">
                    {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-3 flex-1" />
                    ))}
                </div>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 border-b border-black/5 px-5 py-4 last:border-b-0">
                        <Skeleton className="h-4 w-20 shrink-0" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="hidden h-4 w-24 sm:block" />
                        <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
                    </div>
                ))}
            </div>
        </div>
    );
}
