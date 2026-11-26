import { usePage } from '@inertiajs/react';
import { COMPANY } from '@/data/legal';

/*
 * Types of what the public pages receive from the server (PublicSiteController),
 * and the Contact & Footer details shared by every public page.
 */

export type SitePhoto = { url: string; alt: string };

export type SiteContact = {
    name: string;
    phone: string;
    email: string;
    address: string;
    facebook: string;
    instagram: string;
    copyright: string;
};

export type ServiceCard = { title: string; description: string; href: string };

export type CarouselPhoto = { id: number; url: string; title: string; alt: string };

export type WorkPhoto = {
    id: number;
    url: string;
    title: string;
    caption: string;
    category: string;
    categoryLabel: string;
    alt: string;
};

export type ShowcaseTile = { id: number; url: string; title: string; caption: string; alt: string };

export type MoreService = { title: string; text: string; image: string; href: string };

export type ServicePageProps = {
    hero: SitePhoto;
    intro: SitePhoto[];
    showcase: ShowcaseTile[];
    moreServices: MoreService[];
};

/** Used when a page is shown without the server's contact details. */
const FALLBACK: SiteContact = {
    name: COMPANY.name,
    phone: COMPANY.phone,
    email: COMPANY.email,
    address: COMPANY.address,
    facebook: 'https://www.facebook.com/share/17uj5e738o/',
    instagram: '',
    copyright: `Copyright © 2026 ${COMPANY.name}. All rights reserved.`,
};

/** The Contact & Footer details the Technical Admin manages. */
export function useSiteContact(): SiteContact {
    const contact = (usePage().props as { contact?: Partial<SiteContact> }).contact;

    return { ...FALLBACK, ...contact };
}
