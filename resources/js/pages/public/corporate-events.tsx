import { Head, Link } from '@inertiajs/react';
import { ArrowRight, Phone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import LandingFooter from '@/components/public/landing/landing-footer';
import LandingNav from '@/components/public/landing/landing-nav';
import { COMPANY } from '@/data/legal';

const heroImage = '/images/works/work-20.webp';

const pillars = [
    {
        title: 'Tailored to Your Brand',
        text: 'No templates. Every setup starts from your brand guidelines, audience, and the message you want guests to remember.',
    },
    {
        title: 'Made by Our Own Hands',
        text: 'Custom structures, signage, and printing are produced for you, so what you approved is exactly what gets installed.',
    },
    {
        title: 'Managed End to End',
        text: 'We style, install, supervise on the day, and tear down, so your team can focus on your guests.',
    },
];

const offerings = [
    {
        title: 'Brand Activations & Booths',
        text: 'Eye-catching booths, kiosks, and interactive set-ups that draw crowds and carry your message.',
    },
    {
        title: 'Product Launches',
        text: 'Stage, backdrop, and entrance styling that gives every reveal the spotlight it deserves.',
    },
    {
        title: 'Mall & Venue Events',
        text: 'Promotional displays and seasonal installations designed to fit atriums, lobbies, and function halls.',
    },
    {
        title: 'Galas & Corporate Dinners',
        text: 'Refined table styling, lighting, and grand entrances for anniversaries, awards nights, and year-end celebrations.',
    },
    {
        title: 'Media Walls & Signage',
        text: 'Step-and-repeat backdrops, custom signage, and printed collaterals produced to your brand standards.',
    },
    {
        title: 'Greenery & Floral Styling',
        text: 'Living walls, hanging gardens, and floral installations that add warmth and polish to any corporate space.',
    },
];

const occasions = [
    'Product launches',
    'Brand activations',
    'Mall promotions',
    'Company anniversaries',
    'Awards & gala nights',
    'Conferences & seminars',
    'Trade shows & expos',
    'Year-end parties',
];

type TileSize = 'regular' | 'tall' | 'feature';

const showcase: { image: string; title: string; category: string; size: TileSize }[] = [
    { image: '/images/works/work-15.webp', title: 'The Grand Entrance', category: 'Gala & Dinner Styling', size: 'feature' },
    { image: '/images/works/work-12.webp', title: 'Sponsor Media Wall', category: 'Step-and-Repeat Backdrop', size: 'tall' },
    { image: '/images/works/work-17.webp', title: 'Interactive Brand Booth', category: 'Brand Activation', size: 'regular' },
    { image: '/images/works/work-10.webp', title: 'Themed Corporate Night', category: 'Stage & Set Design', size: 'regular' },
];

const tileClasses: Record<TileSize, string> = {
    regular: '',
    tall: 'row-span-2',
    feature: 'row-span-2 sm:col-span-2',
};

const steps = [
    { title: 'Consultation', text: 'We learn about your brand, goals, venue, guest count, and budget.' },
    { title: 'Concept & Design', text: 'Mood boards and layouts are prepared for your review and approval.' },
    { title: 'Production', text: 'Structures, props, signage, and prints are fabricated to the approved design.' },
    { title: 'Installation', text: 'Our crew sets up and styles the space within your venue schedule.' },
    { title: 'On-site & Teardown', text: 'We supervise during the event, then clear everything afterward.' },
];

const moreServices = [
    {
        title: 'Special Occasions',
        text: 'Creative setups for weddings, birthdays, debuts, and milestone celebrations.',
        image: '/images/works/work-7.webp',
    },
    {
        title: 'Custom Fabrication',
        text: 'Design and production of customized backdrops, props, and themed event structures.',
        image: '/images/works/work-8.webp',
    },
];

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setShown(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setShown(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
        );

        observer.observe(el);

        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            style={{ transitionDelay: `${delay}ms` }}
            className={`transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${
                shown ? 'translate-y-0 opacity-100' : 'translate-y-7 opacity-0'
            } ${className}`}
        >
            {children}
        </div>
    );
}

const primaryButton =
    'group inline-flex items-center justify-center gap-3 rounded-full bg-[#C99A2E] px-8 py-4 text-sm font-bold tracking-[0.14em] text-[#1F2023] uppercase transition-all duration-300 hover:bg-[#F2C75C] hover:shadow-[0_14px_40px_-12px_rgba(242,199,92,0.7)] focus-visible:ring-2 focus-visible:ring-[#F2C75C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F2023] focus-visible:outline-none';

export default function CorporateEvents() {
    const [heroReady, setHeroReady] = useState(false);

    useEffect(() => {
        const id = requestAnimationFrame(() => setHeroReady(true));

        return () => cancelAnimationFrame(id);
    }, []);

    return (
        <div className="min-h-screen bg-[#FBF9F5] font-sans text-black">
            <Head title="Corporate Events - Gr3at A's Events Styling & Services">
                <meta
                    name="description"
                    content="Corporate event styling and management in the Philippines: brand activations, product launches, galas, and mall events by GR3AT A's Event Styling Services."
                />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Montserrat:wght@600;700;800&display=swap"
                />
            </Head>

            <LandingNav isHome={false} loginStyle="gold" />

            <main>
                <section className="relative isolate flex min-h-[640px] items-end overflow-hidden bg-[#1F2023] text-white lg:min-h-[800px]">
                    <img
                        src={heroImage}
                        alt="A corporate gala hall styled with dramatic lighting and a red carpet entrance"
                        className={`absolute inset-0 -z-20 h-full w-full object-cover transition-transform duration-[2800ms] ease-out motion-reduce:transition-none ${
                            heroReady ? 'scale-100' : 'scale-[1.08]'
                        }`}
                    />
                    <div
                        aria-hidden="true"
                        className="absolute inset-0 -z-10 bg-gradient-to-t from-[#1F2023] via-[#1F2023]/70 to-[#1F2023]/35"
                    />
                    <div
                        aria-hidden="true"
                        className="absolute inset-0 -z-10 bg-gradient-to-r from-[#1F2023]/85 via-[#1F2023]/30 to-transparent"
                    />

                    <div className="mx-auto w-full max-w-[1240px] px-5 pt-36 pb-16 md:px-8 lg:px-12 lg:pb-24">
                        <div className="max-w-3xl">
                            <h1 className="font-['DM_Serif_Display',serif] text-[clamp(3rem,8.5vw,6.25rem)] leading-[1.02] font-normal tracking-tight">
                                Corporate
                                <br />
                                <span className="text-[#F2C75C]">Events</span>
                            </h1>
                            <p className="mt-6 max-w-xl text-base leading-8 text-white/80 md:text-lg">
                                Professional styling and management for brand activations, mall events, and corporate functions, designed to
                                make your brand unforgettable.
                            </p>

                            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                                <a href="/customer/new-request" className={primaryButton}>
                                    Start Your Project
                                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                                </a>
                                <Link
                                    href="/our-works"
                                    className="inline-flex items-center justify-center rounded-full border border-white/40 px-8 py-4 text-sm font-bold tracking-[0.14em] text-white uppercase transition-colors duration-300 hover:border-[#F2C75C] hover:text-[#F2C75C] focus-visible:ring-2 focus-visible:ring-[#F2C75C] focus-visible:outline-none"
                                >
                                    View Our Works
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="bg-white py-20 lg:py-32">
                    <div className="mx-auto grid max-w-[1240px] items-center gap-16 px-5 md:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-20 lg:px-12">
                        <Reveal>
                            <h2 className="font-['DM_Serif_Display',serif] text-4xl leading-[1.12] font-normal text-[#0D0D33] md:text-5xl">
                                Where your brand
                                <br />
                                takes the stage.
                            </h2>
                            <p className="mt-8 text-base leading-8 text-neutral-700 md:text-[17px]">
                                A corporate event is more than a venue and a program. It is the moment your clients, partners, and guests
                                experience your brand in person. GR3AT A's turns that moment into a polished, cohesive setting that looks
                                exactly the way your company wants to be remembered.
                            </p>
                            <p className="mt-5 text-base leading-8 text-neutral-700 md:text-[17px]">
                                From a single booth to a full gala night, we handle the styling, the build, and the on-site management, so
                                every detail works together.
                            </p>

                            <dl className="mt-12 space-y-8 border-t border-neutral-200 pt-10">
                                {pillars.map((pillar, i) => (
                                    <div key={pillar.title} className="grid grid-cols-[3rem_1fr] gap-x-4">
                                        <span className="font-['DM_Serif_Display',serif] text-3xl leading-none text-[#C99A2E]">
                                            {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <div>
                                            <dt className="font-['DM_Serif_Display',serif] text-xl text-[#0D0D33]">{pillar.title}</dt>
                                            <dd className="mt-2 text-sm leading-7 text-neutral-600">{pillar.text}</dd>
                                        </div>
                                    </div>
                                ))}
                            </dl>
                        </Reveal>

                        <Reveal delay={150}>
                            <div className="relative mx-auto w-full max-w-[600px] pb-20 lg:mx-0 lg:ml-auto">
                                <div className="relative ml-auto w-[88%]">
                                    <div
                                        aria-hidden="true"
                                        className="absolute inset-0 translate-x-4 translate-y-4 border border-[#C99A2E]/70"
                                    />
                                    <img
                                        src="/images/works/work-4.webp"
                                        alt="Corporate launch booth with branded backdrop and reception counter"
                                        loading="lazy"
                                        decoding="async"
                                        className="relative aspect-[4/5] w-full object-cover shadow-[0_30px_60px_-30px_rgba(31,32,35,0.5)]"
                                    />
                                </div>
                                <img
                                    src="/images/works/work-3.webp"
                                    alt="Exhibit booth with branded displays and a custom reception desk"
                                    loading="lazy"
                                    decoding="async"
                                    className="absolute bottom-0 left-0 aspect-square w-[50%] border-[10px] border-white object-cover shadow-[0_30px_60px_-24px_rgba(31,32,35,0.55)]"
                                />
                            </div>
                        </Reveal>
                    </div>
                </section>

                <section className="py-20 lg:py-32">
                    <div className="mx-auto max-w-[1240px] px-5 md:px-8 lg:px-12">
                        <Reveal className="mx-auto max-w-2xl text-center">
                            <h2 className="font-['DM_Serif_Display',serif] text-4xl font-normal text-[#0D0D33] md:text-5xl">
                                Everything your event needs, under one roof
                            </h2>
                        </Reveal>

                        <div className="mt-14 grid gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3">
                            {offerings.map(({ title, text }, i) => (
                                <Reveal key={title} delay={(i % 3) * 90} className="bg-white">
                                    <article className="group relative h-full p-8 lg:p-10">
                                        <span
                                            aria-hidden="true"
                                            className="pointer-events-none absolute inset-0 border border-transparent transition-colors duration-300 group-hover:border-[#C99A2E]"
                                        />
                                        <h3 className="font-['DM_Serif_Display',serif] text-2xl font-normal text-[#0D0D33]">{title}</h3>
                                        <p className="mt-4 text-sm leading-7 text-neutral-600">{text}</p>
                                    </article>
                                </Reveal>
                            ))}
                        </div>

                        <Reveal className="mt-16 text-center lg:mt-20">
                            <p className="text-xs font-semibold tracking-[0.3em] text-neutral-500 uppercase">Perfect for</p>
                            <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-3">
                                {occasions.map((occasion) => (
                                    <li
                                        key={occasion}
                                        className="border border-[#C99A2E]/50 bg-white px-5 py-2.5 text-sm text-[#0D0D33] transition-colors duration-300 hover:border-[#C99A2E] hover:bg-[#C99A2E] hover:text-[#1F2023]"
                                    >
                                        {occasion}
                                    </li>
                                ))}
                            </ul>
                        </Reveal>
                    </div>
                </section>

                <section className="relative overflow-hidden bg-[#1F2023] py-20 text-white lg:py-32">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-[0.06]"
                        style={{ backgroundImage: 'radial-gradient(#C99A2E 1px, transparent 1px)', backgroundSize: '26px 26px' }}
                    />

                    <div className="relative mx-auto max-w-[1240px] px-5 md:px-8 lg:px-12">
                        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h2 className="font-['DM_Serif_Display',serif] text-4xl font-normal md:text-5xl">
                                    Corporate moments we've brought to life
                                </h2>
                            </div>
                            <Link
                                href="/our-works"
                                className="group inline-flex shrink-0 items-center gap-4 text-sm font-semibold text-[#F2C75C] transition-colors hover:text-white"
                            >
                                See all works
                                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>
                        </Reveal>

                        <Reveal delay={100} className="mt-12 lg:mt-16">
                            <div className="grid auto-rows-[220px] grid-flow-dense grid-cols-1 gap-3 sm:auto-rows-[200px] sm:grid-cols-2 sm:gap-4 lg:auto-rows-[210px] lg:grid-cols-4 lg:gap-5">
                                {showcase.map((tile) => (
                                    <figure
                                        key={tile.title}
                                        tabIndex={0}
                                        className={`group relative isolate overflow-hidden bg-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-[#F2C75C] ${tileClasses[tile.size]}`}
                                    >
                                        <img
                                            src={tile.image}
                                            alt={`${tile.title} - ${tile.category}`}
                                            loading="lazy"
                                            decoding="async"
                                            className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.05] group-focus-visible:scale-[1.05]"
                                        />
                                        <figcaption className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/10 to-transparent p-5 sm:p-6">
                                            <span className="text-[10px] font-semibold tracking-[0.2em] text-[#F2C75C] uppercase">
                                                {tile.category}
                                            </span>
                                            <span className="mt-1 font-['DM_Serif_Display',serif] text-lg leading-snug sm:text-xl">
                                                {tile.title}
                                            </span>
                                        </figcaption>
                                    </figure>
                                ))}
                            </div>
                        </Reveal>
                    </div>
                </section>

                <section className="bg-white py-20 lg:py-32">
                    <div className="mx-auto max-w-[1240px] px-5 md:px-8 lg:px-12">
                        <Reveal className="mx-auto max-w-2xl text-center">
                            <p className="text-xs font-semibold tracking-[0.3em] text-[#C99A2E] uppercase">How It Works</p>
                            <h2 className="mt-6 font-['DM_Serif_Display',serif] text-4xl font-normal text-[#0D0D33] md:text-5xl">
                                A clear path from brief to big day
                            </h2>
                        </Reveal>

                        <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:mt-20 lg:grid-cols-5 lg:gap-6">
                            {steps.map((step, i) => (
                                <li key={step.title}>
                                    <Reveal delay={i * 90}>
                                        <div className="relative flex items-center">
                                            <span className="font-['DM_Serif_Display',serif] text-5xl leading-none text-[#C99A2E]">
                                                {String(i + 1).padStart(2, '0')}
                                            </span>
                                            <span
                                                aria-hidden="true"
                                                className={`ml-5 h-px flex-1 bg-gradient-to-r from-[#C99A2E] to-[#C99A2E]/10 ${
                                                    i === steps.length - 1 ? 'lg:hidden' : ''
                                                }`}
                                            />
                                        </div>
                                        <h3 className="mt-6 font-['DM_Serif_Display',serif] text-xl font-normal text-[#0D0D33]">
                                            {step.title}
                                        </h3>
                                        <p className="mt-3 text-sm leading-7 text-neutral-600">{step.text}</p>
                                    </Reveal>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                <section className="relative isolate overflow-hidden bg-[#C99A2E] py-20 lg:py-28">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-[#E0B24A] via-[#C99A2E] to-[#A97E1F]"
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12]"
                        style={{ backgroundImage: 'radial-gradient(#1F2023 1px, transparent 1px)', backgroundSize: '22px 22px' }}
                    />

                    <Reveal className="mx-auto max-w-[1240px] px-5 text-center md:px-8 lg:px-12">
                        <p className="text-xs font-semibold tracking-[0.3em] text-[#1F2023]/70 uppercase">Let's work together</p>
                        <h2 className="mx-auto mt-5 max-w-3xl font-['DM_Serif_Display',serif] text-4xl leading-[1.12] font-normal text-[#1F2023] md:text-6xl">
                            Planning your next corporate event?
                        </h2>
                        <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-[#1F2023]/80 md:text-lg">
                            Tell us about your brand, your venue, and your date. We'll help you shape the rest.
                        </p>

                        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                            <a
                                href="/customer/new-request"
                                className="group inline-flex items-center justify-center gap-3 rounded-full bg-[#1F2023] px-9 py-4 text-sm font-bold tracking-[0.14em] text-white uppercase transition-all duration-300 hover:bg-black hover:shadow-[0_16px_40px_-14px_rgba(0,0,0,0.6)] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#C99A2E] focus-visible:outline-none"
                            >
                                Start Your Project
                                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                            </a>
                            <a
                                href={`tel:${COMPANY.phone}`}
                                className="inline-flex items-center justify-center gap-3 rounded-full border border-[#1F2023]/60 px-9 py-4 text-sm font-bold tracking-[0.14em] text-[#1F2023] uppercase transition-colors duration-300 hover:bg-[#1F2023] hover:text-white focus-visible:ring-2 focus-visible:ring-[#1F2023] focus-visible:outline-none"
                            >
                                <Phone className="h-4 w-4" />
                                {COMPANY.phone}
                            </a>
                        </div>
                    </Reveal>
                </section>

                <section className="py-20 lg:py-28">
                    <div className="mx-auto max-w-[1240px] px-5 md:px-8 lg:px-12">
                        <Reveal className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h2 className="font-['DM_Serif_Display',serif] text-3xl font-normal text-[#0D0D33] md:text-4xl">
                                    Explore our other services
                                </h2>
                            </div>
                        </Reveal>

                        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:mt-14 lg:gap-8">
                            {moreServices.map((service, i) => (
                                <Reveal key={service.title} delay={i * 100}>
                                    <a
                                        href="/#services"
                                        className="group relative isolate block aspect-[16/10] overflow-hidden bg-neutral-800 focus-visible:ring-2 focus-visible:ring-[#C99A2E] focus-visible:ring-offset-2 focus-visible:outline-none"
                                    >
                                        <img
                                            src={service.image}
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                            className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.05]"
                                        />
                                        <div
                                            aria-hidden="true"
                                            className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
                                        />
                                        <div className="flex h-full flex-col justify-end p-6 text-white sm:p-8">
                                            <h3 className="font-['DM_Serif_Display',serif] text-2xl font-normal sm:text-3xl">
                                                {service.title}
                                            </h3>
                                            <p className="mt-2 max-w-md text-sm leading-6 text-white/75">{service.text}</p>
                                            <span className="mt-5 inline-flex items-center gap-3 text-sm text-[#F2C75C]">
                                                Learn more
                                                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                                            </span>
                                        </div>
                                    </a>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            <LandingFooter />
        </div>
    );
}