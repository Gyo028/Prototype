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

// Sample photos, titles and categories. Replace them with the real projects later.
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

// How much of the grid each tile covers. Column spans only start at tablet size,
// so the one-column phone layout never creates extra columns.
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
            className={`group relative isolate overflow-hidden rounded-2xl bg-neutral-200 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#C99A2E] ${sizeClasses[project.size]}`}
        >
            <img
                src={project.image}
                alt={`${project.title} - ${project.category}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 group-focus-visible:scale-105"
            />

            {/* Dark gradient + title. Always visible on touch screens; fades in on hover with a mouse. */}
            <figcaption className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/25 to-transparent p-5 text-white opacity-100 transition-opacity duration-500 ease-out sm:p-6 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
                <span className="text-[11px] font-semibold tracking-[0.22em] text-[#F2C75C] uppercase">
                    {project.category}
                </span>
                <span className="mt-1 text-lg leading-snug font-semibold sm:text-xl">{project.title}</span>
            </figcaption>
        </figure>
    );
}

export default function OurWorks() {
    return (
        <div className="min-h-screen bg-[#FBF9F5] font-sans text-black [&_h1]:font-heading">
            <Head title="Our Works - Gr3at A's Events Styling & Services">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Montserrat:wght@600;700;800&display=swap"
                />
            </Head>

            <LandingNav isHome={false} loginStyle="gold" />

            <main className="mx-auto max-w-[1400px] px-5 pt-32 pb-20 md:px-8 lg:px-12 lg:pt-40 lg:pb-28">
                <a
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 transition-colors hover:text-[#C99A2E]"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </a>

                <header className="mt-8 mb-12 max-w-2xl lg:mb-16">
                    <p className="text-xs font-semibold tracking-[0.3em] text-[#C99A2E] uppercase">Portfolio</p>
                    <h1 className="mt-3 font-['DM_Serif_Display',serif] text-4xl font-normal tracking-wide text-neutral-900 sm:text-5xl lg:text-6xl">
                        OUR WORKS
                    </h1>
                    <p className="mt-5 text-base leading-8 text-neutral-600 md:text-lg">
                        A collection of moments, spaces, and celebrations we've brought to life.
                    </p>
                </header>

                <div className="grid auto-rows-[220px] grid-flow-dense grid-cols-1 gap-4 sm:auto-rows-[260px] sm:grid-cols-2 lg:auto-rows-[300px] lg:grid-cols-4 lg:gap-5">
                    {projects.map((project) => (
                        <ProjectTile key={project.title} project={project} />
                    ))}
                </div>
            </main>

            <LandingFooter />
        </div>
    );
}