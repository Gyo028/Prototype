import {
    ArrowLeft,
    Eye,
    HelpCircle,
    Images,
    Info,
    LayoutTemplate,
    Layers,
    MapPin,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { OutlineButton, PageHeader, Panel } from '@/components/dashboard/ui';
import AboutUsEditor from '@/components/technical-admin/about-us-editor';
import type { AboutUs } from '@/components/technical-admin/about-us-editor';
import ContactFooterEditor from '@/components/technical-admin/contact-footer-editor';
import type { Contact } from '@/components/technical-admin/contact-footer-editor';
import FaqEditor from '@/components/technical-admin/faq-editor';
import HeroEditor from '@/components/technical-admin/hero-editor';
import OurServicesEditor from '@/components/technical-admin/our-services-editor';
import type { OurServices } from '@/components/technical-admin/our-services-editor';
import OurWorksEditor from '@/components/technical-admin/our-works-editor';
import type { Faq } from '@/data/faqs';

/*
 * Sections of the public site, in the order they appear on the page.
 *
 * Saving a section applies right away; there is no separate publish step.
 * About Us, Our Services, Contact & Footer and FAQ are saved to the database.
 * The Hero and Our Works (photo uploads) are still placeholders for now.
 */

type Section = {
    id: string;
    title: string;
    description: string;
    icon: LucideIcon;
};

const sections: Section[] = [
    { id: 'hero', title: 'Hero Section', description: 'Main headline, subheadline, background and Start Project button.', icon: LayoutTemplate },
    { id: 'about', title: 'About Us', description: 'Company introduction shown below the hero.', icon: Info },
    { id: 'services', title: 'Our Services', description: 'Section heading and the three service cards. Selectable services are managed under Services & Assets.', icon: Layers },
    { id: 'works', title: 'Our Works', description: 'Showcase carousel of up to 10 photos of past projects.', icon: Images },
    { id: 'contact', title: 'Contact & Footer', description: 'Phone, email, address and social media links.', icon: MapPin },
    { id: 'faq', title: 'FAQ Page', description: 'Questions and answers on the public FAQ page.', icon: HelpCircle },
];

type Props = {
    about: AboutUs;
    services: OurServices;
    contact: Contact;
    faqs: Faq[];
    updated: Record<string, string | null>;
};

export default function WebsiteContentManagement({ about, services, contact, faqs, updated }: Props) {
    const [activeId, setActiveId] = useState<string | null>(null);

    const active = sections.find((s) => s.id === activeId) ?? null;

    /* ---- Editing a single section ---- */
    if (active) {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setActiveId(null)}
                    className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-gold-dark hover:underline"
                >
                    <ArrowLeft className="size-4" /> Back to all sections
                </button>
                <PageHeader title={active.title} description={active.description} />
                {active.id === 'hero' ? (
                    <HeroEditor />
                ) : active.id === 'about' ? (
                    <AboutUsEditor about={about} />
                ) : active.id === 'services' ? (
                    <OurServicesEditor services={services} />
                ) : active.id === 'contact' ? (
                    <ContactFooterEditor contact={contact} />
                ) : active.id === 'works' ? (
                    <OurWorksEditor />
                ) : active.id === 'faq' ? (
                    <FaqEditor faqs={faqs} />
                ) : (
                    <Panel>
                        <p className="text-sm text-ink-soft">The editor for this section goes here.</p>
                    </Panel>
                )}
            </>
        );
    }

    /* ---- Section selection (card style) ---- */
    return (
        <>
            <PageHeader
                title="Website Content Management"
                description="Choose a part of the landing page to edit. Saved changes apply right away."
                actions={
                    <OutlineButton onClick={() => window.open('/', '_blank')}>
                        <Eye className="size-4 text-gold" /> Preview Page
                    </OutlineButton>
                }
            />

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {sections.map((s, i) => (
                    <Panel key={s.id} className="flex flex-col p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex size-11 items-center justify-center rounded-xl bg-gold/20 text-gold-dark">
                                <s.icon className="size-5" />
                            </div>
                            <span className="text-xs font-bold text-ink-soft">Section {i + 1}</span>
                        </div>

                        <h2 className="mt-4 text-lg font-bold text-ink">{s.title}</h2>
                        <p className="mt-1 flex-1 text-xs text-ink-soft">{s.description}</p>

                        <p className="mt-4 text-xs text-ink-soft">
                            {updated[s.id] ? `Updated ${updated[s.id]}` : 'Not saved yet'}
                        </p>

                        <div className="mt-4 border-t border-black/10 pt-4">
                            <OutlineButton className="w-full" onClick={() => setActiveId(s.id)}>
                                Edit
                            </OutlineButton>
                        </div>
                    </Panel>
                ))}
            </div>
        </>
    );
}