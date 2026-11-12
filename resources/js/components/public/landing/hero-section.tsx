import { loginButton } from './landing-nav';

/** Hero: photo backdrop faded to white on the left, left-aligned serif heading, subtext and CTA. */
export default function HeroSection() {
    return (
        <section
            id="home"
            className="relative flex min-h-[560px] items-center overflow-hidden bg-white md:h-screen md:min-h-[620px]"
        >
            <img
                src="/images/hero-bg.webp"
                alt="Balloon arch and floral backdrop styled by GR3AT A's"
                className="absolute inset-0 h-full w-full object-cover object-[65%_center] md:object-center"
            />

            {/* White fade: strong on the left for readable text, clear on the right to show the photo */}
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent md:via-white/55 md:to-transparent"
            />
            {/* Mobile: extra wash so text stays readable over the photo */}
            <div aria-hidden="true" className="absolute inset-0 bg-white/30 md:hidden" />

            <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-16 md:px-1">
                <h1 className="font-['DM_Serif_Display',serif] text-[40px] leading-[1.12] font-normal tracking-tight text-[#111111] sm:text-5xl md:text-6xl lg:text-[72px]">
                    Your Vision, 
                    <br />
                    Our Creative Touch
                </h1>

                <p className="mt-5 max-w-md font-['Poppins',sans-serif] text-base text-[#2A2A2A] md:max-w-none md:text-lg">
                    Thoughtful styling. Beautifully memorable moments.
                </p>

                <a
                    href="#services"
                    className={`mt-8 inline-flex px-10 py-3 text-sm ${loginButton}`}
                >
                    Start Your Project
                </a>
            </div>
        </section>
    );
}
