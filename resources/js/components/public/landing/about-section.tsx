import MoreInfoLink from '@/components/public/landing/more-info-link';

const aboutImages = {
    plantWall: '/images/works/work-1.webp',
    flowerSet: '/images/works/work-8.webp',
    holidaySet: '/images/works/work-17.webp',
};

export default function AboutSection() {
    return (
        <section id="about" className="relative scroll-mt-16 overflow-hidden bg-white py-20 lg:py-28">
            <div className="mx-auto grid max-w-[1400px] items-center gap-14 px-6 lg:grid-cols-[1fr_1.15fr] lg:gap-10 lg:px-12">
                {/* Copy */}
                <div className="lg:pr-10">
                    <h2 className="mb-10 font-['DM_Serif_Display',serif] text-4xl font-normal text-black md:text-5xl">About Us</h2>

                    <div className="space-y-6 text-[15px] leading-8 text-neutral-700 md:text-base lg:text-justify">
                        <p>
                            GR3AT A's Event Styling &amp; Services specializes in customized event setups and styling
                            tailored to each client's needs and vision.
                        </p>
                        <p>
                            From Event decorations and furniture to custom structures, signage, printing, and
                            greenery, we provide a wide range of products and services to bring every concept to
                            life. More than just a business, GR3AT A's is a company with a heart. We are committed
                            to supporting the education of our scholars and extending help to selected charitable
                            institutions.
                        </p>
                    </div>

                    <MoreInfoLink href="#services" className="mt-10" />
                </div>

                {/* Asymmetric image cluster */}
                <div className="relative flex items-center gap-5 sm:gap-8 lg:-mr-24 lg:gap-9">
                    <div className="flex w-[38%] shrink-0 flex-col gap-8 sm:gap-10 lg:w-[30%]">
                        <div className="float-a aspect-square overflow-hidden rounded-2xl shadow-[0_28px_36px_-16px_rgba(62,140,60,0.4)]">
                            <img
                                src={aboutImages.plantWall}
                                alt="Green plant wall installation"
                                className="h-full w-full object-cover"
                            />
                        </div>
                        <div className="float-b aspect-[7/10] overflow-hidden rounded-2xl shadow-[0_28px_36px_-16px_rgba(62,140,60,0.4)]">
                            <img
                                src={aboutImages.flowerSet}
                                alt="Flower backdrop set"
                                className="h-full w-full object-cover"
                            />
                        </div>
                    </div>

                    <div className="relative flex-1 lg:mt-24 ">
                        <div
                            aria-hidden="true"
                            className="absolute -top-10 left-10 hidden h-32 w-full rounded-3xl bg-neutral-100 sm:block"
                        />
                        <div className="float-c relative aspect-[8/7] overflow-hidden rounded-2xl shadow-[0_32px_40px_-18px_rgba(224,130,50,0.5)]">
                            <img
                                src={aboutImages.holidaySet}
                                alt="Warm holiday lighting event set-up"
                                className="h-full w-full object-cover"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
