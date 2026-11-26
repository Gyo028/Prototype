import { Head } from '@inertiajs/react';
import { useState } from 'react';

import LandingFooter from '@/components/public/landing/landing-footer';
import LandingNav from '@/components/public/landing/landing-nav';
import type { WorkPhoto } from '@/lib/public-site';

type Category = { value: string; label: string };

type TileSize = 'regular' | 'wide' | 'tall' | 'feature';

/** Fixed tile pattern, repeated every 12 photos, so the grid stays balanced whatever the admin uploads. */
const PATTERN: TileSize[] = ['feature', 'tall', 'regular', 'regular', 'wide', 'tall', 'regular', 'wide', 'regular', 'tall', 'feature', 'tall'];

const PAGE_SIZE = 12;

const sizeClasses: Record<TileSize, string> = {
    regular: '',
    wide: 'sm:col-span-2',
    tall: 'row-span-2',
    feature: 'row-span-2 sm:col-span-2',
};

function ProjectTile({ project, size }: { project: WorkPhoto; size: TileSize }) {
    return (
        <figure
            tabIndex={0}
            className={`group relative isolate overflow-hidden bg-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-[#C99A2E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF9F5] ${sizeClasses[size]}`}
        >
            <img
                src={project.url}
                alt={project.alt}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04] group-focus-visible:scale-[1.04]"
            />

            <figcaption className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/15 to-transparent p-5 text-white opacity-100 transition-opacity duration-500 ease-out sm:p-6 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
                <span className="text-[10px] font-semibold tracking-[0.2em] text-[#F2C75C] uppercase">
                    {project.categoryLabel}
                </span>
                <span className="mt-1 font-['DM_Serif_Display',serif] text-lg leading-snug font-normal tracking-wide sm:text-xl">
                    {project.title}
                </span>
            </figcaption>
        </figure>
    );
}

/** Every shown photo of the Our Works library (Technical Admin > Website Content > Our Works). */
export default function OurWorks({ works, categories }: { works: WorkPhoto[]; categories: Category[] }) {
    const [category, setCategory] = useState('all');
    const [shown, setShown] = useState(PAGE_SIZE);

    const filtered = category === 'all' ? works : works.filter((w) => w.category === category);
    const visible = filtered.slice(0, shown);
    const chips: Category[] = [{ value: 'all', label: 'All' }, ...categories.filter((c) => works.some((w) => w.category === c.value))];

    return (
        <div className="min-h-screen bg-[#FBF9F5] font-sans text-black">
            <Head title="Our Works - Gr3at A's Events Styling & Services">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Montserrat:wght@600;700;800&display=swap"
                />
            </Head>

            <LandingNav isHome={false} loginStyle="gold" />

            <main className="mx-auto max-w-[1240px] px-5 pt-28 pb-20 md:px-8 lg:px-12 lg:pt-36 lg:pb-28">

                <header className="mt-4 mb-10 overflow-x-clip text-center [container-type:inline-size] lg:mb-14">
                    <span
                        aria-hidden="true"
                        className="pointer-events-none block font-['DM_Serif_Display',serif] text-[clamp(2.5rem,16cqw,12rem)] leading-[0.9] font-normal whitespace-nowrap text-[#F3E8D2] select-none"
                    >
                        OUR WORKS
                    </span>

                    <div className="relative -mt-[7cqw] px-2">
                        <h1 className="font-['DM_Serif_Display',serif] text-[clamp(1.75rem,5.5cqw,3.5rem)] leading-none font-normal text-[#0D0D33]">
                            OUR WORKS
                        </h1>
                        <p className="mx-auto mt-2 max-w-[32ch] font-['DM_Serif_Display',serif] text-[clamp(0.8rem,1.4cqw,1rem)] leading-snug text-balance text-[#0D0D33] sm:mt-3 sm:max-w-none">
                            A collection of moments, spaces, and celebrations we've brought to life.
                        </p>
                    </div>
                </header>

                {chips.length > 2 && (
                    <div role="group" aria-label="Filter by category" className="mb-8 flex flex-wrap justify-center gap-2 lg:mb-10">
                        {chips.map((chip) => (
                            <button
                                key={chip.value}
                                type="button"
                                aria-pressed={category === chip.value}
                                onClick={() => {
                                    setCategory(chip.value);
                                    setShown(PAGE_SIZE);
                                }}
                                className={`rounded-full border px-5 py-2 text-xs font-semibold tracking-[0.12em] uppercase transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#C99A2E] focus-visible:ring-offset-2 focus-visible:outline-none ${
                                    category === chip.value
                                        ? 'border-[#0D0D33] bg-[#0D0D33] text-white'
                                        : 'border-[#0D0D33]/25 text-[#0D0D33] hover:border-[#C99A2E] hover:text-[#C99A2E]'
                                }`}
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className="grid auto-rows-[170px] grid-flow-dense grid-cols-1 gap-3 sm:auto-rows-[190px] sm:grid-cols-2 sm:gap-4 lg:auto-rows-[190px] lg:grid-cols-4 lg:gap-5">
                    {visible.map((project, i) => (
                        <ProjectTile key={project.id} project={project} size={PATTERN[i % PATTERN.length]} />
                    ))}
                </div>

                {filtered.length === 0 && <p className="py-16 text-center text-neutral-500">No photos in this category yet.</p>}

                {shown < filtered.length && (
                    <div className="mt-10 text-center lg:mt-14">
                        <button
                            type="button"
                            onClick={() => setShown(shown + PAGE_SIZE)}
                            className="inline-flex items-center justify-center rounded-full border border-[#0D0D33] px-9 py-3.5 text-sm font-bold tracking-[0.14em] text-[#0D0D33] uppercase transition-colors duration-300 hover:bg-[#0D0D33] hover:text-white focus-visible:ring-2 focus-visible:ring-[#C99A2E] focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                            Load more
                        </button>
                    </div>
                )}
            </main>

            <LandingFooter />
        </div>
    );
}