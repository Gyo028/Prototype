import { Head } from '@inertiajs/react';

import LandingFooter from '@/components/public/landing/landing-footer';
import LandingNav from '@/components/public/landing/landing-nav';
import { faqs } from '@/data/faqs';

export default function Faq() {
    return (
        <div className="min-h-screen bg-[#FBF9F5] font-sans text-black">
            <Head title="FAQs - Gr3at A's Events Styling & Services">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Montserrat:wght@600;700;800&display=swap"
                />
            </Head>

            <LandingNav isHome={false} loginStyle="gold" />

            <main id="faq" className="mx-auto max-w-[1240px] px-5 pt-32 pb-20 md:px-8 lg:px-12 lg:pt-40 lg:pb-28">
                <header className="mb-10 lg:mb-14">
                    <h1 className="font-['DM_Serif_Display',serif] text-[clamp(1.5rem,6.2vw,3rem)] leading-tight font-normal whitespace-nowrap text-black">
                        Frequently Asked Questions
                    </h1>
                    <p className="mt-4 text-base leading-7 text-neutral-600 sm:whitespace-nowrap md:text-lg">
                        Quick answers about our services, custom designs, and how to start your project.
                    </p>
                </header>

                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
                    {faqs.map((faq) => (
                        <details key={faq.id} className="faq-card group">
                            <summary className="faq-header">
                                <span className="faq-question">{faq.question}</span>

                                <span className="faq-icon">
                                    <svg
                                        className="faq-arrow"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 9l-7 7-7-7"
                                        />
                                    </svg>
                                </span>
                            </summary>

                            <div className="faq-answer">{faq.answer}</div>
                        </details>
                    ))}
                </div>
            </main>

            <LandingFooter />
        </div>
    );
}
