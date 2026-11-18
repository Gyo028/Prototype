import { Link, usePage } from '@inertiajs/react';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type LandingNavProps = {
    isHome?: boolean;
    loginStyle?: 'light' | 'gold';
};

type NavLink = {
    label: string;
    href: string;
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

const navLoginButton =
    'items-center justify-center rounded-full bg-[#C99A2E] font-bold tracking-wide text-[#1F2023] uppercase shadow-sm transition-[background-color,box-shadow] duration-300 hover:bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.65)] focus-visible:bg-white focus-visible:shadow-[0_0_20px_rgba(255,255,255,0.65)] focus-visible:outline-none';

// Pages without a #section use Inertia's Link so they change without a full reload.
type NavAnchorProps = {
    href: string;
    className?: string;
    onClick?: () => void;
    'aria-current'?: 'page';
    children: ReactNode;
};

function NavAnchor({ href, ...props }: NavAnchorProps) {
    if (href.startsWith('/') && !href.includes('#')) {
        return <Link href={href} {...props} />;
    }

    return <a href={href} {...props} />;
}

function Logo({ href }: { href: string }) {
    return (
        <NavAnchor href={href} className="flex shrink-0 items-center gap-3">
            <img
                src="/images/Logo.png"
                alt="GR3AT A's logo"
                className="h-11 w-11 rounded-full bg-black object-cover lg:h-14 lg:w-14"
            />
            <span className="flex flex-col">
                <span className="text-xl leading-tight font-bold text-[#C99A2E] lg:text-2xl">GR3AT A's</span>
                <span className="text-[9px] leading-tight tracking-[0.08em] text-white uppercase lg:text-xs">
                    Event Styling Services
                </span>
            </span>
        </NavAnchor>
    );
}

export default function LandingNav({ isHome = true }: LandingNavProps) {
    const [open, setOpen] = useState(false);
    const [clicked, setClicked] = useState<string | null>(null);
    const navLinks = getNavLinks(isHome);
    const path = usePage().url.split(/[?#]/)[0] || '/';

    useEffect(() => {
        if (!isHome) return;
        const id = window.location.hash.slice(1);
        if (id) document.getElementById(id)?.scrollIntoView();
    }, [isHome]);

    return (
        <header className="fixed inset-x-0 top-0 z-50 bg-[#1F2023] shadow-[0_6px_24px_rgba(0,0,0,0.3)]">
            <div className="mx-auto max-w-[1600px]">
                <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:grid lg:h-20 lg:grid-cols-[1fr_auto_1fr] lg:px-8">
                    <Logo href={isHome ? '#home' : '/'} />

                    <nav aria-label="Main" className="hidden justify-center lg:flex">
                        <ul className="flex items-center gap-10 xl:gap-14">
                            {navLinks.map((link) => {
                                const active = link.isActive(path) || clicked === link.label;

                                return (
                                    <li key={link.label}>
                                        <NavAnchor
                                            href={link.href}
                                            onClick={() => setClicked(link.label)}
                                            aria-current={active ? 'page' : undefined}
                                            className={`inline-block border-b-2 pb-1 text-base font-semibold transition-colors duration-300 xl:text-lg ${
                                                active
                                                    ? 'border-[#F2C75C] text-[#F2C75C]'
                                                    : 'border-transparent text-white hover:text-[#F2C75C]'
                                            }`}
                                        >
                                            {link.label}
                                        </NavAnchor>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    <div className="flex items-center justify-end gap-3">
                        <a
                            href="/login"
                            className={`hidden px-9 py-3 text-sm lg:inline-flex xl:px-12 xl:text-base ${navLoginButton}`}
                        >
                            Login
                        </a>

                        <button
                            type="button"
                            onClick={() => setOpen((v) => !v)}
                            aria-label="Toggle menu"
                            aria-expanded={open}
                            className="rounded-full p-2.5 text-white transition-colors hover:bg-white/10 lg:hidden"
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
                                        <NavAnchor
                                            href={link.href}
                                            onClick={() => {
                                                setClicked(link.label);
                                                setOpen(false);
                                            }}
                                            aria-current={active ? 'page' : undefined}
                                            className={`text-base font-semibold hover:text-[#F2C75C] ${
                                                active ? 'text-[#F2C75C]' : 'text-white'
                                            }`}
                                        >
                                            {link.label}
                                        </NavAnchor>
                                    </li>
                                );
                            })}
                            <li>
                                <a href="/login" className={`flex w-full px-8 py-3 text-sm ${navLoginButton}`}>
                                    Login
                                </a>
                            </li>
                        </ul>
                    </div>
                )}
            </div>
        </header>
    );
}