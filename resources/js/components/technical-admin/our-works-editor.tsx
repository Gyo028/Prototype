import { router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, ImageIcon, Images, Loader2, MoreHorizontal, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ListEmpty, ListPager, ListToolbar, pageSlice } from '@/components/customer/list-parts';
import { Field, GoldButton, OutlineButton, Panel, PanelHeader, Pill, cx, inputClass, selectClass } from '@/components/dashboard/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ACCEPT, BASE_URL, CATEGORIES, PhotoPicker, categoryLabel, checkPhoto, firstError, photoHint } from '@/components/technical-admin/website-photos';
import type { Category, WorkPhoto } from '@/components/technical-admin/website-photos';

/*
 * Our Works: one shared photo library.
 *
 *  - Homepage carousel: up to 10 library photos, in order. Changes save right away.
 *  - Library: every photo with its title, short caption and category, with a
 *    search box and a Filter button (like the customer lists).
 *  - Each service page showcase picks its 4 photos from here (Service Pages).
 *
 * A photo on the carousel or in a showcase cannot be hidden, deleted or moved
 * to another category until it is taken off there. Only hidden photos can be
 * deleted. Uploads are converted to WebP on the server.
 */

const CAROUSEL_MAX = 10;
const PAGE_SIZE = 10;
const LIMITS = { title: 30, caption: 32, alt: 150 };

type Filter = 'all' | Category | 'carousel' | 'showcase' | 'hidden';

const FILTERS: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All photos' },
    ...CATEGORIES.map((c) => ({ value: c.value as Filter, label: c.label })),
    { value: 'carousel', label: 'On the carousel' },
    { value: 'showcase', label: 'In a showcase' },
    { value: 'hidden', label: 'Hidden' },
];

const inFilter = (p: WorkPhoto, f: Filter) => {
    if (f === 'all') return true;
    if (f === 'carousel') return p.homepageOrder !== null;
    if (f === 'showcase') return p.showcaseOrder !== null;
    if (f === 'hidden') return p.status === 'inactive';
    return p.category === f;
};

const inUse = (p: WorkPhoto) => p.homepageOrder !== null || p.showcaseOrder !== null;

export default function OurWorksEditor({ works }: { works: WorkPhoto[] }) {
    const [filter, setFilter] = useState<Filter>('all');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState<{ photo: WorkPhoto | null } | null>(null);
    const [adding, setAdding] = useState(false);

    const carousel = useMemo(
        () => works.filter((w) => w.homepageOrder !== null).sort((a, b) => (a.homepageOrder ?? 0) - (b.homepageOrder ?? 0)),
        [works],
    );

    const rows = works.filter((w) => {
        const q = query.trim().toLowerCase();
        return inFilter(w, filter) && (!q || `${w.title} ${w.caption}`.toLowerCase().includes(q));
    });
    const { current, visible } = pageSlice(rows, page, PAGE_SIZE);

    const options = {
        preserveScroll: true,
        preserveState: true,
        onStart: () => setBusy(true),
        onFinish: () => setBusy(false),
        onSuccess: () => setError(''),
        onError: (errors: Record<string, string>) => setError(firstError(errors)),
    };

    const send = (method: 'put' | 'patch', url: string, data: Record<string, number[] | string>) =>
        method === 'put' ? router.put(url, data, options) : router.patch(url, data, options);

    const saveCarousel = (ids: number[]) => send('put', `${BASE_URL}/works/carousel`, { ids });

    const moveInCarousel = (index: number, direction: -1 | 1) => {
        const ids = carousel.map((p) => p.id);
        const target = index + direction;
        if (target < 0 || target >= ids.length) return;
        [ids[index], ids[target]] = [ids[target], ids[index]];
        saveCarousel(ids);
    };

    const setStatus = (photo: WorkPhoto, status: 'active' | 'inactive') => send('patch', `${BASE_URL}/works/${photo.id}/status`, { status });

    const remove = (photo: WorkPhoto) => {
        if (confirm(`Delete “${photo.title}” for good? This cannot be undone.`)) router.delete(`${BASE_URL}/works/${photo.id}`, options);
    };

    return (
        <div className="space-y-5">
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            {/* ---------------- Homepage carousel ---------------- */}
            <Panel>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <PanelHeader
                        title="Homepage Carousel"
                        description={`${carousel.length} of ${CAROUSEL_MAX} photos, in the order they slide. Changes save right away.`}
                        icon={<Images className="size-5" />}
                    />
                    <OutlineButton onClick={() => setAdding(true)} disabled={busy || carousel.length >= CAROUSEL_MAX}>
                        <Plus className="size-4" /> Add photo
                    </OutlineButton>
                </div>

                <ol className={cx('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5', busy && 'opacity-60')}>
                    {carousel.map((p, i) => (
                        <li key={p.id} className="overflow-hidden rounded-lg border border-black/10">
                            <div className="relative aspect-[4/3] bg-neutral-100">
                                <img src={p.thumb} alt={p.alt} className="absolute inset-0 size-full object-cover" />
                                <span className="absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-gold text-[11px] font-bold text-white">
                                    {i + 1}
                                </span>
                            </div>
                            <p className="truncate px-2 pt-1.5 text-xs font-bold text-ink">{p.title}</p>
                            <div className="flex items-center justify-between p-1.5">
                                <div className="flex gap-1">
                                    <button
                                        type="button"
                                        aria-label={`Move ${p.title} earlier`}
                                        disabled={busy || i === 0}
                                        onClick={() => moveInCarousel(i, -1)}
                                        className="rounded border border-black/15 p-1 hover:bg-black/5 disabled:opacity-30"
                                    >
                                        <ChevronLeft className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`Move ${p.title} later`}
                                        disabled={busy || i === carousel.length - 1}
                                        onClick={() => moveInCarousel(i, 1)}
                                        className="rounded border border-black/15 p-1 hover:bg-black/5 disabled:opacity-30"
                                    >
                                        <ChevronRight className="size-3.5" />
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    aria-label={`Take ${p.title} off the carousel`}
                                    disabled={busy || carousel.length === 1}
                                    onClick={() => saveCarousel(carousel.filter((c) => c.id !== p.id).map((c) => c.id))}
                                    className="rounded border border-red-300 p-1 text-red-600 hover:bg-red-50 disabled:opacity-30"
                                >
                                    <X className="size-3.5" />
                                </button>
                            </div>
                        </li>
                    ))}
                </ol>
            </Panel>

            {/* ---------------- Library ---------------- */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-ink">Photo Library</h2>
                <GoldButton onClick={() => setForm({ photo: null })}>
                    <Upload className="size-4" /> Upload photo
                </GoldButton>
            </div>

            <Panel className="overflow-hidden p-0!">
                <ListToolbar
                    filters={FILTERS}
                    value={filter}
                    onChange={(f) => {
                        setFilter(f);
                        setPage(1);
                    }}
                    count={(f) => works.filter((w) => inFilter(w, f)).length}
                    label="Filter photos"
                    query={query}
                    onQuery={(q) => {
                        setQuery(q);
                        setPage(1);
                    }}
                    allLabel="All photos"
                    placeholder="Search title or caption"
                />

                {visible.length === 0 ? (
                    <ListEmpty icon={<ImageIcon className="size-8" />}>No photos match.</ListEmpty>
                ) : (
                    <>
                        {/* Tablet and up: table */}
                        <table className="hidden w-full text-left text-sm md:table">
                            <thead className="bg-black/[0.03] text-xs tracking-wide text-ink-soft uppercase">
                                <tr>
                                    <th className="px-4 py-3 pl-5 font-semibold">Photo</th>
                                    <th className="px-4 py-3 font-semibold">Title and caption</th>
                                    <th className="px-4 py-3 font-semibold">Category</th>
                                    <th className="px-4 py-3 font-semibold">Used in</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="w-px px-4 py-3 pr-5">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((p) => (
                                    <tr key={p.id} className="border-t border-black/10">
                                        <td className="px-4 py-2.5 pl-5">
                                            <img src={p.thumb} alt={p.alt} className="h-12 w-16 rounded object-cover" />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <p className="font-bold text-ink">{p.title}</p>
                                            <p className="text-xs text-ink-soft">{p.caption || '—'}</p>
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap">{categoryLabel(p.category)}</td>
                                        <td className="px-4 py-2.5">
                                            <UsedIn photo={p} />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <Pill tone={p.status === 'active' ? 'green' : 'gray'}>{p.status === 'active' ? 'Shown' : 'Hidden'}</Pill>
                                        </td>
                                        <td className="px-4 py-2.5 pr-5">
                                            <RowMenu photo={p} busy={busy} onEdit={() => setForm({ photo: p })} onStatus={setStatus} onDelete={remove} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Phones: cards */}
                        <ul className="divide-y divide-black/10 md:hidden">
                            {visible.map((p) => (
                                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                                    <img src={p.thumb} alt={p.alt} className="h-14 w-16 shrink-0 rounded object-cover" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-semibold text-ink-soft">{categoryLabel(p.category)}</p>
                                        <p className="truncate font-bold text-ink">{p.title}</p>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                            {p.status === 'inactive' && <Pill tone="gray">Hidden</Pill>}
                                            <UsedIn photo={p} />
                                        </div>
                                    </div>
                                    <RowMenu photo={p} busy={busy} onEdit={() => setForm({ photo: p })} onStatus={setStatus} onDelete={remove} />
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                <ListPager page={current} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
            </Panel>

            <PhotoPicker
                open={adding}
                onOpenChange={setAdding}
                title="Add a photo to the carousel"
                description="Shown library photos that are not on the carousel yet. It is added at the end."
                photos={works.filter((w) => w.status === 'active' && w.homepageOrder === null)}
                onPick={(photo) => {
                    setAdding(false);
                    saveCarousel([...carousel.map((c) => c.id), photo.id]);
                }}
            />

            {form && <PhotoFormDialog photo={form.photo} carouselFull={carousel.length >= CAROUSEL_MAX} onClose={() => setForm(null)} />}
        </div>
    );
}

function UsedIn({ photo }: { photo: WorkPhoto }) {
    if (!inUse(photo)) return <span className="text-xs text-ink-soft">—</span>;
    return (
        <span className="flex flex-wrap gap-1.5">
            {photo.homepageOrder !== null && <Pill tone="cream">Carousel #{photo.homepageOrder}</Pill>}
            {photo.showcaseOrder !== null && <Pill tone="blue">Showcase {photo.showcaseOrder}</Pill>}
        </span>
    );
}

function RowMenu({
    photo,
    busy,
    onEdit,
    onStatus,
    onDelete,
}: {
    photo: WorkPhoto;
    busy: boolean;
    onEdit: () => void;
    onStatus: (photo: WorkPhoto, status: 'active' | 'inactive') => void;
    onDelete: (photo: WorkPhoto) => void;
}) {
    const used = inUse(photo);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={`Actions for ${photo.title}`}
                    disabled={busy}
                    className="rounded-lg border border-black/15 p-2 text-ink hover:border-gold disabled:opacity-50"
                >
                    <MoreHorizontal className="size-4" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onSelect={onEdit}>
                    <Pencil className="size-4" /> Edit
                </DropdownMenuItem>
                {photo.status === 'active' ? (
                    <DropdownMenuItem disabled={used} onSelect={() => onStatus(photo, 'inactive')}>
                        <EyeOff className="size-4" /> Hide
                    </DropdownMenuItem>
                ) : (
                    <DropdownMenuItem onSelect={() => onStatus(photo, 'active')}>
                        <Eye className="size-4" /> Show
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={photo.status !== 'inactive' || used} onSelect={() => onDelete(photo)} className="text-red-600 focus:text-red-700">
                    <Trash2 className="size-4" /> Delete for good
                </DropdownMenuItem>
                {(used || photo.status === 'active') && (
                    <p className="px-2 py-1.5 text-[11px] leading-snug text-ink-soft">
                        {used ? 'In use on the carousel or a showcase. Take it off there to hide or delete it.' : 'Hide the photo first to delete it.'}
                    </p>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function PhotoFormDialog({ photo, carouselFull, onClose }: { photo: WorkPhoto | null; carouselFull: boolean; onClose: () => void }) {
    const editing = photo !== null;
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(photo?.url ?? null);
    const [title, setTitle] = useState(photo?.title ?? '');
    const [caption, setCaption] = useState(photo?.caption ?? '');
    const [category, setCategory] = useState<Category | ''>(photo?.category ?? '');
    const [alt, setAlt] = useState(photo?.alt ?? '');
    const [addToCarousel, setAddToCarousel] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    // Free the preview of a chosen file when it changes or the dialog closes.
    useEffect(() => () => {
        if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    }, [preview]);

    const lockedCategory = photo !== null && photo.showcaseOrder !== null;

    const choose = async (chosen: File | undefined) => {
        if (!chosen) return;
        const problem = await checkPhoto(chosen, 'photo');
        if (problem) {
            setErrors({ ...errors, photo: problem });
            return;
        }
        setErrors({ ...errors, photo: '' });
        setFile(chosen);
        setPreview(URL.createObjectURL(chosen));
        if (!title.trim()) setTitle(chosen.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, LIMITS.title));
    };

    const save = () => {
        const e: Record<string, string> = {};
        if (!editing && !file) e.photo = 'Choose a photo to upload.';
        if (!title.trim()) e.title = 'Title is required.';
        if (!category) e.category = 'Choose a category.';
        setErrors(e);
        if (Object.keys(e).length) return;

        const data: Record<string, string | boolean | File> = { title, caption, category, alt_text: alt };
        if (file) data.photo = file;
        if (!editing) data.add_to_carousel = addToCarousel;

        router.post(photo ? `${BASE_URL}/works/${photo.id}` : `${BASE_URL}/works`, data, {
            forceFormData: true,
            preserveScroll: true,
            preserveState: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onSuccess: onClose,
            onError: (serverErrors) => setErrors(serverErrors),
        });
    };

    return (
        <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{editing ? 'Edit Photo' : 'Upload Photo'}</DialogTitle>
                    <DialogDescription>Photos are converted to WebP and resized when saved, so the website loads quickly.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-5 sm:grid-cols-[14rem_1fr]">
                    <div className="grid content-start gap-1.5">
                        <label className="group relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-black/15 bg-neutral-50">
                            {preview ? (
                                <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
                            ) : (
                                <span className="flex flex-col items-center gap-1 text-xs font-bold text-ink-soft">
                                    <Upload className="size-6" /> Choose photo
                                </span>
                            )}
                            {preview && (
                                <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1.5 text-center text-xs font-bold text-white opacity-0 transition group-hover:opacity-100">
                                    Replace photo
                                </span>
                            )}
                            <input
                                type="file"
                                accept={ACCEPT}
                                className="sr-only"
                                onChange={(e) => {
                                    choose(e.target.files?.[0]);
                                    e.target.value = '';
                                }}
                            />
                        </label>
                        <span className="text-[11px] text-ink-soft">{photoHint('photo')}</span>
                        {errors.photo && <p className="text-xs text-red-600">{errors.photo}</p>}
                    </div>

                    <div className="grid content-start gap-4">
                        <Field label="Title" htmlFor="work-title" required error={errors.title}>
                            <input id="work-title" className={inputClass} maxLength={LIMITS.title} value={title} onChange={(e) => setTitle(e.target.value)} />
                            <span className="text-right text-[11px] text-ink-soft">
                                {title.length}/{LIMITS.title}
                            </span>
                        </Field>
                        <Field label="Short caption (optional)" htmlFor="work-caption" error={errors.caption}>
                            <input
                                id="work-caption"
                                className={inputClass}
                                maxLength={LIMITS.caption}
                                placeholder="Gala and dinner styling"
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                            />
                            <span className="text-right text-[11px] text-ink-soft">
                                {caption.length}/{LIMITS.caption}
                            </span>
                        </Field>
                        <Field label="Category" htmlFor="work-category" required error={errors.category}>
                            <select
                                id="work-category"
                                className={selectClass}
                                value={category}
                                disabled={lockedCategory}
                                onChange={(e) => setCategory(e.target.value as Category)}
                            >
                                <option value="" disabled>
                                    Choose a category
                                </option>
                                {CATEGORIES.map((c) => (
                                    <option key={c.value} value={c.value}>
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                            {lockedCategory && (
                                <span className="text-[11px] text-ink-soft">In the {categoryLabel(photo?.category ?? null)} showcase. Replace it there to change the category.</span>
                            )}
                        </Field>
                        <Field label="Photo description for screen readers (optional)" htmlFor="work-alt" error={errors.alt_text}>
                            <input
                                id="work-alt"
                                className={inputClass}
                                maxLength={LIMITS.alt}
                                placeholder="Uses the title when empty"
                                value={alt}
                                onChange={(e) => setAlt(e.target.value)}
                            />
                        </Field>
                        {!editing && (
                            <label className={cx('flex items-center gap-2 text-sm text-ink', carouselFull && 'opacity-60')}>
                                <input
                                    type="checkbox"
                                    className="size-4 accent-gold"
                                    checked={addToCarousel}
                                    disabled={carouselFull}
                                    onChange={(e) => setAddToCarousel(e.target.checked)}
                                />
                                Add to the homepage carousel {carouselFull && '(full, 10 of 10)'}
                            </label>
                        )}
                        {errors.add_to_carousel && <p className="text-xs text-red-600">{errors.add_to_carousel}</p>}
                    </div>
                </div>

                <DialogFooter>
                    <OutlineButton onClick={onClose} disabled={saving}>
                        Cancel
                    </OutlineButton>
                    <GoldButton onClick={save} disabled={saving}>
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        {saving ? 'Converting and saving…' : editing ? 'Save Changes' : 'Upload'}
                    </GoldButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
