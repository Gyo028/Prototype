import { Link } from '@inertiajs/react';
import { Facebook, Mail, Phone } from 'lucide-react';

import { COMPANY } from '@/data/legal';

const quickLinks = [
    { label: 'Home', href: '/#home' },
    { label: 'Services', href: '/#services' },
    { label: 'Our Works', href: '/our-works' },
    { label: 'About us', href: '/#about' },
    { label: 'FAQ', href: '/faq' },
];

const linkColumns = [
    { title: 'Services', links: ['Corporate Events', 'Special Occasions', 'Custom Fabrication'] },
];

const contacts = [
    { label: 'Facebook', href: 'https://www.facebook.com/share/17uj5e738o/', Icon: Facebook },
    { label: COMPANY.phone, href: `tel:${COMPANY.phone}`, Icon: Phone },
    { label: COMPANY.email, href: `mailto:${COMPANY.email}`, Icon: Mail },
];

export default function LandingFooter() {
    return (
        <footer>
            <div className="bg-[#F7F7F7] py-16 lg:py-24">
                <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-x-8 gap-y-12 px-6 md:grid-cols-[auto_auto_minmax(0,1fr)] md:gap-x-12 lg:px-20 xl:grid-cols-[minmax(0,2fr)_auto_auto_auto]">
                    <div className="col-span-2 md:col-span-3 xl:col-span-1">
                        <p className="text-2xl text-black">Gr3at A's</p>
                        <p className="mt-8 max-w-sm text-base leading-7 text-neutral-800">
                            Customized event styling, furniture, structures, and greenery, tailored to every
                            client's needs and vision.
                        </p>
                    </div>

                    <div>
                        <h4 className="text-lg text-[#C99A2E]">Quick Links</h4>
                        <ul className="mt-6 space-y-4 text-base text-neutral-800">
                            {quickLinks.map(({ label, href }) => (
                                <li key={label}>
                                    <a href={href} className="transition-colors hover:text-[#C99A2E]">
                                        {label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {linkColumns.map((column, index) => (
                        <div key={index}>
                            <h4 className="text-lg text-[#C99A2E]">{column.title}</h4>
                            <ul className="mt-6 space-y-4 text-base text-neutral-800">
                                {column.links.map((link) => (
                                    <li key={link}>
                                        <a href="/#services" className="transition-colors hover:text-[#C99A2E]">
                                            {link}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    <div className="col-span-2 md:col-span-1">
                        <h4 className="text-lg text-[#C99A2E]">Contact Us</h4>
                        <ul className="mt-6 space-y-4 text-base text-neutral-800">
                            {contacts.map(({ label, href, Icon }) => (
                                <li key={label}>
                                    <a
                                        href={href}
                                        target={href.startsWith('http') ? '_blank' : undefined}
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-4 break-words transition-colors sm:whitespace-nowrap hover:text-[#C99A2E]"
                                    >
                                        <Icon className="h-6 w-6 shrink-0" />
                                        <span className="min-w-0">{label}</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <div className="bg-[#444444] py-5 text-sm text-neutral-400">
                <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 px-6 sm:flex-row lg:px-20">
                    <p>Copyright &copy; 2026</p>
                    <div className="flex gap-10">
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