import { Facebook, Instagram, Twitter } from 'lucide-react';

const linkColumns = [
    { title: 'Services', links: ['Corporate Events', 'Special Occasions', 'Custom Fabrication'] },
];

const socials = [
    { label: 'Facebook', href: 'https://www.facebook.com/share/17uj5e738o/', Icon: Facebook },
    { label: 'Twitter', href: '#', Icon: Twitter },
    { label: 'Instagram', href: '#', Icon: Instagram },
];

export default function LandingFooter() {
    return (
        <footer>
            <div className="bg-[#F7F7F7] py-16 lg:py-24">
                <div className="mx-auto grid max-w-[1400px] gap-12 px-6 md:grid-cols-2 lg:grid-cols-[3fr_1fr_1fr] lg:px-20">
                    <div>
                        <p className="text-2xl text-black">Gr3at A's</p>
                        <p className="mt-8 max-w-sm text-base leading-7 text-neutral-800">
                            Customized event styling, furniture, structures, and greenery, tailored to every
                            client's needs and vision.
                        </p>
                    </div>

                    {linkColumns.map((column, index) => (
                        <div key={index}>
                            <h4 className="text-lg text-[#F28C28]">{column.title}</h4>
                            <ul className="mt-6 space-y-4 text-base text-neutral-800">
                                {column.links.map((link) => (
                                    <li key={link}>
                                        <a href="/#services" className="transition-colors hover:text-[#F28C28]">
                                            {link}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    <div>
                        <h4 className="text-lg text-[#F28C28]">Follow Us</h4>
                        <ul className="mt-6 space-y-4 text-base text-neutral-800">
                            {socials.map(({ label, href, Icon }) => (
                                <li key={label}>
                                    <a
                                        href={href}
                                        target={href.startsWith('http') ? '_blank' : undefined}
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-4 transition-colors hover:text-[#F28C28]"
                                    >
                                        <Icon className="h-6 w-6" />
                                        {label}
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
                        <a href="#" className="transition-colors hover:text-white">
                            Terms &amp; Conditions
                        </a>
                        <a href="#" className="transition-colors hover:text-white">
                            Privacy Policy
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
