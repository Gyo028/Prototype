import { Star } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

type Review = {
    name: string;
    role: string;
    quote: string;
    rating: number;
    /** Optional avatar photo. Falls back to initials. */
    avatar?: string;
    avatarColor: string;
};

const reviews: Review[] = [
    {
        name: 'Jessice Tan',
        role: 'Corporate Event Client',
        quote: 'The level of professionalism and real-time coordination for our corporate gala was incredible. We could visualize our setup beforehand, and the execution was flawless from start to finish.',
        rating: 5,
        avatarColor: 'bg-[#B8946A]',
    },
    {
        name: 'Carmela Lazaro',
        role: 'Custom Fabrication Client',
        quote: 'The live venue styling was picture-perfect!',
        rating: 5,
        avatarColor: 'bg-[#1F2023]',
    },
    {
        name: 'Mark Johnson',
        role: 'Wedding Client',
        quote: 'Planning a wedding felt effortless with the automated schedule updates and clear role access. Every detail of our theme was executed beautifully, and staying within budget was stress-free!',
        rating: 5,
        avatarColor: 'bg-[#8A7A5C]',
    },
    // Placeholder review so the row has four cards like the design. Replace with a real client review.
    {
        name: 'Sarah Lim',
        role: 'Birthday Client',
        quote: 'Every detail of our theme was executed beautifully, and staying within budget was stress-free!',
        rating: 5,
        avatarColor: 'bg-[#D4B98C]',
    },
];

// Italic quote font (DM Serif Display has no italic)
const quoteSerif = "font-['Lora',serif]";

function Stars({ rating }: { rating: number }) {
    return (
        <div className="mt-3 flex justify-center gap-1" role="img" aria-label={`${rating} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, i) => (
                <Star
                    key={i}
                    className={cn('h-3.5 w-3.5', i < rating ? 'fill-[#C9A77C] text-[#C9A77C]' : 'fill-[#E8DCC6] text-[#E8DCC6]')}
                />
            ))}
        </div>
    );
}

function Avatar({ review }: { review: Review }) {
    const initials = review.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2);

    return (
        <div className="absolute -top-[22px] left-1/2 -translate-x-1/2">
            {review.avatar ? (
                <img src={review.avatar} alt={review.name} className="h-11 w-11 rounded-md object-cover shadow-sm" />
            ) : (
                <span
                    className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-md text-sm font-semibold text-white shadow-sm',
                        review.avatarColor,
                    )}
                >
                    {initials}
                </span>
            )}
        </div>
    );
}

function ReviewCard({ review }: { review: Review }) {
    return (
        <article className="relative flex h-full flex-col rounded-2xl bg-white px-6 pt-9 pb-5 text-center shadow-[0_6px_18px_-8px_rgba(120,90,40,0.25)] transition-shadow duration-500 hover:shadow-[0_0_26px_rgba(201,167,124,0.45)]">
            <Avatar review={review} />
            <p className="text-base font-semibold text-[#111111]">{review.name}</p>
            <p className="text-xs text-neutral-500">{review.role}</p>
            <p className={`${quoteSerif} mt-3 flex-1 text-[13px] leading-[1.45] text-[#111111] italic`}>
                &ldquo;{review.quote}&rdquo;
            </p>
            <Stars rating={review.rating} />
        </article>
    );
}

// The strip holds COPIES copies of the reviews. It auto-scrolls left and, whenever the scroll position
// leaves the middle band (1 to 3 copy-widths), jumps by exactly 2 copy-widths. The copies are identical,
// so the jump is invisible and the loop works in both directions, for auto-scroll and manual scrolling.
const COPIES = 6;
const SPEED = 40; // px per second
const RESUME_DELAY = 2500; // ms of calm after the visitor stops touching before auto-scroll restarts

export default function TestimonialsSection() {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const ui = useRef({ hovering: false, dragging: false, resumeAt: 0, dragStartX: 0, dragStartScroll: 0 });
    const copyWidth = useRef(0);

    const items = Array.from({ length: COPIES }, (_, copy) =>
        reviews.map((review) => ({ review, copy, key: `${copy}-${review.name}` })),
    ).flat();

    const pause = (ms = RESUME_DELAY) => {
        ui.current.resumeAt = performance.now() + ms;
    };

    /** Keep the scroll position inside the middle band; returns how far it jumped. */
    const wrap = () => {
        const el = scrollerRef.current;
        const W = copyWidth.current;
        if (!el || !W) return 0;

        let delta = 0;
        if (el.scrollLeft >= 3 * W) delta = -2 * W;
        else if (el.scrollLeft < W) delta = 2 * W;

        if (delta) {
            el.scrollLeft += delta;
            ui.current.dragStartScroll += delta;
        }
        return delta;
    };

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const measure = () => {
            copyWidth.current = el.scrollWidth / COPIES;
        };
        measure();
        el.scrollLeft = copyWidth.current; // start in the middle band so we can scroll both ways

        const onResize = () => {
            measure();
            el.scrollLeft = copyWidth.current + (el.scrollLeft % copyWidth.current);
        };
        window.addEventListener('resize', onResize);

        let pos = el.scrollLeft;
        let last = performance.now();
        let raf = 0;

        const tick = (now: number) => {
            const dt = Math.min(now - last, 50);
            last = now;
            const u = ui.current;

            if (u.hovering || u.dragging || now < u.resumeAt || reduceMotion) {
                pos = el.scrollLeft; // follow wherever the visitor took it
            } else {
                pos += (SPEED * dt) / 1000; // float accumulator keeps slow speeds smooth
                el.scrollLeft = pos;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    return (
        <section id="testimonials" className="scroll-mt-16 bg-gradient-to-br from-[#FBF9F4] to-[#EDE2CE] py-16 lg:py-24">
            <div className="mx-auto max-w-[1400px] px-6">
                <div className="mb-10 text-center">
                    <p className="text-sm font-normal tracking-[0.3em] text-[#B8946A] uppercase">Testimonials</p>
                    <h2 className="mt-3 font-['DM_Serif_Display',serif] text-4xl font-normal text-[#111111] md:text-5xl">Our Client Reviews</h2>
                </div>
            </div>

            <div className="relative">
                {/* Scrollable strip: swipe, trackpad, shift+wheel, arrow keys or click-and-drag all work. py-10 gives the
                    overlapping avatars and hover glow room, since a scroll container clips whatever sticks out. */}
                <div
                    ref={scrollerRef}
                    tabIndex={0}
                    aria-label="Client reviews. Scroll sideways to see more."
                    onScroll={wrap}
                    onWheel={() => pause()}
                    onTouchStart={() => pause(60000)}
                    onTouchEnd={() => pause()}
                    onPointerEnter={(e) => {
                        if (e.pointerType === 'mouse') ui.current.hovering = true;
                    }}
                    onPointerLeave={() => {
                        ui.current.hovering = false;
                    }}
                    onPointerDown={(e) => {
                        if (e.pointerType !== 'mouse' || e.button !== 0) return;
                        const u = ui.current;
                        u.dragging = true;
                        u.dragStartX = e.clientX;
                        u.dragStartScroll = e.currentTarget.scrollLeft;
                        e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                        const u = ui.current;
                        if (!u.dragging) return;
                        e.currentTarget.scrollLeft = u.dragStartScroll - (e.clientX - u.dragStartX);
                    }}
                    onPointerUp={(e) => {
                        ui.current.dragging = false;
                        pause();
                        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                    }}
                    onPointerCancel={() => {
                        ui.current.dragging = false;
                    }}
                    className="cursor-grab overflow-x-auto overflow-y-hidden py-10 outline-none select-none active:cursor-grabbing [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    <div className="flex w-max">
                        {items.map(({ review, copy, key }) => (
                            <div key={key} className="w-[300px] shrink-0 pr-5 sm:w-[340px]" aria-hidden={copy > 0 ? true : undefined}>
                                <ReviewCard review={review} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
