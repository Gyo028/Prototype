import { Link } from '@inertiajs/react';
import { Facebook, Mail, MapPin, Phone } from 'lucide-react';

import { COMPANY } from '@/data/legal';

const quickLinks = [
    { label: 'Home', href: '/#home' },
    { label: 'Services', href: '/#services' },
    { label: 'Our Works', href: '/our-works' },
    { label: 'About us', href: '/#about' },
    { label: 'FAQ', href: '/faq' },
];

const serviceLinks = [
    { label: 'Corporate Events', href: '/services/corporate-events' },
    { label: 'Special Occasions', href: '/services/special-occasions' },
    { label: 'Custom Fabrication', href: '/services/custom-fabrication' },
];

const contacts = [
    { label: 'Facebook', href: 'https://www.facebook.com/share/17uj5e738o/', Icon: Facebook },
    { label: COMPANY.phone, href: `tel:${COMPANY.phone}`, Icon: Phone },
    { label: COMPANY.email, href: `mailto:${COMPANY.email}`, Icon: Mail },
];

const headingClass = 'text-sm font-semibold tracking-[0.2em] text-[#C99A2E] uppercase';
const linkClass = 'text-white/80 transition-colors duration-200 hover:text-[#F2C75C]';

export default function LandingFooter() {
    return (
        <footer className="bg-[#1F2023] text-white">
            <div className="mx-auto max-w-[1400px] px-6 py-16 lg:px-20 lg:py-20">
                <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-3 xl:grid-cols-[minmax(0,1.6fr)_1fr_1fr_1.4fr] xl:gap-x-12">
                    <div className="col-span-2 md:col-span-3 xl:col-span-1">
                        <Link href="/" className="inline-flex items-center gap-3">
                            <img src="/images/Logo.png" alt="GR3AT A's logo" className="h-14 w-14 rounded-full bg-black object-cover" />
                            <span className="flex flex-col">
                                <span className="text-2xl leading-tight font-bold text-[#C99A2E]">GR3AT A's</span>
                                <span className="text-xs leading-tight tracking-[0.08em] text-white uppercase">Event Styling Services</span>
                            </span>
                        </Link>
                        <p className="mt-6 max-w-sm text-sm leading-7 text-white/70">
                            Customized event styling, furniture, structures, and greenery, tailored to every client's needs and vision.
                        </p>
                    </div>

                    <nav aria-label="Quick links">
                        <h4 className={headingClass}>Quick Links</h4>
                        <ul className="mt-6 space-y-3.5 text-sm">
                            {quickLinks.map(({ label, href }) => (
                                <li key={label}>
                                    <a href={href} className={linkClass}>
                                        {label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <nav aria-label="Services">
                        <h4 className={headingClass}>Services</h4>
                        <ul className="mt-6 space-y-3.5 text-sm">
                            {serviceLinks.map(({ label, href }) => (
                                <li key={label}>
                                    <a href={href} className={linkClass}>
                                        {label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="col-span-2 md:col-span-1">
                        <h4 className={headingClass}>Contact Us</h4>
                        <ul className="mt-6 space-y-3.5 text-sm">
                            {contacts.map(({ label, href, Icon }) => (
                                <li key={label}>
                                    <a
                                        href={href}
                                        target={href.startsWith('http') ? '_blank' : undefined}
                                        rel="noopener noreferrer"
                                        className={`inline-flex items-center gap-3 break-all ${linkClass}`}
                                    >
                                        <Icon className="h-5 w-5 shrink-0 text-[#C99A2E]" />
                                        <span className="min-w-0">{label}</span>
                                    </a>
                                </li>
                            ))}
                            <li className="flex items-start gap-3 text-white/80">
                                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#C99A2E]" />
                                <span>{COMPANY.address}</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="border-t border-white/15">
                <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-white/60 sm:flex-row lg:px-20">
                    <p>Copyright &copy; 2026 {COMPANY.name}. All rights reserved.</p>
                    <div className="flex gap-8">
                        <Link href="/terms" className="transition-colors hover:text-white">
                            Terms &amp; Conditions
                        </Link>
                        <Link href="/privacy" className="transition-colors hover:text-white">
                            Privacy Policy
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
