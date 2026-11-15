import { Head } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

import LandingFooter from '@/components/public/landing/landing-footer';
import LandingNav from '@/components/public/landing/landing-nav';

type TileSize = 'regular' | 'wide' | 'tall' | 'feature';

type Project = {
    image: string;
    title: string;
    category: string;
    size: TileSize;
};

const projects: Project[] = [
    { image: '/images/works/work-7.webp', title: 'A Night in Paris', category: 'Themed Event', size: 'feature' },
    { image: '/images/works/work-8.webp', title: 'Garden Signage', category: 'Custom Fabrication', size: 'tall' },
    { image: '/images/works/work-11.webp', title: 'A Celebration in Bloom', category: 'Event Styling', size: 'regular' },
    { image: '/images/works/work-14.webp', title: 'Wellness Place', category: 'Mall Activation', size: 'regular' },
    { image: '/images/works/work-4.webp', title: 'Corporate Launch', category: 'Corporate Event', size: 'wide' },
    { image: '/images/works/work-18.webp', title: 'Holiday Installation', category: 'Mall Activation', size: 'tall' },
    { image: '/images/works/work-6.webp', title: 'Golden Moments', category: 'Wedding Styling', size: 'regular' },
    { image: '/images/works/work-9.webp', title: 'Hanging Gardens', category: 'Event Styling', size: 'wide' },
    { image: '/images/works/work-19.webp', title: 'Paper Blooms', category: 'Mall Activation', size: 'regular' },
    { image: '/images/works/work-15.webp', title: 'Wedding of Joy & Jordan', category: 'Wedding Styling', size: 'tall' },
    { image: '/images/works/work-2.webp', title: 'Gala Night', category: 'Corporate Event', size: 'feature' },
    { image: '/images/works/work-16.webp', title: 'The Mirror Arch', category: 'Custom Fabrication', size: 'tall' },
];

const sizeClasses: Record<TileSize, string> = {
    regular: '',
    wide: 'sm:col-span-2',
    tall: 'row-span-2',
    feature: 'row-span-2 sm:col-span-2',
};

function ProjectTile({ project }: { project: Project }) {
    return (
        <figure
            tabIndex={0}
            className={`group relative isolate overflow-hidden bg-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-[#C99A2E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF9F5] ${sizeClasses[project.size]}`}
        >
            <img
                src={project.image}
                alt={`${project.title} - ${project.category}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04] group-focus-visible:scale-[1.04]"
            />

            <figcaption className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/15 to-transparent p-5 text-white opacity-100 transition-opacity duration-500 ease-out sm:p-6 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
                <span className="text-[10px] font-semibold tracking-[0.2em] text-[#F2C75C] uppercase">
                    {project.category}
                </span>
                <span className="mt-1 font-['DM_Serif_Display',serif] text-lg leading-snug font-normal tracking-wide sm:text-xl">
                    {project.title}
                </span>
            </figcaption>
        </figure>
    );
}

export default function OurWorks() {
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
                <a
                    href="/"
                    className="relative z-10 inline-flex items-center gap-4 text-sm font-semibold text-black transition-colors hover:text-[#C99A2E]"
                >
                    <svg viewBox="0 0 28 8" className="w-7" fill="none" stroke="currentColor" strokeWidth="0.8" aria-hidden="true">
                        <path d="M27.5 4H1M4.5 0.8 1 4l3.5 3.2" />
                    </svg>
                    Back
                </a>

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

                <div className="grid auto-rows-[170px] grid-flow-dense grid-cols-1 gap-3 sm:auto-rows-[190px] sm:grid-cols-2 sm:gap-4 lg:auto-rows-[190px] lg:grid-cols-4 lg:gap-5">
                    {projects.map((project) => (
                        <ProjectTile key={project.title} project={project} />
                    ))}
                </div>
            </main>

            <LandingFooter />
        </div>
    );
}