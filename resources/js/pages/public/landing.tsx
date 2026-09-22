import WorksCarousel from '@/components/public/works-carousel';
import PublicLayout from '@/layouts/public-layout';

const services = [
    {
        title: (
            <>
                Corporate <br /> Events
            </>
        ),
        description:
            'Professional styling and management for brand activations, mall events, and corporate functions.',
        leading: 'leading-[1.25]',
    },
    {
        title: (
            <>
                Special <br /> Occasions
            </>
        ),
        description: 'Creative setups for weddings, birthdays, debuts, and milestone celebrations.',
        leading: 'leading-[1.25]',
    },
    {
        title: (
            <>
                Custom <br /> Fabrication
            </>
        ),
        description: 'Design and production of customized backdrops, props, and themed event structures.',
        leading: 'leading-[1.5]',
    },
];

const testimonials = [
    {
        name: 'Barbie',
        quote: 'The team exceeded our expectations. Every detail was perfectly executed and our guests were amazed!',
    },
    {
        name: 'Norhan',
        quote: 'Absolutely stunning setup. They understood our vision and brought it to life beautifully. Will book again!',
    },
    {
        name: 'Daica Reyes',
        quote: 'Professional, creative, and dedicated. Our wedding reception looked like something out of a magazine.',
    },
];

export default function Landing() {
    return (
        <PublicLayout title="Gr3at A's Events Styling & Services">
            {/* Hero */}
            <section
                id="home"
                className="relative flex min-h-screen items-center overflow-hidden pt-[72px]"
                style={{
                    backgroundImage: "url('/images/hero-bg.webp')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: '#F5EDD8',
                }}
            >
                <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20 lg:px-16">
                    <div className="max-w-[560px]">
                        <h1
                            className="leading-tight font-bold text-ink"
                            style={{ fontSize: 'clamp(36px, 5vw, 50px)' }}
                        >
                            Unforgettable Events,
                            <span className="block text-gold">Perfectly Planned</span>
                        </h1>

                        <p className="mt-5 max-w-[500px] text-[15px] leading-[1.8] text-ink-soft">
                            We bring ideas to life through thoughtful planning, creative styling, and smooth
                            coordination — making every event seamless and memorable.
                        </p>

                        <a
                            href="#services"
                            className="mt-10 inline-flex items-center justify-center rounded-lg bg-gold px-10 py-4 text-[14px] font-bold tracking-widest text-white transition-colors duration-200 hover:bg-gold-dark"
                        >
                            Start Project
                        </a>
                    </div>
                </div>
            </section>

            {/* About */}
            <section id="about" className="bg-white py-20">
                <div className="mx-auto max-w-7xl px-6 text-center">
                    <div className="section-eyebrow">
                        <span className="eyebrow-line" />
                        <span className="eyebrow-text">About Us</span>
                        <span className="eyebrow-line" />
                    </div>

                    <p className="mb-6 text-[20px] leading-[1.5] text-ink">
                        Gr3at A's Events Styling & Services — specializes in event set-up and styling. We customize
                        according to the needs of our clients. <br /> We supply rattan lamps, synthetic rattan
                        furniture, drum furniture, upholstery, gigantic fabric and foam flowers, sticker decals,
                        lighted signage, sublimation, tarp and sticker prints. We manufacture wood and steel
                        structures with installation. We also supply plants for your greening projects.
                    </p>

                    <p className="mb-6 text-[20px] leading-[1.5] text-ink">
                        Gr3at A's is a company with a heart. We are committed to supporting the education of our
                        scholars and selected charitable institutions.
                    </p>

                    <p className="mt-4 text-[20px] font-semibold text-gold-dark italic">
                        With Gr3at A's, graces are shared. Happy to serve!
                    </p>
                </div>
            </section>

            {/* Services */}
            <section id="services" className="bg-ivory-white py-20">
                <div className="max-w-8xl mx-auto px-4">
                    <div className="section-title">
                        <h2 className="section-heading">Our Services</h2>
                        <span className="section-line" />
                    </div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        {services.map((service, index) => (
                            <div key={index} className="service-card">
                                <h3 className="mb-3 text-[24px] font-bold tracking-[.05em] text-ink uppercase">
                                    {service.title}
                                </h3>
                                <p className={`text-[20px] ${service.leading} text-ink`}>{service.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Our Works */}
            <section id="works" className="overflow-hidden bg-cream py-20">
                <div className="section-title">
                    <h2 className="section-heading">Our Works</h2>
                    <span className="section-line" />
                </div>

                <WorksCarousel />

                <div className="mt-10">
                    <span className="section-line w-[350px]" />
                </div>
            </section>

            {/* Testimonials */}
            <section id="testimonials" className="bg-ivory-white py-20">
                <div className="mx-auto max-w-[1400px] px-6">
                    <div className="section-title">
                        <h2 className="section-heading">Testimonials</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        {testimonials.map((item) => (
                            <div
                                key={item.name}
                                className="rounded border border-cream-dark bg-white p-8 transition-shadow duration-300 hover:shadow-md"
                            >
                                <div className="mb-4 text-lg tracking-widest text-gold">★★★★★</div>
                                <p className="mb-5 text-[14px] leading-[1.8] text-ink-soft italic">
                                    "{item.quote}"
                                </p>
                                <span className="text-[13px] font-semibold text-ink">{item.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
