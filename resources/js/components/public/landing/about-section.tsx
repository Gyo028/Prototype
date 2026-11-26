import type { SitePhoto } from '@/lib/public-site';

/** Text and photos come from Website Content; the title is fixed. Photos: main, top right, bottom right. */
export default function AboutSection({ paragraphs, photos }: { paragraphs: string[]; photos: SitePhoto[] }) {
    const [main, topRight, bottomRight] = photos;

    return (
        <section id="about" className="relative scroll-mt-16 overflow-hidden bg-white py-20 lg:py-28">
            <div className="mx-auto grid max-w-[1400px] items-center gap-14 px-6 lg:grid-cols-[1fr_1.15fr] lg:gap-10 lg:px-12">
                <div className="lg:-mr-12 lg:pr-6 2xl:-mr-28">
                    <h2 className="mb-10 font-['DM_Serif_Display',serif] text-4xl font-normal text-black md:text-5xl">About Us</h2>

                    <div className="space-y-6 text-[15px] leading-8 text-neutral-700 md:text-base lg:text-justify 2xl:text-[17px]">
                        {paragraphs.map((paragraph, i) => (
                            <p key={i}>{paragraph}</p>
                        ))}
                    </div>
                </div>

                <div className="relative mx-auto aspect-[690/650] w-full max-w-[680px] lg:ml-auto lg:-mr-10 2xl:-mr-24">
                    <div className="absolute top-[15%] left-[7%] z-0 h-[71%] w-[49%] rotate-[4deg]">
                        <div className="float-b h-full w-full overflow-hidden rounded-3xl shadow-[0_28px_36px_-16px_rgba(62,140,60,0.4)]">
                            <img
                                src={main?.url}
                                alt={main?.alt}
                                className="h-full w-full object-cover"
                            />
                        </div>
                    </div>

                    <div className="absolute top-[3%] left-[48.5%] z-20 h-[45%] w-[37%] -rotate-[7deg]">
                        <div className="float-a h-full w-full overflow-hidden rounded-3xl shadow-[0_28px_36px_-16px_rgba(62,140,60,0.4)]">
                            <img
                                src={topRight?.url}
                                alt={topRight?.alt}
                                className="h-full w-full object-cover"
                            />
                        </div>
                    </div>

                    <div className="absolute top-[51%] left-[56%] z-10 h-[46%] w-[40%] rotate-[6deg]">
                        <div className="float-c h-full w-full overflow-hidden rounded-3xl shadow-[0_32px_40px_-18px_rgba(224,130,50,0.5)]">
                            <img
                                src={bottomRight?.url}
                                alt={bottomRight?.alt}
                                className="h-full w-full object-cover"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}