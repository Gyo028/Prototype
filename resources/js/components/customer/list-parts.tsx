import { Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx, inputClass } from '@/components/dashboard/ui';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/*
 * Shared pieces for the customer's list pages (My Projects, Billing & Payments,
 * a project's bills), so they all look and behave the same:
 *
 *  - up to four short columns, the most important first
 *  - the whole row opens the item; an arrow at the end of each row shows it can be opened
 *    (no "Open ›" link); no second lines under a cell
 *  - tablet and up (md, 768px): a table. Phones: one card per row.
 *  - a search box with a Filter button beside it; the filters and their counts
 *    are in the button's menu
 */

/* ---------------- Search + Filter button ---------------- */

export function ListToolbar<F extends string>({
    filters,
    value,
    onChange,
    count,
    label,
    query,
    onQuery,
    placeholder,
    allLabel,
}: {
    filters: { value: F; label: string }[];
    value: F;
    onChange: (f: F) => void;
    count: (f: F) => number;
    label: string;
    query: string;
    onQuery: (q: string) => void;
    placeholder: string;
    /** What the first filter ("All") shows as, e.g. "All projects". */
    allLabel: string;
}) {
    const current = filters.find((f) => f.value === value) ?? filters[0];
    // The first filter is "All": the button only names a filter that narrows the list.
    const narrowed = current && current.value !== filters[0]?.value;

    return (
        <div className="flex flex-wrap items-center gap-2 border-b border-black/10 p-3 sm:flex-nowrap sm:p-4">
            {/* What is showing. The Filter button itself stays plain. */}
            <p className="w-full text-sm font-bold text-ink sm:w-auto sm:flex-1" aria-live="polite">
                {narrowed ? (
                    <>
                        {current.label} <span className="font-normal text-ink-soft">· {count(current.value)} of {count(filters[0].value)}</span>
                        <button type="button" onClick={() => onChange(filters[0].value)} className="ml-2 text-xs font-bold text-gold-dark hover:underline">
                            Clear
                        </button>
                    </>
                ) : (
                    <>
                        {allLabel} <span className="font-normal text-ink-soft">· {count(filters[0].value)}</span>
                    </>
                )}
            </p>

            <label className="relative min-w-0 flex-1 sm:max-w-72 sm:flex-none sm:basis-72">
                <span className="sr-only">{placeholder}</span>
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
                <input type="search" className={cx(inputClass, 'pl-9')} placeholder={placeholder} value={query} onChange={(e) => onQuery(e.target.value)} />
            </label>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label={label}
                        className={cx(
                            'relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-bold whitespace-nowrap transition',
                            narrowed ? 'border-gold bg-white text-ink' : 'border-black/15 bg-white text-ink hover:border-gold',
                        )}
                    >
                        <SlidersHorizontal className="size-4" />
                        <span className="hidden sm:inline">Filter</span>
                        {/* A filter is on. */}
                        {narrowed && <span aria-hidden className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-white bg-gold" />}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-xs text-ink-soft">{label}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as F)}>
                        {filters.map((f) => (
                            <DropdownMenuRadioItem key={f.value} value={f.value} className="justify-between">
                                <span>{f.label}</span>
                                <span className="text-xs text-ink-soft">{count(f.value)}</span>
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

/* ---------------- Table (tablet and up) / cards (phones) ---------------- */

export type ListColumn<T> = {
    header: string;
    cell: (row: T) => ReactNode;
    align?: 'right';
    /** Extra classes for the cell, e.g. a colour. */
    className?: string | ((row: T) => string);
};

export function ListTable<T>({
    rows,
    rowKey,
    href,
    columns,
    card,
    action,
}: {
    rows: T[];
    rowKey: (row: T) => string | number;
    href: (row: T) => string;
    columns: ListColumn<T>[];
    /** The phone card's content. */
    card: (row: T) => ReactNode;
    /** Optional button at the end of a row (e.g. Pay). Shown only where it applies. */
    action?: (row: T) => ReactNode;
}) {
    const cellClass = (c: ListColumn<T>, row: T) => (typeof c.className === 'function' ? c.className(row) : c.className);

    return (
        <>
            <table className="hidden w-full text-left text-sm md:table">
                <thead className="bg-black/[0.03] text-xs tracking-wide text-ink-soft uppercase">
                    <tr>
                        {columns.map((c) => (
                            <th key={c.header} className={cx('px-4 py-3 font-semibold first:pl-5', c.align === 'right' && 'text-right')}>
                                {c.header}
                            </th>
                        ))}
                        <th className="w-px px-4 py-3 pr-5">
                            <span className="sr-only">Open</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr
                            key={rowKey(row)}
                            className="group cursor-pointer border-t border-black/10 transition hover:bg-gold/5"
                            onClick={() => router.visit(href(row))}
                        >
                            {columns.map((c, i) => (
                                <td key={c.header} className={cx('px-4 py-3 first:pl-5', c.align === 'right' && 'text-right whitespace-nowrap', cellClass(c, row))}>
                                    {/* The first cell is a real link, so the row can be reached and opened with the keyboard. */}
                                    {i === 0 ? (
                                        <Link href={href(row)} onClick={(e) => e.stopPropagation()} className="rounded outline-none focus-visible:ring-2 focus-visible:ring-gold">
                                            {c.cell(row)}
                                        </Link>
                                    ) : (
                                        c.cell(row)
                                    )}
                                </td>
                            ))}
                            <td className="px-4 py-3 pr-5">
                                <div className="flex items-center justify-end gap-3">
                                    {action && <span onClick={(e) => e.stopPropagation()}>{action(row)}</span>}
                                    <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-gold-dark" />
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <ul className="divide-y divide-black/10 md:hidden">
                {rows.map((row) => {
                    const extra = action?.(row);
                    return (
                        <li key={rowKey(row)} className="flex items-center gap-3 pr-4">
                            <Link href={href(row)} className="block min-w-0 flex-1 py-3 pl-4 transition active:bg-gold/5">
                                {card(row)}
                            </Link>
                            {extra}
                            <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-soft" />
                        </li>
                    );
                })}
            </ul>
        </>
    );
}

/**
 * The phone card's layout: a small top line, the title, then one line below,
 * with the tag (e.g. the status) on the right, centred like the row's arrow.
 */
export function ListCard({ top, tag, title, bottom }: { top: ReactNode; tag?: ReactNode; title: ReactNode; bottom?: ReactNode }) {
    return (
        <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-ink-soft">{top}</span>
                <p className="mt-0.5 truncate font-bold text-ink">{title}</p>
                {bottom && <div className="mt-0.5 text-sm text-ink-soft">{bottom}</div>}
            </div>
            {tag && <span className="shrink-0">{tag}</span>}
        </div>
    );
}

/* ---------------- Empty state and pages ---------------- */

export function ListEmpty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-ink-soft">
            {icon}
            <p className="text-sm">{children}</p>
        </div>
    );
}

export function ListPager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
    if (total === 0) return null;

    const pages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 px-4 py-3">
            <p className="text-xs text-ink-soft">
                Showing {start + 1}–{Math.min(start + pageSize, total)} of {total}
            </p>
            {pages > 1 && (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        aria-label="Previous page"
                        disabled={page === 1}
                        onClick={() => onPage(page - 1)}
                        className="rounded border border-black/15 bg-white p-2 disabled:opacity-40 md:p-1.5"
                    >
                        <ChevronLeft className="size-4" />
                    </button>
                    {/* Phones: "2 / 5" instead of a button per page. */}
                    <span className="text-xs font-semibold text-ink md:hidden">
                        {page} / {pages}
                    </span>
                    <div className="hidden items-center gap-2 md:flex">
                        {Array.from({ length: pages }).map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Page ${i + 1}`}
                                aria-current={page === i + 1 ? 'page' : undefined}
                                onClick={() => onPage(i + 1)}
                                className={cx('size-8 rounded border text-xs font-bold', page === i + 1 ? 'border-gold bg-gold text-white' : 'border-black/15 bg-white')}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        aria-label="Next page"
                        disabled={page === pages}
                        onClick={() => onPage(page + 1)}
                        className="rounded border border-black/15 bg-white p-2 disabled:opacity-40 md:p-1.5"
                    >
                        <ChevronRight className="size-4" />
                    </button>
                </div>
            )}
        </div>
    );
}

/** Keeps a page number inside the list's range. */
export function pageSlice<T>(rows: T[], page: number, pageSize: number) {
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    const current = Math.min(page, pages);
    const start = (current - 1) * pageSize;
    return { current, visible: rows.slice(start, start + pageSize) };
}
