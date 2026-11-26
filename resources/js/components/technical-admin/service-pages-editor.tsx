import { router } from '@inertiajs/react';
import { Building2, ImageIcon, Info, LayoutGrid, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Panel, PanelHeader, cx } from '@/components/dashboard/ui';
import { BASE_URL, PhotoPicker, PhotoSlot, firstError } from '@/components/technical-admin/website-photos';
import type { Category, SlotPhoto, WorkPhoto } from '@/components/technical-admin/website-photos';

/*
 * The three service pages (Corporate Events, Special Occasions, Custom Projects).
 * Only their photos are managed here; the text is fixed in the pages.
 *
 *  - Hero banner and the intro photo pair: uploaded straight into their slot.
 *  - Showcase: 4 photos picked from the Our Works library, from the page's
 *    own category. "Change" swaps one photo, so the grid always has 4.
 *  - The "More services" cards at the bottom of the other pages use one of
 *    this page's intro photos automatically (Corporate Events: intro photo 2;
 *    Special Occasions and Custom Projects: intro photo 1).
 */

export type ServicePage = {
    key: string;
    title: string;
    category: Category;
    photos: { hero: SlotPhoto; intro_1: SlotPhoto; intro_2: SlotPhoto };
    showcase: number[];
};

/** Tile sizes of the showcase grid, in order (fixed pattern). */
const TILES = ['Large tile', 'Tall tile', 'Small tile', 'Small tile'];

export default function ServicePagesEditor({ pages, works }: { pages: ServicePage[]; works: WorkPhoto[] }) {
    const [activeKey, setActiveKey] = useState(pages[0]?.key);
    const [picking, setPicking] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    // Only used while a showcase still has empty places (it is saved once all 4 are picked).
    const [draft, setDraft] = useState<(number | null)[] | null>(null);

    const page = pages.find((p) => p.key === activeKey) ?? pages[0];
    if (!page) return null;

    const byId = new Map(works.map((w) => [w.id, w]));
    const positions: (number | null)[] = draft ?? Array.from({ length: TILES.length }, (_, i) => page.showcase[i] ?? null);
    const showcase = positions.map((id) => (id === null ? null : (byId.get(id) ?? null)));
    const choices = works.filter((w) => w.status === 'active' && w.category === page.category && !positions.includes(w.id));

    const replace = (position: number, photo: WorkPhoto) => {
        const next = [...positions];
        next[position] = photo.id;
        setPicking(null);

        if (next.some((id) => id === null)) {
            setDraft(next);
            setError(`Pick all ${TILES.length} photos to save the showcase.`);
            return;
        }

        const ids = next as number[];
        router.put(
            `${BASE_URL}/showcases/${page.key}`,
            { ids },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => {
                    setError('');
                    setDraft(null);
                },
                onError: (errors) => setError(firstError(errors)),
            },
        );
    };

    return (
        <div className="space-y-5">
            {/* Which page */}
            <div role="tablist" aria-label="Service page" className="flex flex-wrap gap-2">
                {pages.map((p) => (
                    <button
                        key={p.key}
                        type="button"
                        role="tab"
                        aria-selected={p.key === page.key}
                        onClick={() => {
                            setActiveKey(p.key);
                            setError('');
                            setDraft(null);
                        }}
                        className={cx(
                            'rounded-full border px-4 py-1.5 text-sm font-bold transition',
                            p.key === page.key ? 'border-gold bg-gold text-white' : 'border-black/15 bg-white text-ink hover:border-gold',
                        )}
                    >
                        {p.title}
                    </button>
                ))}
            </div>

            <Panel key={`photos-${page.key}`}>
                <PanelHeader title="Banner and Intro Photos" description="Each photo saves as soon as you choose it" icon={<Building2 className="size-5" />} />
                <div className="grid gap-5 lg:grid-cols-[2fr_1fr_1fr]">
                    <PhotoSlot block={page.key} slot="hero" photo={page.photos.hero} label="Hero banner" kind="banner" aspect="aspect-[16/8]" />
                    <PhotoSlot block={page.key} slot="intro_1" photo={page.photos.intro_1} label="Intro photo 1" kind="photo" aspect="aspect-[4/5]" />
                    <PhotoSlot block={page.key} slot="intro_2" photo={page.photos.intro_2} label="Intro photo 2" kind="photo" aspect="aspect-[4/5]" />
                </div>
            </Panel>

            <Panel>
                <PanelHeader
                    title="Showcase"
                    description={`4 photos from the ${page.title} category of Our Works`}
                    icon={<LayoutGrid className="size-5" />}
                />
                {error && <p className="mb-3 text-xs text-red-600">{error}</p>}
                <ul className={cx('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', saving && 'opacity-60')}>
                    {showcase.map((photo, i) => (
                        <li key={i} className="flex flex-col overflow-hidden rounded-lg border border-black/10">
                            <div className="relative aspect-[4/3] bg-neutral-100">
                                {photo ? (
                                    <img src={photo.thumb} alt={photo.alt} className="absolute inset-0 size-full object-cover" />
                                ) : (
                                    <ImageIcon className="absolute inset-0 m-auto size-10 text-neutral-400" />
                                )}
                                <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
                                    {i + 1} · {TILES[i]}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 p-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold text-ink">{photo?.title ?? 'Empty'}</p>
                                    <p className="truncate text-xs text-ink-soft">{photo?.caption || '—'}</p>
                                </div>
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => setPicking(i)}
                                    className="inline-flex shrink-0 items-center gap-1 rounded border border-black/15 px-2.5 py-1.5 text-xs font-bold text-ink hover:border-gold disabled:opacity-50"
                                >
                                    <RefreshCw className="size-3.5" /> Change
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
                <p className="mt-4 flex items-start gap-2 text-xs text-ink-soft">
                    <Info className="mt-0.5 size-4 shrink-0 text-gold-dark" />
                    The showcase always shows 4 photos, so a photo can only be swapped, not removed. The page text is fixed. The “More services”
                    cards on the other pages show this page’s intro photo {page.key === 'svc_corporate' ? '2' : '1'}.
                </p>
            </Panel>

            <PhotoPicker
                open={picking !== null}
                onOpenChange={(open) => !open && setPicking(null)}
                title={`Choose photo ${picking !== null ? picking + 1 : ''} for the showcase`}
                description={`Shown photos from the ${page.title} category that are not in this showcase yet.`}
                photos={choices}
                onPick={(photo) => picking !== null && replace(picking, photo)}
            />
        </div>
    );
}
