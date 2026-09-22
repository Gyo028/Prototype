import Autoplay from 'embla-carousel-autoplay';
import { useEffect, useRef, useState } from 'react';

import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import { works } from '@/data/works';

export default function WorksCarousel() {
    const [api, setApi] = useState<CarouselApi>();
    const [selected, setSelected] = useState(0);
    const autoplay = useRef(Autoplay({ delay: 3500, stopOnInteraction: false }));

    // Track which slide is centered so we can highlight it and its neighbours
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

    const total = works.length;

    return (
        <div className="works-carousel-wrap">
            <Carousel
                setApi={setApi}
                opts={{ align: 'center', loop: true }}
                plugins={[autoplay.current]}
            >
                <CarouselContent className="-ml-6">
                    {works.map((work, index) => {
                        const isActive = index === selected;
                        const isNear =
                            index === (selected + 1) % total || index === (selected - 1 + total) % total;

                        return (
                            <CarouselItem key={work.file} className="basis-[min(474px,90vw)] pl-6">
                                <div
                                    className={cn(
                                        'transition-all duration-[350ms] ease-out',
                                        isActive ? 'scale-[1.02] opacity-100' : isNear ? 'opacity-100' : 'opacity-35',
                                    )}
                                >
                                    <div className="work-card">
                                        <img src={`/images/works/${work.file}`} alt={work.label} />
                                    </div>
                                </div>
                            </CarouselItem>
                        );
                    })}
                </CarouselContent>
            </Carousel>

            <button
                type="button"
                onClick={() => api?.scrollPrev()}
                aria-label="Previous work"
                className="works-nav-btn left-[5.5%]"
            >
                <img src="/images/icons/carousel-button-left.svg" alt="" />
            </button>

            <button
                type="button"
                onClick={() => api?.scrollNext()}
                aria-label="Next work"
                className="works-nav-btn right-[5.5%]"
            >
                <img src="/images/icons/carousel-button-right.svg" alt="" />
            </button>
        </div>
    );
}
