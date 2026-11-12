import { Link, router, usePage } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { NavGroup, NavLink } from '@/components/dashboard/nav';
import { cx } from '@/components/dashboard/ui';

type Props = {
    nav: NavGroup[];
    roleLabel: string;
    /** Called after a link is clicked (used to close the mobile drawer) */
    onNavigate?: () => void;
};

type SharedProps = { auth?: { user?: { name?: string } } };

function initials(name: string) {
    return name
        .split(' ')
        .filter(Boolean)
        .map((word) => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

export default function Sidebar({ nav, roleLabel, onNavigate }: Props) {
    const { url, props } = usePage<SharedProps>();

    const name = props.auth?.user?.name ?? 'User';
    const path = url.split('?')[0];
    const firstItem = nav[0]?.items[0];
    const firstHref = firstItem && 'href' in firstItem ? firstItem.href : undefined;

    // The dashboard link must match exactly, otherwise it would stay
    // highlighted on every page under /technical-admin
    const isActive = (href: string) =>
        href === firstHref ? path === href : path.startsWith(href);

    return (
        <div className="flex h-full flex-col bg-[#222222] text-white">
            {/* Signed-in user */}
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-6">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold">
                    {initials(name)}
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{name}</p>
                    <p className="truncate text-xs text-white/70">{roleLabel}</p>
                </div>
            </div>

            {/* Menu */}
            <nav className="flex-1 overflow-y-auto py-2">
                {nav.map((group) => (
                    <div key={group.label} className="mb-1">
                        <p className="px-5 pt-3 pb-1 text-[11px] tracking-wide text-white/50 uppercase">
                            {group.label}
                        </p>

                        {group.items.map((item) =>
                            'children' in item ? (
                                <NavDropdown
                                    key={item.title}
                                    title={item.title}
                                    links={item.children}
                                    isActive={isActive}
                                    onNavigate={onNavigate}
                                />
                            ) : (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={onNavigate}
                                    className={cx(
                                        'block px-8 py-2.5 text-sm font-medium transition',
                                        isActive(item.href)
                                            ? 'bg-gold text-white'
                                            : 'text-white/90 hover:bg-white/10',
                                    )}
                                >
                                    {item.title}
                                </Link>
                            ),
                        )}
                    </div>
                ))}
            </nav>

            {/* Logout pinned to the bottom of the sidebar */}
            <div className="border-t border-white/10 py-2">
                <button
                    type="button"
                    onClick={() => router.post('/logout')}
                    className="block w-full px-8 py-2.5 text-left text-sm font-bold text-red-500 transition hover:bg-white/10"
                >
                    Logout
                </button>
            </div>
        </div>
    );
}

/** A sidebar entry that opens to show more links (e.g. Projects). It starts open when one of its links is the current page. */
function NavDropdown({
    title,
    links,
    isActive,
    onNavigate,
}: {
    title: string;
    links: NavLink[];
    isActive: (href: string) => boolean;
    onNavigate?: () => void;
}) {
    const hasActiveLink = links.some((link) => isActive(link.href));
    const [open, setOpen] = useState(hasActiveLink);

    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className={cx(
                    'flex w-full items-center justify-between px-8 py-2.5 text-left text-sm font-medium transition hover:bg-white/10',
                    hasActiveLink ? 'text-gold' : 'text-white/90',
                )}
            >
                {title}
                <ChevronDown className={cx('size-4 transition-transform', open && 'rotate-180')} />
            </button>

            {open && (
                <div className="pb-1">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={onNavigate}
                            className={cx(
                                'block py-2 pr-8 pl-12 text-sm transition',
                                isActive(link.href)
                                    ? 'bg-gold font-medium text-white'
                                    : 'text-white/75 hover:bg-white/10 hover:text-white',
                            )}
                        >
                            {link.title}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}