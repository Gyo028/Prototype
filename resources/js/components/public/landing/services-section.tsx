import MoreInfoLink from '@/components/public/landing/more-info-link';

const services = [
    {
        title: 'Corporate Events',
        description: 'Professional styling and management for brand activations, mall events, and corporate functions.',
        href: '/services/corporate-events',
    },
    {
        title: 'Special Occasions',
        description: 'Creative setups for weddings, birthdays, debuts, and milestone celebrations.',
        href: '/services/special-occasions',
    },
    {
        title: 'Custom Fabrication',
        description: 'Design and production of customized backdrops, props, and themed event structures.',
        href: '/services/custom-fabrication',
    },
];

export default function ServicesSection() {
    return (
        <section id="services" className="scroll-mt-16 bg-white py-16 lg:py-24">
            <div className="mx-auto grid max-w-[1400px] items-center gap-12 px-6 lg:grid-cols-[1fr_2.4fr] lg:px-12">
                <h2 className="font-['DM_Serif_Display',serif] text-4xl font-normal text-black md:text-5xl">Our Services</h2>

                <div className="grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-3">
                    {services.map((service) => (
                        <article key={service.title} className="group relative flex flex-col bg-white p-8 lg:p-10">
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 border border-transparent transition-colors duration-300 group-focus-within:border-[#C99A2E] group-hover:border-[#C99A2E]"
                            />
                            <h3 className="mb-6 font-['DM_Serif_Display',serif] text-2xl font-normal text-black md:text-[28px]">
                                {service.title}
                            </h3>
                            <p className="mb-5 flex-1 text-[15px] leading-8 text-neutral-800">{service.description}</p>
                            <MoreInfoLink href={service.href} className="self-start after:absolute after:inset-0" />
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
