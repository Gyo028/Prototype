import { Head } from '@inertiajs/react';
import type { Contact } from '@/components/technical-admin/contact-footer-editor';
import type { OurServices } from '@/components/technical-admin/our-services-editor';
import type { AboutUs } from '@/components/technical-admin/about-us-editor';
import WebsiteContentManagement from '@/components/technical-admin/website-content-management';
import type { Faq } from '@/data/faqs';
import TechnicalAdminLayout from '@/layouts/technical-admin-layout';

type Props = {
    about: AboutUs;
    services: OurServices;
    contact: Contact;
    faqs: Faq[];
    updated: Record<string, string | null>;
};

export default function WebsiteContent({ about, services, contact, faqs, updated }: Props) {
    return (
        <TechnicalAdminLayout>
            <Head title="Website Content" />

            <WebsiteContentManagement about={about} services={services} contact={contact} faqs={faqs} updated={updated} />
        </TechnicalAdminLayout>
    );
}