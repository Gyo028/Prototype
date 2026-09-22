/*
 * The photos shown in the "Our Works" carousel on the landing page.
 * The landing page and the Technical Admin editor both read this list,
 * so they always show the same photos. It moves to the database later.
 */

export const MAX_WORKS = 10;

export type Work = { file: string; label: string };

export const works: Work[] = [
    { file: 'work-1.webp', label: 'Corporate Event' },
    { file: 'work-2.webp', label: 'Mall Activation' },
    { file: 'work-3.webp', label: 'Garden Setup' },
    { file: 'work-4.webp', label: 'Birthday Styling' },
    { file: 'work-5.webp', label: 'Custom Fabrication' },
    { file: 'work-6.webp', label: 'Wedding Setup' },
    { file: 'work-7.webp', label: 'Debut Styling' },
    { file: 'work-8.webp', label: 'Mall Display' },
    { file: 'work-9.webp', label: 'Corporate Gala' },
    { file: 'work-10.webp', label: 'Special Occasion' },
];
