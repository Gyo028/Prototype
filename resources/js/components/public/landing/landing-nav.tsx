import { Menu, X } from 'lucide-react';
import { useState } from 'react';

const navLinks = [
    { label: 'Home', href: '#home' },
    { label: 'Services', href: '#services' },
    { label: 'Our Works', href: '#works' },
    { label: 'About us', href: '#about' },
    { label: 'FAQ', href: '/faq' },
];

function Logo() {
    return (
        <a href="#home" className="flex shrink-0 items-center gap-3">
            <span className="flex h-12 w-12 flex-col items-center justify-center rounded-full bg-black ring-1 ring-white/20 md:h-[52px] md:w-[52px]">
                <span className="text-lg leading-none font-extrabold text-white">G</span>
                <span className="mt-0.5 text-[6px] leading-none font-bold tracking-wider text-[#E8B53A]">
                    R3AT A's
                </span>
            </span>
            <span className="flex flex-col text-white">
                <span className="text-xl leading-tight font-bold md:text-2xl">GR3AT A's</span>
                <span className="text-[9px] leading-tight tracking-[0.12em] uppercase md:text-[11px]">
                    Event Styling Services
                </span>
            </span>
        </a>
    );
}

/** Floating, translucent navigation bar that sits on top of the hero image. */
export default function LandingNav() {
    const [open, setOpen] = useState(false);

    return (
        <header className="fixed inset-x-0 top-0 z-50 bg-gradient-to-b from-black/70 via-black/35 to-transparent backdrop-blur-[3px]">
            <div className="mx-auto flex h-20 max-w-[1600px] items-center justify-between gap-6 px-5 md:px-8 lg:h-24 lg:px-12">
                <Logo />

                <nav aria-label="Main" className="hidden flex-1 justify-center lg:flex">
                    <ul className="flex items-center gap-10 xl:gap-16">
                        {navLinks.map((link) => (
                            <li key={link.label}>
                                <a
                                    href={link.href}
                                    className="text-base font-semibold text-white transition-colors hover:text-[#F2C75C] xl:text-lg"
                                >
                                    {link.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="flex items-center gap-3">
                    <a
                        href="/login"
                        className="hidden rounded-sm bg-white px-9 py-2.5 text-base font-bold tracking-wide text-[#C99A2E] uppercase shadow-sm transition-colors hover:bg-neutral-100 lg:inline-flex xl:px-12"
                    >
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
                <div className="border-t border-white/15 bg-black/75 px-6 py-5 backdrop-blur-md lg:hidden">
                    <ul className="flex flex-col gap-4">
                        {navLinks.map((link) => (
                            <li key={link.label}>
                                <a
                                    href={link.href}
                                    onClick={() => setOpen(false)}
                                    className="text-base font-semibold text-white hover:text-[#F2C75C]"
                                >
                                    {link.label}
                                </a>
                            </li>
                        ))}
                        <li>
                            <a
                                href="/login"
                                className="inline-flex w-full items-center justify-center rounded-sm bg-white px-8 py-2.5 text-base font-bold tracking-wide text-[#C99A2E] uppercase"
                            >
                                Login
                            </a>
                        </li>
                    </ul>
                </div>
            )}
        </header>
    );
}
