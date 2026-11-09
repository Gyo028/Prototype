import { Head } from '@inertiajs/react';

import AboutSection from '@/components/public/landing/about-section';
import HeroSection from '@/components/public/landing/hero-section';
import LandingFooter from '@/components/public/landing/landing-footer';
import LandingNav from '@/components/public/landing/landing-nav';
import ServicesSection from '@/components/public/landing/services-section';
import TestimonialsSection from '@/components/public/landing/testimonials-section';
import WorksSection from '@/components/public/landing/works-section';

export default function Landing() {
    return (
        <div className="min-h-screen bg-white font-sans text-black">
            <Head title="Gr3at A's Events Styling & Services">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&display=swap"
                />
            </Head>

            <LandingNav />

            <main>
                <HeroSection />
                <AboutSection />
                <ServicesSection />
                <WorksSection />
                <TestimonialsSection />
            </main>

            <LandingFooter />
        </div>
    );
}
