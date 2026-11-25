import type { CSSProperties } from 'react';
import { cx } from '@/components/dashboard/ui';

/*
 * The preliminary layout canvas, used on the request form (Services & Assets)
 * and on Request Details.
 */

type ZoneId = 'stage' | 'entrance' | 'entertainment' | 'dining' | 'food' | 'photo' | 'lighting';

/** A spot on the canvas, as % of its width (x) and height (y). The label is centred on it. */
type Spot = { x: number; y: number };

// The spots of each area of the room, used in order as items are picked. The
// middle stays free for the theme name.
const ZONE_SPOTS: Record<ZoneId, Spot[]> = {
    stage: [{ x: 50, y: 9 }, { x: 34, y: 14 }, { x: 66, y: 14 }, { x: 50, y: 20 }],
    lighting: [{ x: 12, y: 6 }, { x: 88, y: 6 }, { x: 20, y: 20 }, { x: 80, y: 20 }],
    entertainment: [{ x: 12, y: 34 }, { x: 24, y: 44 }, { x: 10, y: 54 }],
    food: [{ x: 88, y: 34 }, { x: 76, y: 44 }, { x: 90, y: 54 }],
    dining: [{ x: 28, y: 66 }, { x: 48, y: 72 }, { x: 64, y: 62 }, { x: 34, y: 80 }, { x: 54, y: 82 }],
    entrance: [{ x: 50, y: 93 }, { x: 30, y: 92 }, { x: 66, y: 92 }],
    photo: [{ x: 92, y: 64 }, { x: 92, y: 79 }, { x: 92, y: 93 }],
};

/** Labels near the left or right edge grow inward, so they stay on the canvas. */
const spotStyle = ({ x, y }: Spot): CSSProperties => ({
    left: `${x}%`,
    top: `${y}%`,
    maxWidth: '30%',
    transform: `translate(${x <= 20 ? '0' : x >= 80 ? '-100%' : '-50%'}, -50%)`,
    textAlign: x <= 20 ? 'left' : x >= 80 ? 'right' : 'center',
});

// Database items have no spot of their own, so the name decides first (it says the
// most), then the category. Temporary, until the theme slots have their own spots.
const ZONE_KEYWORDS: [RegExp, ZoneId][] = [
    [/photo|video/i, 'photo'],
    [/\b(entrance|arch|welcome|balloons?)\b/i, 'entrance'],
    [/\b(backdrop|stage|host|emcee)\b/i, 'stage'],
    [/\b(chairs?|tables?|centerpieces?|seats?|seating)\b/i, 'dining'],
    [/\b(cater\w*|buffet|food|desserts?|cakes?)\b/i, 'food'],
    [/light|lamps?|neon/i, 'lighting'],
    [/\b(dj|band|sound|music)\b/i, 'entertainment'],
];

const CATEGORY_ZONES: Record<string, ZoneId> = {
    Entertainment: 'entertainment',
    'Photo & Video': 'photo',
    Catering: 'food',
    Host: 'stage',
    Furniture: 'dining',
    Structures: 'stage',
    Decors: 'entrance',
    Lighting: 'lighting',
};

const zoneFor = (name: string, category: string): ZoneId =>
    ZONE_KEYWORDS.find(([pattern]) => pattern.test(name))?.[1] ?? CATEGORY_ZONES[category] ?? 'dining';

/** Something to write on the canvas. Assets are gold, services black. */
export type PreviewItem = { key: string; name: string; category: string; kind: 'asset' | 'service' };

type PlacedItem = PreviewItem & { spot: Spot };

/**
 * Gives every item its own spot in its area, in the order they were picked.
 * When an area runs out of spots, the next round sits a little lower.
 */
function placeItems(items: PreviewItem[]): PlacedItem[] {
    const used: Partial<Record<ZoneId, number>> = {};

    return items.map((item) => {
        const zone = zoneFor(item.name, item.category);
        const spots = ZONE_SPOTS[zone];
        const index = used[zone] ?? 0;
        used[zone] = index + 1;

        const base = spots[index % spots.length];
        const round = Math.floor(index / spots.length);
        return { ...item, spot: { x: base.x, y: Math.min(96, base.y + round * 5) } };
    });
}

const gridBackground = {
    backgroundImage: 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
    backgroundSize: '24px 24px',
};

/**
 * The Design Preview canvas. Nothing but text for now: the design theme's
 * name in the middle (it is the background), and each item's name at its own
 * spot in the area of the room it belongs to. Assets are gold, services black.
 * The drawn isometric layout replaces it once the asset artwork is ready.
 */
export default function LayoutPreview({ themeName, items, className }: { themeName?: string | null; items: PreviewItem[]; className?: string }) {
    const placed = placeItems(items);

    return (
        <div
            aria-label="Layout preview"
            className={cx('relative min-h-72 flex-1 overflow-hidden rounded-lg border border-black/15 bg-neutral-50', className)}
            style={gridBackground}
        >
            {/* The design theme: the whole background */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
                <p className={themeName ? 'text-lg font-bold text-ink-soft' : 'text-sm text-ink-soft'}>{themeName ?? 'No theme selected yet'}</p>
                {placed.length === 0 && <p className="text-[11px] text-ink-soft">Pick services or design assets and they appear here.</p>}
            </div>

            {/* Each item, placed automatically at its own spot */}
            {placed.map((item) => (
                <span
                    key={item.key}
                    className={cx('absolute text-xs leading-tight font-bold', item.kind === 'asset' ? 'text-gold-dark' : 'text-ink')}
                    style={spotStyle(item.spot)}
                >
                    {item.name}
                </span>
            ))}
        </div>
    );
}

/** The key under a preview. */
export function PreviewLegend() {
    return (
        <p className="mt-2 text-[11px] text-ink-soft">
            <span className="font-bold text-gold-dark">Gold</span> = design asset · <span className="font-bold text-ink">black</span> = service
        </p>
    );
}
