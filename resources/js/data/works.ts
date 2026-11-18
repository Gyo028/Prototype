/*
 * The photos shown in the "Our Works" carousel on the landing page.
 * The landing page and the Technical Admin editor both read this list,
 * so they always show the same photos. It moves to the database later.
 */

export const MAX_WORKS = 10;

export type Work = { file: string; label: string; description?: string };

export const works: Work[] = [
    { file: 'work-14.webp', label: 'Wellness Place' },
    { file: 'work-13.webp', label: 'SM City Fairview Plant Wall' },
    { file: 'work-18.webp', label: 'Christmas Mall Display' },
    { file: 'work-3.webp', label: 'Digiplus Booth' },
    { file: 'work-15.webp', label: 'Garden Arch Aisle' },
    { file: 'work-10.webp', label: 'Paris-Themed Setup' },
    { file: 'work-16.webp', label: 'Mirror Tunnel Installation' },
    { file: 'work-17.webp', label: 'Carnival Tent Setup' },
    { file: 'work-19.webp', label: 'Giant Paper Flowers' },
    { file: 'work-11.webp', label: 'Aura Floral Installation' },
];
