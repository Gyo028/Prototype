import { router } from '@inertiajs/react';
import { Check, ImageIcon, Loader2, Upload } from 'lucide-react';
import { useState } from 'react';
import { cx } from '@/components/dashboard/ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/*
 * Shared pieces for the Website Content photos.
 *
 * Every upload is converted to WebP on the server (see App\Services\WebsitePhotos).
 * The checks here only give quick feedback; the server checks again.
 */

export const BASE_URL = '/technical-admin/website-content';

export type SlotPhoto = { url: string; alt: string } | null;

export type Category = 'corporate_events' | 'special_occasions' | 'custom_projects';

export const CATEGORIES: { value: Category; label: string }[] = [
    { value: 'corporate_events', label: 'Corporate Events' },
    { value: 'special_occasions', label: 'Special Occasions' },
    { value: 'custom_projects', label: 'Custom Projects' },
];

export const categoryLabel = (c: Category | null) => CATEGORIES.find((x) => x.value === c)?.label ?? '—';

export type WorkPhoto = {
    id: number;
    url: string;
    thumb: string;
    title: string;
    caption: string;
    category: Category;
    alt: string;
    status: 'active' | 'inactive';
    homepageOrder: number | null;
    showcaseOrder: number | null;
};

export type PhotoKind = 'banner' | 'photo';

const MAX_MB = 5;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPT = '.jpg,.jpeg,.png,.webp';

/** Same limits as the server: banners are wide and at least 900 px; other photos at least 700 px on the long side. */
const MIN = { banner: 900, photo: 700 };

export const photoHint = (kind: PhotoKind) =>
    kind === 'banner'
        ? `JPG, PNG or WEBP up to ${MAX_MB} MB · landscape, at least ${MIN.banner} px wide`
        : `JPG, PNG or WEBP up to ${MAX_MB} MB · at least ${MIN.photo} px on the longest side`;

/** Returns an error message, or null when the file can be sent. */
export async function checkPhoto(file: File, kind: PhotoKind): Promise<string | null> {
    if (!TYPES.includes(file.type)) return 'Only JPG, PNG or WEBP photos are allowed.';
    if (file.size > MAX_MB * 1024 * 1024) return `The photo must be ${MAX_MB} MB or smaller.`;

    const size = await new Promise<{ w: number; h: number } | null>((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            resolve({ w: img.naturalWidth, h: img.naturalHeight });
            URL.revokeObjectURL(url);
        };
        img.onerror = () => {
            resolve(null);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    });

    if (!size) return 'This file is not a readable image.';
    if (kind === 'banner') {
        if (size.w <= size.h) return 'Use a landscape (wide) photo for the banner.';
        if (size.w < MIN.banner) return `The banner photo needs to be at least ${MIN.banner} pixels wide. This one is ${size.w}.`;
    } else if (Math.max(size.w, size.h) < MIN.photo) {
        return `The photo needs to be at least ${MIN.photo} pixels on its longest side. This one is ${Math.max(size.w, size.h)}.`;
    }
    return null;
}

/** First error message of an Inertia error bag. */
export const firstError = (errors: Record<string, string>) => Object.values(errors)[0] ?? 'Something went wrong. Try again.';

/**
 * A fixed photo slot (hero banner, an About Us photo, a service page intro photo).
 * Choosing a file uploads it right away and replaces the slot's photo.
 */
export function PhotoSlot({
    block,
    slot,
    photo,
    label,
    kind,
    aspect,
}: {
    block: string;
    slot: string;
    photo: SlotPhoto;
    label: string;
    kind: PhotoKind;
    /** Tailwind aspect class matching the place on the page, e.g. "aspect-[16/7]". */
    aspect: string;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const upload = async (file: File | undefined) => {
        if (!file) return;
        setDone(false);
        const problem = await checkPhoto(file, kind);
        if (problem) {
            setError(problem);
            return;
        }
        setError('');
        router.post(
            `${BASE_URL}/photos/${block}/${slot}`,
            { photo: file },
            {
                forceFormData: true,
                preserveScroll: true,
                preserveState: true,
                onStart: () => setBusy(true),
                onFinish: () => setBusy(false),
                onSuccess: () => setDone(true),
                onError: (errors) => setError(firstError(errors)),
            },
        );
    };

    return (
        <div className="grid gap-1.5">
            <span className="text-sm text-ink">{label}</span>
            <label
                className={cx(
                    'group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg',
                    aspect,
                    photo ? 'bg-neutral-200' : 'border-2 border-dashed border-black/15 bg-neutral-50',
                    busy && 'pointer-events-none',
                )}
            >
                {photo ? (
                    <img src={photo.url} alt={photo.alt} className="absolute inset-0 size-full object-cover" />
                ) : (
                    <ImageIcon className="size-10 text-neutral-400" />
                )}
                <span
                    className={cx(
                        'absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/60 py-2 text-xs font-bold text-white transition',
                        busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                    )}
                >
                    {busy ? (
                        <>
                            <Loader2 className="size-3.5 animate-spin" /> Converting and saving…
                        </>
                    ) : (
                        <>
                            <Upload className="size-3.5" /> {photo ? 'Replace photo' : 'Upload photo'}
                        </>
                    )}
                </span>
                <input
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => {
                        upload(e.target.files?.[0]);
                        e.target.value = '';
                    }}
                />
            </label>
            <span className="text-[11px] text-ink-soft">{photoHint(kind)}</span>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {done && !error && (
                <p className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                    <Check className="size-3.5" /> Photo saved
                </p>
            )}
        </div>
    );
}

/** A dialog that lists library photos to choose one from. */
export function PhotoPicker({
    open,
    onOpenChange,
    title,
    description,
    photos,
    onPick,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    photos: WorkPhoto[];
    onPick: (photo: WorkPhoto) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {photos.length === 0 ? (
                    <p className="py-8 text-center text-sm text-ink-soft">No photos to choose from. Upload one in Our Works first.</p>
                ) : (
                    <ul className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                        {photos.map((p) => (
                            <li key={p.id}>
                                <button
                                    type="button"
                                    onClick={() => onPick(p)}
                                    className="group w-full overflow-hidden rounded-lg border border-black/10 text-left transition hover:border-gold focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
                                >
                                    <img src={p.thumb} alt={p.alt} className="aspect-[4/3] w-full object-cover" />
                                    <span className="block truncate px-2.5 pt-2 text-sm font-bold text-ink">{p.title}</span>
                                    <span className="block truncate px-2.5 pb-2 text-xs text-ink-soft">{p.caption || categoryLabel(p.category)}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </DialogContent>
        </Dialog>
    );
}
