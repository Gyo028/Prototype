import { ArrowLeft, ArrowRight, Star } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

type Review = {
    name: string;
    role: string;
    quote: string;
    rating: number;
    /** Card background photo. Placeholder images until real client photos are uploaded. */
    background: string;
    /** Optional avatar photo. Falls back to initials. */
    avatar?: string;
    avatarColor: string;
};

const reviews: Review[] = [
    {
        name: 'Bang Upin',
        role: 'Pedagang Asongan',
        quote: 'Terimakasih banyak, kini ruanganku menjadi lebih mewah dan terlihat mahal',
        rating: 4,
        background: '/images/works/work-3.webp',
        avatarColor: 'bg-amber-500',
    },
    {
        name: 'Ibuk Sukijan',
        role: 'Ibu Rumah Tangga',
        quote: 'Makasih Panto, aku sekarang berasa tinggal di apartment karena barang-barang yang terlihat mewah',
        rating: 4,
        background: '/images/works/work-4.webp',
        avatarColor: 'bg-neutral-800',
    },
    {
        name: 'Mpok Ina',
        role: 'Karyawan Swasta',
        quote: 'Sangat terjangkau untuk kantong saya yang tidak terlalu banyak',
        rating: 4,
        background: '/images/works/work-9.webp',
        avatarColor: 'bg-sky-500',
    },
];

function Stars({ rating }: { rating: number }) {
    return (
        <div className="mt-3 flex justify-center gap-1" role="img" aria-label={`${rating} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, i) => (
                <Star
                    key={i}
                    className={cn('h-3.5 w-3.5', i < rating ? 'fill-[#F28C28] text-[#F28C28]' : 'fill-[#F8D9B0] text-[#F8D9B0]')}
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
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-white p-1.5">
            {review.avatar ? (
                <img src={review.avatar} alt={review.name} className="h-14 w-14 rounded-full object-cover" />
            ) : (
                <span
                    className={cn(
                        'flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold text-white',
                        review.avatarColor,
                    )}
                >
                    {initials}
                </span>
            )}
        </div>
    );
}

function ReviewCard({ review, className }: { review: Review; className?: string }) {
    return (
        <article
            className={cn(
                'relative h-[420px] overflow-hidden rounded-3xl shadow-[0_32px_36px_-22px_rgba(0,0,0,0.45)] md:h-[460px]',
                className,
            )}
        >
            <img src={review.background} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

            <div className="absolute inset-x-5 bottom-5 rounded-2xl bg-white px-6 pt-11 pb-5 text-center shadow-lg">
                <Avatar review={review} />
                <h3 className="text-xl font-semibold text-black">{review.name}</h3>
                <p className="text-xs text-neutral-500">{review.role}</p>
                <p className="mt-4 text-sm leading-6 text-neutral-700">&ldquo;{review.quote}&rdquo;</p>
                <Stars rating={review.rating} />
            </div>
        </article>
    );
}

function ArrowButton({ direction, onClick }: { direction: 'prev' | 'next'; onClick: () => void }) {
    const Icon = direction === 'prev' ? ArrowLeft : ArrowRight;

    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={direction === 'prev' ? 'Previous review' : 'Next review'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-transform hover:scale-105"
        >
            <Icon className="h-5 w-5" strokeWidth={2.2} />
        </button>
    );
}

export default function TestimonialsSection() {
    const [offset, setOffset] = useState(0);
    const total = reviews.length;
    const visible = Array.from({ length: Math.min(3, total) }, (_, i) => reviews[(offset + i) % total]);

    const prev = () => setOffset((o) => (o - 1 + total) % total);
    const next = () => setOffset((o) => (o + 1) % total);

    return (
        <section id="testimonials" className="scroll-mt-16 bg-white py-16 lg:py-24">
            <div className="mx-auto max-w-[1400px] px-6">
                <div className="mb-12 text-center">
                    <p className="text-sm font-medium tracking-[0.3em] text-[#E8830E] uppercase">Testimonials</p>
                    <h2 className="mt-2 text-4xl font-semibold text-black md:text-5xl">Our Client Reviews</h2>
                </div>

                <div className="flex items-center gap-4 lg:gap-8">
                    <div className="hidden sm:block">
                        <ArrowButton direction="prev" onClick={prev} />
                    </div>

                    <div className="grid flex-1 grid-cols-1 gap-8 md:grid-cols-3">
                        {visible.map((review, i) => (
                            <ReviewCard key={review.name} review={review} className={i > 0 ? 'hidden md:block' : undefined} />
                        ))}
                    </div>

                    <div className="hidden sm:block">
                        <ArrowButton direction="next" onClick={next} />
                    </div>
                </div>

                {/* Mobile arrows sit under the single visible card */}
                <div className="mt-8 flex justify-center gap-4 sm:hidden">
                    <ArrowButton direction="prev" onClick={prev} />
                    <ArrowButton direction="next" onClick={next} />
                </div>
            </div>
        </section>
    );
}
