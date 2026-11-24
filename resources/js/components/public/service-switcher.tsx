import { Link } from '@inertiajs/react';

export type ServiceKey = 'corporate-events' | 'special-occasions' | 'custom-fabrication';

const services: { key: ServiceKey; label: string; href: string }[] = [
    { key: 'corporate-events', label: 'Corporate Events', href: '/services/corporate-events' },
    { key: 'special-occasions', label: 'Special Occasions', href: '/services/special-occasions' },
    { key: 'custom-fabrication', label: 'Custom Projects', href: '/services/custom-fabrication' },
];

type Props = {
    active: ServiceKey;
    align?: 'start' | 'center';
};

export default function ServiceSwitcher({ active, align = 'start' }: Props) {
    return (
        <nav
            aria-label="Our services"
            className={`mb-8 flex flex-wrap gap-2.5 ${align === 'center' ? 'justify-center' : 'justify-start'}`}
        >
            {services.map((service) => {
                const isActive = service.key === active;

                return (
                    <Link
                        key={service.key}
                        href={service.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={`rounded-full border px-5 py-2.5 text-[11px] font-bold tracking-[0.16em] uppercase backdrop-blur-sm transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#F2C75C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F2023] focus-visible:outline-none sm:text-xs ${
                            isActive
                                ? 'border-[#C99A2E] bg-[#C99A2E] text-[#1F2023] shadow-[0_10px_30px_-12px_rgba(242,199,92,0.7)]'
                                : 'border-white/35 bg-black/20 text-white hover:border-[#F2C75C] hover:text-[#F2C75C]'
                        }`}
                    >
                        {service.label}
                    </Link>
                );
            })}
        </nav>
    );
}
