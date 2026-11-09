/** Full-screen hero with centered heading, CTA and an upward curved white divider. */
export default function HeroSection() {
    return (
        <section
            id="home"
            className="relative flex h-screen min-h-[620px] items-center justify-center overflow-hidden bg-[#F5EDD8]"
        >
            <img
                src="/images/hero-bg.webp"
                alt="Balloon arch and floral backdrop styled by GR3AT A's"
                className="absolute inset-0 h-full w-full object-cover object-center"
            />
            {/* Soft white wash so the black heading stays readable */}
            <div className="absolute inset-0 bg-white/35" />

            <div className="relative z-10 flex flex-col items-center px-6 pb-10 text-center">
                <h1 className="font-['Montserrat',sans-serif] text-4xl leading-[1.4] font-bold tracking-wide text-black sm:text-5xl lg:text-6xl">
                    Unforgettable Events,
                    <br />
                    Perfectly Planned
                </h1>

                <a
                    href="#services"
                    className="mt-20 inline-flex min-w-[240px] items-center justify-center rounded-md bg-[#C99A2E] px-12 py-4 text-lg font-semibold text-white shadow-md transition-colors hover:bg-[#B3871F] md:mt-32 md:min-w-[290px]"
                >
                    Start Project
                </a>
            </div>

            <svg
                aria-hidden="true"
                viewBox="0 0 1440 100"
                preserveAspectRatio="none"
                className="absolute inset-x-0 -bottom-px h-14 w-full md:h-24"
            >
                <path d="M0 100 Q720 -30 1440 100 Z" fill="#ffffff" />
            </svg>
        </section>
    );
}
