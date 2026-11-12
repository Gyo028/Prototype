import Autoplay from 'embla-carousel-autoplay';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { works } from '@/data/works';
import { cn } from '@/lib/utils';

// Placeholder until each work gets its own description from the Technical Admin editor.
const DEFAULT_DESCRIPTION = "Custom event styling and fabrication by GR3AT A's Event Styling Services.";

function ArrowButton({ direction, onClick }: { direction: 'prev' | 'next'; onClick: () => void }) {
    const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;

    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={direction === 'prev' ? 'Previous work' : 'Next work'}
            className={cn(
                'absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center text-white/70 transition hover:scale-110 hover:text-white',
                direction === 'prev' ? 'left-1 md:left-[3%]' : 'right-1 md:right-[3%]',
            )}
        >
            <Icon className="h-8 w-8 md:h-9 md:w-9" strokeWidth={1.1} />
        </button>
    );
}

/** Auto-moving "Our Works" slider: centered card is enlarged with a gold glow, neighbours are dimmed. */
export default function WorksSection() {
    const [api, setApi] = useState<CarouselApi>();
    const [selected, setSelected] = useState(0);
    const autoplay = useRef(Autoplay({ delay: 4000, stopOnInteraction: false }));

    useEffect(() => {
        if (!api) return;

        const onSelect = () => setSelected(api.selectedScrollSnap());
        onSelect();
        api.on('select', onSelect);
        api.on('reInit', onSelect);

        return () => {
            api.off('select', onSelect);
            api.off('reInit', onSelect);
        };
    }, [api]);

    const active = works[selected];

    return (
        <section id="works" className="scroll-mt-16 overflow-hidden bg-[#1F2023] py-12 md:py-14">
            <h2 className="mb-2 text-center font-['DM_Serif_Display',serif] text-4xl font-normal tracking-[0.04em] text-[#C9A77C] uppercase md:text-5xl">
                Our Works
            </h2>

            <div className="relative">
                {/* Longer "duration" = slower, softer slide easing */}
                <Carousel
                    setApi={setApi}
                    opts={{ align: 'center', loop: true, duration: 45 }}
                    plugins={[autoplay.current]}
                >
                    <CarouselContent className="-ml-6 items-center">
                        {works.map((work, index) => {
                            const isActive = index === selected;

                            return (
                                <CarouselItem
                                    key={work.file}
                                    className="basis-[78%] pl-6 sm:basis-[55%] lg:basis-[31%]"
                                >
                                    {/* py-8 leaves room for the glow so the carousel viewport does not clip it */}
                                    <div
                                        onClick={() => api?.scrollTo(index)}
                                        className={cn(
                                            'cursor-pointer py-8 will-change-transform',
                                            'transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
                                            isActive ? 'scale-100 opacity-100' : 'scale-[0.82] opacity-50',
                                        )}
                                    >
                                        <img
                                            src={`/images/works/${work.file}`}
                                            alt={work.label}
                                            draggable={false}
                                            className={cn(
                                                'aspect-[4/3] w-full rounded-[4px] object-cover ring-1 transition-all duration-700',
                                                isActive
                                                    ? 'shadow-[0_0_36px_rgba(227,196,141,0.4)] ring-[#E3C48D]'
                                                    : 'shadow-none ring-transparent',
                                            )}
                                        />
                                    </div>
                                </CarouselItem>
                            );
                        })}
                    </CarouselContent>
                </Carousel>

                <ArrowButton direction="prev" onClick={() => api?.scrollPrev()} />
                <ArrowButton direction="next" onClick={() => api?.scrollNext()} />
            </div>

            {active && (
                <div key={active.file} className="animate-in fade-in mx-auto mt-2 max-w-3xl px-6 text-center duration-700">
                    <p className="font-['DM_Serif_Display',serif] text-2xl font-normal text-[#C9A77C]">{active.label}</p>
                    <p className="mt-1 text-sm text-white/70 md:text-base">{DEFAULT_DESCRIPTION}</p>
                </div>
            )}

            <div className="mt-5 text-center">
                <a
                    href="/our-works"
                    className="group inline-flex items-center gap-1.5 text-base text-[#C9A77C] transition-colors hover:text-[#E3C48D]"
                >
                    Explore More
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
            </div>
        </section>
    );
}
