import Autoplay from 'embla-carousel-autoplay';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { works } from '@/data/works';
import { cn } from '@/lib/utils';

// Placeholder until each work gets its own description from the Technical Admin editor.
const DEFAULT_DESCRIPTION = "Custom event styling and fabrication by GR3AT A's Event Styling Services.";

function ArrowButton({ direction, onClick }: { direction: 'prev' | 'next'; onClick: () => void }) {
    const Icon = direction === 'prev' ? ArrowLeft : ArrowRight;

    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={direction === 'prev' ? 'Previous work' : 'Next work'}
            className={cn(
                'absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-md transition-transform hover:scale-105 md:h-16 md:w-16',
                direction === 'prev' ? 'left-3 md:left-6' : 'right-3 md:right-6',
            )}
        >
            <Icon className="h-5 w-5 md:h-7 md:w-7" strokeWidth={2.2} />
        </button>
    );
}

/** Auto-moving "Our Works" slider: centered card is enlarged, the active title sits underneath. */
export default function WorksSection() {
    const [api, setApi] = useState<CarouselApi>();
    const [selected, setSelected] = useState(0);
    const autoplay = useRef(Autoplay({ delay: 3500, stopOnInteraction: false }));

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
        <section id="works" className="scroll-mt-16 overflow-hidden bg-[#F0E3C6] py-12 md:py-14">
            <h2 className="mb-8 text-center text-4xl font-semibold text-black md:text-5xl">Our Works</h2>

            <div className="relative">
                <Carousel setApi={setApi} opts={{ align: 'center', loop: true }} plugins={[autoplay.current]}>
                    <CarouselContent className="-ml-6 items-center">
                        {works.map((work, index) => {
                            const isActive = index === selected;

                            return (
                                <CarouselItem
                                    key={work.file}
                                    className="basis-[78%] pl-6 sm:basis-[55%] lg:basis-[31%]"
                                >
                                    <div className="flex h-[280px] items-center md:h-[440px]">
                                        <img
                                            src={`/images/works/${work.file}`}
                                            alt={work.label}
                                            className={cn(
                                                'w-full rounded-[3px] object-cover transition-all duration-500',
                                                isActive ? 'h-full' : 'h-[82%]',
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
                <div key={active.file} className="animate-in fade-in mx-auto mt-8 max-w-3xl px-6 text-center duration-500">
                    <p className="text-lg font-semibold text-neutral-900">{active.label}</p>
                    <p className="mt-1 text-base text-neutral-800">{DEFAULT_DESCRIPTION}</p>
                </div>
            )}
        </section>
    );
}
