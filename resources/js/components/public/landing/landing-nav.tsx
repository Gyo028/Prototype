import { usePage } from '@inertiajs/react';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type LandingNavProps = {
    /** true on the landing page; on other pages the links point back to "/" */
    isHome?: boolean;
    /** @deprecated No longer used: the Login button now always uses the gold gradient style. */
    loginStyle?: 'light' | 'gold';
};

type NavLink = {
    label: string;
    href: string;
    /** Returns true when this link represents the page the visitor is on. */
    isActive: (path: string) => boolean;
};

function getNavLinks(isHome: boolean): NavLink[] {
    const prefix = isHome ? '' : '/';

    return [
        { label: 'Home', href: isHome ? '#home' : '/', isActive: () => false },
        { label: 'Services', href: `${prefix}#services`, isActive: () => false },
        { label: 'Our Works', href: '/our-works', isActive: (path) => path.startsWith('/our-works') },
        { label: 'About us', href: `${prefix}#about`, isActive: () => false },
        { label: 'FAQ', href: '/faq', isActive: (path) => path.startsWith('/faq') },
    ];
}

export const loginButton =
    'items-center justify-center rounded-md bg-gradient-to-b from-[#F3CC66] to-[#D29F38] font-bold tracking-wide text-[#2A2A2A] uppercase shadow-sm transition hover:brightness-105';

function Logo({ href }: { href: string }) {
    return (
        <a href={href} className="flex shrink-0 items-center gap-3">
            <img
                src="/images/Logo.png"
                alt="GR3AT A's logo"
                className="h-12 w-12 rounded-full border-2 border-[#F2C75C] bg-black object-cover md:h-[52px] md:w-[52px]"
            />
            <span className="flex flex-col text-white">
                <span className="text-xl leading-tight font-bold md:text-2xl">GR3AT A's</span>
                <span className="text-[9px] leading-tight tracking-[0.14em] uppercase md:text-[11px]">
                    Event Styling Services
                </span>
            </span>
        </a>
    );
}

/** Solid dark navigation bar fixed to the top of the page. */
export default function LandingNav({ isHome = true }: LandingNavProps) {
    const [open, setOpen] = useState(false);
    // Section link (Home / Services / About us) the visitor last clicked; shows the gold underline.
    const [clicked, setClicked] = useState<string | null>(null);
    const navLinks = getNavLinks(isHome);

    // Current path without query string or hash, e.g. "/our-works".
    const path = usePage().url.split(/[?#]/)[0] || '/';

    // Arriving from another page at "/#services": scroll to that section once the page has rendered.
    useEffect(() => {
        if (!isHome) return;
        const id = window.location.hash.slice(1);
        if (id) document.getElementById(id)?.scrollIntoView();
    }, [isHome]);

    return (
        <header className="fixed inset-x-0 top-0 z-50 bg-[#1F2023] shadow-md">
            <div className="mx-auto flex h-[72px] max-w-[1600px] items-center justify-between gap-6 px-5 md:px-8 lg:px-12">
                <Logo href={isHome ? '#home' : '/'} />

                <nav aria-label="Main" className="hidden flex-1 justify-center lg:flex">
                    <ul className="flex items-center gap-10 xl:gap-16">
                        {navLinks.map((link) => {
                            const active = link.isActive(path) || clicked === link.label;

                            return (
                                <li key={link.label}>
                                    <a
                                        href={link.href}
                                        onClick={() => setClicked(link.label)}
                                        aria-current={active ? 'page' : undefined}
                                        className={`inline-block border-b-2 pb-1 text-base font-medium transition-colors xl:text-lg ${
                                            active
                                                ? 'border-[#F2C75C] text-[#F2C75C]'
                                                : 'border-transparent text-white hover:text-[#F2C75C]'
                                        }`}
                                    >
                                        {link.label}
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <div className="flex items-center gap-3">
                    <a href="/login" className={`hidden px-9 py-2.5 text-sm lg:inline-flex xl:px-12 ${loginButton}`}>
                        Login
                    </a>

                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        aria-label="Toggle menu"
                        aria-expanded={open}
                        className="rounded-md p-2 text-white transition-colors hover:bg-white/10 lg:hidden"
                    >
                        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>
                </div>
            </div>

            {open && (
                <div className="border-t border-white/10 bg-[#1F2023] px-6 py-5 lg:hidden">
                    <ul className="flex flex-col gap-4">
                        {navLinks.map((link) => {
                            const active = link.isActive(path) || clicked === link.label;

                            return (
                                <li key={link.label}>
                                    <a
                                        href={link.href}
                                        onClick={() => {
                                            setClicked(link.label);
                                            setOpen(false);
                                        }}
                                        aria-current={active ? 'page' : undefined}
                                        className={`text-base font-medium hover:text-[#F2C75C] ${
                                            active ? 'text-[#F2C75C]' : 'text-white'
                                        }`}
                                    >
                                        {link.label}
                                    </a>
                                </li>
                            );
                        })}
                        <li>
                            <a href="/login" className={`flex w-full px-8 py-2.5 text-sm ${loginButton}`}>
                                Login
                            </a>
                        </li>
                    </ul>
                </div>
            )}
        </header>
    );
}
