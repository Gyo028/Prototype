import type { SitePhoto } from '@/lib/public-site';

/** The background photo comes from Website Content; the headline is fixed. */
export default function HeroSection({ photo }: { photo: SitePhoto }) {
    return (
        <section
            id="home"
            className="relative flex min-h-[min(100svh,560px)] items-center overflow-hidden bg-white md:h-[100svh] md:max-h-[1100px] md:min-h-[min(100svh,620px)] portrait:md:items-start"
        >
            <img
                src={photo.url}
                alt={photo.alt}
                className="absolute inset-0 h-full w-full object-cover object-[65%_center] md:object-center"
            />

            <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent md:via-white/55 md:to-transparent"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-white/30 md:hidden" />

            <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 pt-16 lg:px-12 portrait:md:pt-[24svh]">
                <h1 className="font-['DM_Serif_Display',serif] text-[clamp(40px,min(8vw,9svh),72px)] leading-[1.12] font-normal tracking-tight text-[#111111]">
                    Your Vision,
                    <br />
                    Our Creative Touch
                </h1>

                <p className="mt-5 max-w-md font-['Poppins',sans-serif] text-base text-[#2A2A2A] md:max-w-none md:text-lg">
                    Thoughtful styling. Beautifully memorable moments.
                </p>
            </div>
        </section>
    );
}
