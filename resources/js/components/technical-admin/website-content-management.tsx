import { Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Eye,
    HelpCircle,
    Images,
    Info,
    LayoutTemplate,
    Layers,
    MapPin,
    Send,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { GoldButton, OutlineButton, PageHeader, Panel, Pill, cx } from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import AboutUsEditor from '@/components/technical-admin/about-us-editor';
import ContactFooterEditor from '@/components/technical-admin/contact-footer-editor';
import FaqEditor from '@/components/technical-admin/faq-editor';
import HeroEditor from '@/components/technical-admin/hero-editor';
import OurServicesEditor from '@/components/technical-admin/our-services-editor';
import OurWorksEditor from '@/components/technical-admin/our-works-editor';

/* ------------------------------------------------------------------ */
/* Sections of the public site, in the order they appear on the page  */
/* ------------------------------------------------------------------ */

type SectionStatus = 'Published' | 'Unpublished changes' | 'Managed elsewhere';

type Section = {
    id: string;
    title: string;
    description: string;
    icon: LucideIcon;
    status: SectionStatus;
    updated: string;
    /** Sections that open their own admin page instead of the editor below */
    href?: string;
    /** Sections the Technical Admin cannot edit */
    readOnlyNote?: string;
};

// Placeholder data until the database is connected.
const seedSections: Section[] = [
    { id: 'hero', title: 'Hero Section', description: 'Main headline, subheadline, background and Start Project button.', icon: LayoutTemplate, status: 'Published', updated: '10 minutes ago' },
    { id: 'about', title: 'About Us', description: 'Company introduction shown below the hero.', icon: Info, status: 'Published', updated: '3 weeks ago' },
    { id: 'services', title: 'Our Services', description: 'Section heading and the three service cards. Selectable services are managed under Services & Assets.', icon: Layers, status: 'Published', updated: '5 days ago' },
    { id: 'works', title: 'Our Works', description: 'Showcase carousel of up to 10 photos of past projects.', icon: Images, status: 'Published', updated: '2 days ago' },
    { id: 'contact', title: 'Contact & Footer', description: 'Phone, email, address and social media links.', icon: MapPin, status: 'Published', updated: '1 month ago' },
    { id: 'faq', title: 'FAQ Page', description: 'Questions and answers on the public FAQ page.', icon: HelpCircle, status: 'Unpublished changes', updated: '2 weeks ago' },
];

const statusTone: Record<SectionStatus, PillTone> = {
    Published: 'green',
    'Unpublished changes': 'yellow',
    'Managed elsewhere': 'gray',
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function WebsiteContentManagement() {
    const [sections, setSections] = useState(seedSections);
    const [activeId, setActiveId] = useState<string | null>(null);

    const active = sections.find((s) => s.id === activeId) ?? null;
    const pending = sections.filter((s) => s.status === 'Unpublished changes').length;

    const publishAll = () =>
        setSections((list) =>
            list.map((s) => (s.status === 'Unpublished changes' ? { ...s, status: 'Published', updated: 'Just now' } : s)),
        );

    // Called by a section editor after its changes are saved
    const markUnpublished = (id: string) =>
        setSections((list) =>
            list.map((s) => (s.id === id ? { ...s, status: 'Unpublished changes', updated: 'Just now' } : s)),
        );

    /* ---- Editing a single section (editors are added one by one) ---- */
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
                    <HeroEditor onSaved={() => markUnpublished('hero')} />
                ) : active.id === 'about' ? (
                    <AboutUsEditor onSaved={() => markUnpublished('about')} />
                ) : active.id === 'services' ? (
                    <OurServicesEditor onSaved={() => markUnpublished('services')} />
                ) : active.id === 'contact' ? (
                    <ContactFooterEditor onSaved={() => markUnpublished('contact')} />
                ) : active.id === 'works' ? (
                    <OurWorksEditor onSaved={() => markUnpublished('works')} />
                ) : active.id === 'faq' ? (
                    <FaqEditor onSaved={() => markUnpublished('faq')} />
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
                description="Choose a part of the landing page to edit."
                actions={
                    <>
                        <OutlineButton onClick={() => window.open('/', '_blank')}>
                            <Eye className="size-4 text-gold" /> Preview Page
                        </OutlineButton>
                        <GoldButton onClick={publishAll} disabled={pending === 0}>
                            <Send className="size-4" />
                            {pending > 0 ? `Publish ${pending} change${pending > 1 ? 's' : ''}` : 'All published'}
                        </GoldButton>
                    </>
                }
            />

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {sections.map((s, i) => {
                    const editable = !s.readOnlyNote;
                    return (
                        <Panel
                            key={s.id}
                            className={cx(
                                'flex flex-col p-5',
                                s.status === 'Unpublished changes' && 'border-gold',
                            )}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex size-11 items-center justify-center rounded-xl bg-gold/20 text-gold-dark">
                                    <s.icon className="size-5" />
                                </div>
                                <span className="text-xs font-bold text-ink-soft">Section {i + 1}</span>
                            </div>

                            <h2 className="mt-4 text-lg font-bold text-ink">{s.title}</h2>
                            <p className="mt-1 flex-1 text-xs text-ink-soft">{s.description}</p>

                            <div className="mt-4 flex items-center justify-between gap-2">
                                <Pill tone={statusTone[s.status]}>{s.status}</Pill>
                                <span className="text-xs text-ink-soft">
                                    {s.updated === '—' ? '' : `Updated ${s.updated}`}
                                </span>
                            </div>

                            <div className="mt-4 border-t border-black/10 pt-4">
                                {s.href ? (
                                    <Link
                                        href={s.href}
                                        className="inline-flex w-full items-center justify-center rounded-lg border border-gold bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-gold/10"
                                    >
                                        Edit
                                    </Link>
                                ) : editable ? (
                                    <OutlineButton className="w-full" onClick={() => setActiveId(s.id)}>
                                        Edit
                                    </OutlineButton>
                                ) : (
                                    <p className="text-center text-xs text-ink-soft">{s.readOnlyNote}</p>
                                )}
                            </div>
                        </Panel>
                    );
                })}
            </div>
        </>
    );
}
