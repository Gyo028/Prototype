import { Link } from '@inertiajs/react';
import { useState } from 'react';

const navLinks = [
    { label: 'Home', href: '/#home' },
    { label: 'Services', href: '/#services' },
    { label: 'Our Works', href: '/#works' },
    { label: 'About us', href: '/#about' },
];

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <nav className="fixed top-0 right-0 left-0 z-50 border-b border-cream-dark bg-white shadow-sm">
            <div className="flex h-[72px] w-full items-center justify-between gap-8 px-8 lg:px-14">
                {/* Brand */}
                <a href="/#home" className="flex shrink-0 items-center gap-3">
                    <div className="flex h-[52px] w-[52px] flex-col items-center justify-center rounded-full bg-ink">
                        <span className="text-lg leading-none font-extrabold text-gold">G</span>
                        <span className="mt-0.5 text-[6px] leading-none font-bold tracking-wider text-white">
                            R3AT A's
                        </span>
                        <span className="mt-0.5 text-[7px] leading-none text-gold">★</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[20px] leading-tight font-bold text-ink">GR3AT A's</span>
                        <span className="mt-0.5 text-[8px] font-medium tracking-[.16em] text-ink-soft uppercase">
                            Event Styling Services
                        </span>
                    </div>
                </a>

                {/* Desktop nav links */}
                <ul className="hidden items-center gap-14 lg:flex">
                    {navLinks.map((link) => (
                        <li key={link.label}>
                            <a href={link.href} className="nav-link-item">
                                {link.label}
                            </a>
                        </li>
                    ))}
                    <li>
                        <Link href="/faq" className="nav-link-item">
                            FAQs
                        </Link>
                    </li>
                </ul>

                {/* Login + mobile menu button */}
                <div className="flex shrink-0 items-center gap-3">
                    <Link
                        href="/login"
                        className="hidden items-center justify-center rounded-md bg-gold px-8 py-2.5 text-[13px] font-bold tracking-widest text-white transition-colors duration-200 hover:bg-gold-dark lg:inline-flex"
                    >
                        LOGIN
                    </Link>

                    <button
                        type="button"
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-label="Toggle menu"
                        aria-expanded={menuOpen}
                        className="rounded p-2 text-ink transition-colors hover:text-gold lg:hidden"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 6h16M4 12h16M4 18h16"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Mobile dropdown */}
            {menuOpen && (
                <div className="border-t border-cream-dark bg-white px-6 py-4 lg:hidden">
                    <ul className="flex flex-col gap-4">
                        {navLinks.map((link) => (
                            <li key={link.label}>
                                <a
                                    href={link.href}
                                    onClick={() => setMenuOpen(false)}
                                    className="text-[15px] font-medium text-ink transition-colors hover:text-gold"
                                >
                                    {link.label}
                                </a>
                            </li>
                        ))}
                        <li>
                            <Link
                                href="/faq"
                                className="text-[15px] font-medium text-ink transition-colors hover:text-gold"
                            >
                                FAQs
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/login"
                                className="inline-flex w-full items-center justify-center rounded-md bg-gold px-8 py-2.5 text-[13px] font-bold tracking-widest text-white"
                            >
                                LOGIN
                            </Link>
                        </li>
                    </ul>
                </div>
            )}
        </nav>
    );
}
