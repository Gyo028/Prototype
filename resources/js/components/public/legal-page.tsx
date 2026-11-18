import { Head, Link } from '@inertiajs/react';
import { ArrowRight, ArrowUp, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';

import LegalBlocks from '@/components/legal/legal-blocks';
import LandingFooter from '@/components/public/landing/landing-footer';
import LandingNav from '@/components/public/landing/landing-nav';
import { privacyPolicy, termsAndConditions } from '@/data/legal';
import type { LegalDocument } from '@/data/legal';

const sectionId = (index: number) => `section-${index + 1}`;

export default function LegalPage({ doc }: { doc: LegalDocument }) {
    const [active, setActive] = useState(sectionId(0));
    const [showTop, setShowTop] = useState(false);

    const isTerms = doc.slug === 'terms';
    const other = isTerms ? privacyPolicy : termsAndConditions;

    // Highlight the section currently being read in the contents list.
    useEffect(() => {
        const targets = doc.sections.map((_, i) => document.getElementById(sectionId(i))).filter(Boolean) as HTMLElement[];

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActive(visible[0].target.id);
            },
            { rootMargin: '-110px 0px -65% 0px', threshold: 0 },
        );

        targets.forEach((t) => observer.observe(t));
        const onScroll = () => setShowTop(window.scrollY > 700);
        window.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', onScroll);
        };
    }, [doc]);

    return (
        <div className="min-h-screen bg-[#FBF9F5] font-sans text-black">
            <Head title={`${doc.shortTitle} - GR3AT A's Event Styling Services`} />

            <LandingNav isHome={false} loginStyle="gold" />

            {/* Hero banner */}
            <section className="relative overflow-hidden bg-[#1F2023] pt-28 pb-10 lg:pt-36 lg:pb-14">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-[0.07]"
                    style={{ backgroundImage: 'radial-gradient(#C99A2E 1px, transparent 1px)', backgroundSize: '26px 26px' }}
                />
                <div aria-hidden="true" className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-[#C99A2E]/20 blur-3xl" />

                <div className="relative mx-auto max-w-[1240px] px-5 md:px-8 lg:px-12">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-4 text-sm font-semibold text-white transition-colors hover:text-[#F2C75C]"
                    >
                        <svg viewBox="0 0 28 8" className="w-7" fill="none" stroke="currentColor" strokeWidth="0.8" aria-hidden="true">
                            <path d="M27.5 4H1M4.5 0.8 1 4l3.5 3.2" />
                        </svg>
                        Home
                    </Link>

                    <h1 className="mt-8 font-['DM_Serif_Display',serif] text-4xl leading-tight tracking-wide text-white sm:text-5xl lg:text-6xl">
                        {doc.title}
                    </h1>
                </div>
            </section>

            {/* Body */}
            <main className="mx-auto grid max-w-[1240px] gap-10 px-5 py-12 md:px-8 lg:grid-cols-[280px_1fr] lg:gap-14 lg:px-12 lg:py-20">
                {/* Contents */}
                <aside className="hidden lg:block">
                    <div className="sticky top-28">
                        <p className="text-xs font-semibold tracking-[0.3em] text-[#C99A2E] uppercase">Contents</p>
                        <ol className="mt-5 max-h-[calc(100vh-14rem)] space-y-1 overflow-y-auto border-l border-neutral-200 pr-2">
                            {doc.sections.map((section, i) => {
                                const id = sectionId(i);
                                const isActive = active === id;

                                return (
                                    <li key={id}>
                                        <a
                                            href={`#${id}`}
                                            onClick={() => setActive(id)}
                                            className={`-ml-px flex gap-3 border-l-2 py-1.5 pl-4 text-sm leading-5 transition-colors ${
                                                isActive
                                                    ? 'border-[#C99A2E] font-semibold text-neutral-900'
                                                    : 'border-transparent text-neutral-500 hover:text-neutral-900'
                                            }`}
                                        >
                                            <span className={isActive ? 'text-[#C99A2E]' : 'text-neutral-400'}>
                                                {String(i + 1).padStart(2, '0')}
                                            </span>
                                            <span>{section.title}</span>
                                        </a>
                                    </li>
                                );
                            })}
                        </ol>

                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neutral-600 transition-colors hover:text-[#8B6914] print:hidden"
                        >
                            <Printer className="h-4 w-4" />
                            Print this page
                        </button>
                    </div>
                </aside>

                {/* Document */}
                <article className="min-w-0">
                    <div className="border border-neutral-200 bg-white px-6 py-10 shadow-[0_20px_60px_-30px_rgba(31,32,35,0.25)] sm:px-10 lg:px-14 lg:py-14">
                        {doc.intro.map((text, i) => (
                            <p
                                key={i}
                                className="border-l-2 border-[#C99A2E] pl-5 text-base leading-8 text-neutral-700 italic sm:text-lg"
                            >
                                {text}
                            </p>
                        ))}

                        <div className="mt-12 space-y-14">
                            {doc.sections.map((section, i) => (
                                <section key={section.title} id={sectionId(i)} className="scroll-mt-28">
                                    <header className="mb-6 flex items-baseline gap-4 border-b border-neutral-200 pb-4">
                                        <span className="font-['DM_Serif_Display',serif] text-3xl text-[#C99A2E]">
                                            {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <h2 className="font-['DM_Serif_Display',serif] text-2xl text-neutral-900 sm:text-3xl">
                                            {section.title}
                                        </h2>
                                    </header>
                                    <LegalBlocks blocks={section.blocks} size="page" />
                                </section>
                            ))}
                        </div>

                        <p className="mt-16 border-t border-neutral-200 pt-8 text-center text-sm leading-7 text-neutral-500 italic">
                            {doc.closing}
                        </p>
                    </div>

                    {/* Cross-link to the other document */}
                    <Link
                        href={`/${other.slug}`}
                        className="group mt-8 flex items-center justify-between gap-6 bg-[#1F2023] px-8 py-7 text-white transition-shadow hover:shadow-[0_18px_50px_-20px_rgba(201,154,46,0.6)] print:hidden"
                    >
                        <span>
                            <span className="block text-xs font-semibold tracking-[0.3em] text-[#C99A2E] uppercase">Also read</span>
                            <span className="mt-1 block font-['DM_Serif_Display',serif] text-2xl">{other.title}</span>
                        </span>
                        <ArrowRight className="h-6 w-6 text-[#F2C75C] transition-transform group-hover:translate-x-1" />
                    </Link>
                </article>
            </main>

            <button
                type="button"
                aria-label="Back to top"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className={`fixed right-6 bottom-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#C99A2E] text-[#1F2023] shadow-lg transition-all duration-300 hover:bg-[#D8AB3E] print:hidden ${
                    showTop ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
                }`}
            >
                <ArrowUp className="h-5 w-5" />
            </button>

            <LandingFooter />
        </div>
    );
}
