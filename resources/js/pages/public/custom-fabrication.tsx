import { Head, Link } from '@inertiajs/react';
import { ArrowRight, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';

import LandingFooter from '@/components/public/landing/landing-footer';
import LandingNav from '@/components/public/landing/landing-nav';
import Reveal from '@/components/public/landing/reveal';
import ServiceSwitcher from '@/components/public/service-switcher';
import { COMPANY } from '@/data/legal';

const heroImage = '/images/works/work-5.webp';

const pillars = [
    {
        title: 'Designed Around You',
        text: 'Every piece is made to your size, theme, and brand. Nothing is copied from a catalog.',
    },
    {
        title: 'Made by Our Own Team',
        text: 'We design, fabricate, and finish in-house, so what you approve is what gets built.',
    },
    {
        title: 'Installed With Care',
        text: 'The same team that builds your pieces sets them up on site, ready for your event.',
    },
];

const offerings = [
    {
        title: 'Backdrops & Stage Sets',
        text: 'Custom stage backdrops, photo walls, and set pieces built to your theme, size, and venue.',
    },
    {
        title: 'Themed Structures',
        text: 'Arches, tunnels, entrances, and photo-ready installations designed to make a statement.',
    },
    {
        title: 'Lighted Signage & Decals',
        text: 'Lighted logos and monograms, sticker decals, and signage made to your brand or event.',
    },
    {
        title: 'Furniture & Upholstery',
        text: 'Rattan lamps, synthetic rattan and drum furniture, and upholstered pieces made for events and displays.',
    },
    {
        title: 'Giant Fabric & Foam Flowers',
        text: 'Oversized fabric draping and handcrafted foam flowers that turn a space into a showpiece.',
    },
    {
        title: 'Printing & Sublimation',
        text: 'Tarpaulin, sticker prints, and sublimation work produced in the sizes and finishes you need.',
    },
];

const occasions = [
    'Stage backdrops',
    'Photo walls',
    'Mall displays',
    'Brand signage',
    'Event furniture',
    'Booth structures',
    'Store displays',
    'Props & set pieces',
];

type TileSize = 'regular' | 'tall' | 'feature';

const showcase: { image: string; title: string; category: string; size: TileSize }[] = [
    { image: '/images/works/work-11.webp', title: 'Aura Floral Installation', category: 'Giant Floral Fabrication', size: 'feature' },
    { image: '/images/works/work-12.webp', title: 'Printed Media Wall', category: 'Printing & Backdrops', size: 'tall' },
    { image: '/images/works/work-14.webp', title: 'Wellness Place Signage', category: 'Lighted Signage', size: 'regular' },
    { image: '/images/works/work-1.webp', title: 'Light & Greenery Display', category: 'Themed Installation', size: 'regular' },
];

const tileClasses: Record<TileSize, string> = {
    regular: '',
    tall: 'row-span-2',
    feature: 'row-span-2 sm:col-span-2',
};

const steps = [
    { title: 'Consultation', text: 'Share your concept, size, venue, and budget, along with any reference designs you have in mind.' },
    { title: 'Site Visit & Design', text: 'We assess the space, then our designers prepare layouts and design proposals for your review.' },
    { title: 'Approval', text: 'You approve the final design and the contract before anything goes into production.' },
    { title: 'Fabrication', text: 'Our team builds your backdrops, props, furniture, and structures to the approved design.' },
    { title: 'Installation', text: 'Everything is delivered and installed on site, ready for your event.' },
];

const moreServices = [
    {
        title: 'Corporate Events',
        text: 'Professional styling and management for brand activations, mall events, and corporate functions.',
        image: '/images/works/work-3.webp',
        href: '/services/corporate-events',
    },
    {
        title: 'Special Occasions',
        text: 'Creative setups for weddings, birthdays, debuts, and milestone celebrations.',
        image: '/images/works/work-7.webp',
        href: '/services/special-occasions',
    },
];

const primaryButton =
    'group inline-flex items-center justify-center gap-3 rounded-full bg-[#C99A2E] px-8 py-4 text-sm font-bold tracking-[0.14em] text-[#1F2023] uppercase transition-all duration-300 hover:bg-[#F2C75C] hover:shadow-[0_14px_40px_-12px_rgba(242,199,92,0.7)] focus-visible:ring-2 focus-visible:ring-[#F2C75C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F2023] focus-visible:outline-none';

export default function CustomFabrication() {
    const [heroReady, setHeroReady] = useState(false);

    useEffect(() => {
        const id = requestAnimationFrame(() => setHeroReady(true));

        return () => cancelAnimationFrame(id);
    }, []);

    return (
        <div className="min-h-screen bg-[#FBF9F5] font-sans text-black">
            <Head title="Custom Fabrication - Gr3at A's Events Styling & Services">
                <meta
                    name="description"
                    content="Custom backdrops, props, furniture, signage, and themed event structures designed, fabricated, and installed by GR3AT A's Event Styling Services."
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
                {/* HERO: full-bleed, left-aligned, sharp editorial */}
                <section className="relative isolate flex min-h-[640px] items-end overflow-hidden bg-[#1F2023] text-white lg:min-h-[800px]">
                    <img
                        src={heroImage}
                        alt="A custom-built stage backdrop with an illuminated frame and printed scenery"
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
                            <ServiceSwitcher active="custom-fabrication" />
                            <h1 className="font-['DM_Serif_Display',serif] text-[clamp(3rem,8.5vw,6.25rem)] leading-[1.02] font-normal tracking-tight">
                                Custom
                                <br />
                                <span className="text-[#F2C75C]">Fabrication</span>
                            </h1>
                            <p className="mt-6 max-w-xl text-base leading-8 text-white/80 md:text-lg">
                                Design and production of customized backdrops, props, and themed event structures, built exactly to your
                                vision.
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

                {/* INTRO: headline + copy side by side, pillars in a row, wide image banner */}
                <section className="bg-white py-20 lg:py-32">
                    <div className="mx-auto max-w-[1240px] px-5 md:px-8 lg:px-12">
                        <Reveal className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-20">
                            <h2 className="font-['DM_Serif_Display',serif] text-4xl leading-[1.12] font-normal text-[#0D0D33] md:text-5xl lg:text-6xl">
                                Built exactly
                                <br />
                                the way you imagined.
                            </h2>
                            <div>
                                <p className="text-base leading-8 text-neutral-700 md:text-[17px]">
                                    Some ideas can't be bought off a shelf. GR3AT A's designs and builds custom backdrops, props, furniture,
                                    signage, and structures from scratch, then installs them so your concept stands in the room exactly as you
                                    pictured it.
                                </p>
                                <p className="mt-5 text-base leading-8 text-neutral-700 md:text-[17px]">
                                    From a single lighted sign to a full themed set, one team handles the design, the fabrication, and the
                                    installation, so every piece fits together.
                                </p>
                            </div>
                        </Reveal>

                        <dl className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8 lg:mt-20">
                            {pillars.map((pillar, i) => (
                                <Reveal key={pillar.title} delay={i * 90}>
                                    <div className="border-t-2 border-[#C99A2E] pt-6">
                                        <span className="font-['DM_Serif_Display',serif] text-4xl leading-none text-[#C99A2E]">
                                            {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <dt className="mt-5 font-['DM_Serif_Display',serif] text-2xl text-[#0D0D33]">{pillar.title}</dt>
                                        <dd className="mt-3 text-sm leading-7 text-neutral-600">{pillar.text}</dd>
                                    </div>
                                </Reveal>
                            ))}
                        </dl>

                        <Reveal delay={100} className="mt-16 lg:mt-24">
                            <div className="relative">
                                <img
                                    src="/images/works/work-8.webp"
                                    alt="A lighted monogram sign set into a wall of greenery"
                                    loading="lazy"
                                    decoding="async"
                                    className="aspect-[16/9] w-full object-cover shadow-[0_30px_60px_-30px_rgba(31,32,35,0.5)] lg:aspect-[21/9]"
                                />
                                <div className="absolute right-4 -bottom-8 w-[38%] max-w-[300px] sm:right-8 lg:right-12 lg:-bottom-12">
                                    <div
                                        aria-hidden="true"
                                        className="absolute inset-0 -translate-x-3 translate-y-3 border border-[#C99A2E]/80"
                                    />
                                    <img
                                        src="/images/works/work-16.webp"
                                        alt="A mirrored tunnel installation outlined with blue light"
                                        loading="lazy"
                                        decoding="async"
                                        className="relative aspect-[4/3] w-full border-[6px] border-white object-cover shadow-[0_30px_60px_-24px_rgba(31,32,35,0.55)] sm:border-8"
                                    />
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </section>

                {/* OFFERINGS: hairline-bordered grid */}
                <section className="pt-28 pb-20 lg:pt-40 lg:pb-32">
                    <div className="mx-auto max-w-[1240px] px-5 md:px-8 lg:px-12">
                        <Reveal className="mx-auto max-w-2xl text-center">
                            <h2 className="font-['DM_Serif_Display',serif] text-4xl font-normal text-[#0D0D33] md:text-5xl">
                                Everything we make, under one roof
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

                {/* SHOWCASE: dark bento grid with overlay captions */}
                <section className="relative overflow-hidden bg-[#1F2023] py-20 text-white lg:py-32">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-[0.06]"
                        style={{ backgroundImage: 'radial-gradient(#C99A2E 1px, transparent 1px)', backgroundSize: '26px 26px' }}
                    />

                    <div className="relative mx-auto max-w-[1240px] px-5 md:px-8 lg:px-12">
                        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                            <h2 className="font-['DM_Serif_Display',serif] text-4xl font-normal md:text-5xl">
                                Pieces we've built and installed
                            </h2>
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

                {/* PROCESS: heading on the left, vertical timeline on the right */}
                <section className="bg-white py-20 lg:py-32">
                    <div className="mx-auto grid max-w-[1240px] gap-12 px-5 md:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-12">
                        <Reveal>
                            <div className="lg:sticky lg:top-32">
                                <p className="text-xs font-semibold tracking-[0.3em] text-[#C99A2E] uppercase">How It Works</p>
                                <h2 className="mt-6 font-['DM_Serif_Display',serif] text-4xl font-normal text-[#0D0D33] md:text-5xl">
                                    From first sketch
                                    <br />
                                    <span className="italic">to finished piece</span>
                                </h2>
                            </div>
                        </Reveal>

                        <ol className="relative space-y-10 before:absolute before:top-2 before:bottom-2 before:left-[1.4rem] before:w-px before:bg-gradient-to-b before:from-[#C99A2E] before:to-[#C99A2E]/10">
                            {steps.map((step, i) => (
                                <li key={step.title}>
                                    <Reveal delay={i * 80} className="relative flex gap-6">
                                        <span className="relative z-10 flex h-[2.8rem] w-[2.8rem] shrink-0 items-center justify-center rounded-full border border-[#C99A2E] bg-[#FBF9F5] font-['DM_Serif_Display',serif] text-lg text-[#A97E1F]">
                                            {i + 1}
                                        </span>
                                        <div className="pt-1.5">
                                            <h3 className="font-['DM_Serif_Display',serif] text-xl font-normal text-[#0D0D33] md:text-2xl">
                                                {step.title}
                                            </h3>
                                            <p className="mt-2 max-w-lg text-sm leading-7 text-neutral-600">{step.text}</p>
                                        </div>
                                    </Reveal>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* CTA: full-bleed gold */}
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
                            Have something in mind to build?
                        </h2>
                        <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-[#1F2023]/80 md:text-lg">
                            Share your idea, your size, and your venue. We'll help turn it into something real.
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

                {/* OTHER SERVICES */}
                <section className="py-20 lg:py-28">
                    <div className="mx-auto max-w-[1240px] px-5 md:px-8 lg:px-12">
                        <Reveal>
                            <h2 className="font-['DM_Serif_Display',serif] text-3xl font-normal text-[#0D0D33] md:text-4xl">
                                Explore our other services
                            </h2>
                        </Reveal>

                        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:mt-14 lg:gap-8">
                            {moreServices.map((service, i) => (
                                <Reveal key={service.title} delay={i * 100}>
                                    <Link
                                        href={service.href}
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
                                    </Link>
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
