import MoreInfoLink from '@/components/public/landing/more-info-link';

const services = [
    {
        title: 'Corporate Events',
        description:
            'Professional styling and management for brand activations, mall events, and corporate functions.',
    },
    {
        title: 'Special Occasions',
        description: 'Creative setups for weddings, birthdays, debuts, and milestone celebrations.',
    },
    {
        title: 'Custom Fabrication',
        description: 'Design and production of customized backdrops, props, and themed event structures.',
    },
];

export default function ServicesSection() {
    return (
        <section id="services" className="scroll-mt-16 bg-white py-16 lg:py-24">
            <div className="mx-auto grid max-w-[1400px] items-center gap-12 px-6 lg:grid-cols-[1fr_2.4fr] lg:px-12">
                <h2 className="font-['DM_Serif_Display',serif] text-4xl font-normal text-black md:text-5xl">Our Services</h2>

                <div className="grid gap-10 md:grid-cols-3 md:gap-8 lg:gap-12">
                    {services.map((service) => (
                        <article key={service.title}>
                            <h3 className="mb-6 font-['DM_Serif_Display',serif] text-2xl font-normal text-black md:text-[28px]">{service.title}</h3>
                            <p className="mb-5 text-[15px] leading-8 text-neutral-800">{service.description}</p>
                            <MoreInfoLink href="#services" />
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
