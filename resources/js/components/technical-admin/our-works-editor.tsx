import { Check, ChevronLeft, ChevronRight, ImageIcon, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { GoldButton, OutlineButton, Panel, Pill, cx, inputClass } from '@/components/dashboard/ui';
import { works as landingPageWorks } from '@/data/works';

/*
 * Editor for the "Our Works" showcase on the landing page.
 * The showcase has exactly 10 slots. A slot is either empty or holds one photo,
 * and the slot number is the order the photo appears in the carousel
 * (sort_order in `website_content_images`). Empty slots are not shown publicly.
 */

const SLOT_COUNT = 10;

// Backlog item 10 leaves the size limit as [X] MB. Set it here once decided.
const MAX_IMAGE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type Slot = { filled: boolean; src?: string; alt: string };

const emptySlot = (): Slot => ({ filled: false, alt: '' });

// Starts with the photos currently shown on the landing page (see data/works.ts).
const seedSlots: Slot[] = [
    ...landingPageWorks.slice(0, SLOT_COUNT).map((w) => ({
        filled: true,
        src: `/images/works/${w.file}`,
        alt: w.label,
    })),
    ...Array.from({ length: Math.max(0, SLOT_COUNT - landingPageWorks.length) }, emptySlot),
];

const validFile = (file: File) =>
    ALLOWED_TYPES.includes(file.type) && file.size <= MAX_IMAGE_MB * 1024 * 1024;

const fileToSlot = (file: File): Slot => ({
    filled: true,
    src: URL.createObjectURL(file),
    alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
});

export default function OurWorksEditor({ onSaved }: { onSaved?: () => void }) {
    const bulkRef = useRef<HTMLInputElement>(null);
    const [saved, setSaved] = useState<Slot[]>(seedSlots);
    const [slots, setSlots] = useState<Slot[]>(seedSlots);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const filledCount = slots.filter((s) => s.filled).length;
    const dirty = JSON.stringify(slots) !== JSON.stringify(saved);

    const update = (next: Slot[]) => {
        setSlots(next);
        setMessage('');
    };

    const setSlot = (index: number, slot: Slot) => update(slots.map((s, i) => (i === index ? slot : s)));

    /* Upload or replace the photo in one slot */
    const onSlotFile = (index: number, files: FileList | null) => {
        const file = files?.[0];
        if (!file) return;
        if (!validFile(file)) {
            setError(`Only JPG, PNG, or WEBP images up to ${MAX_IMAGE_MB} MB are allowed.`);
            return;
        }
        setError('');
        const previous = slots[index];
        const next = fileToSlot(file);
        // Keep the existing alt text when replacing a photo
        setSlot(index, { ...next, alt: previous.filled && previous.alt ? previous.alt : next.alt });
    };

    /* Fill the empty slots, in order, with several files at once */
    const onBulkFiles = (files: FileList | null) => {
        if (!files) return;
        const list = Array.from(files);
        const valid = list.filter(validFile);
        const emptyIndexes = slots.map((s, i) => (s.filled ? -1 : i)).filter((i) => i >= 0);
        const accepted = valid.slice(0, emptyIndexes.length);

        const problems: string[] = [];
        if (valid.length < list.length)
            problems.push(`Only JPG, PNG, or WEBP images up to ${MAX_IMAGE_MB} MB are allowed.`);
        if (valid.length > accepted.length)
            problems.push(`Only ${SLOT_COUNT} photos can be showcased. ${valid.length - accepted.length} file(s) were not added.`);
        setError(problems.join(' '));

        if (accepted.length) {
            const next = [...slots];
            accepted.forEach((file, i) => {
                next[emptyIndexes[i]] = fileToSlot(file);
            });
            update(next);
        }
        if (bulkRef.current) bulkRef.current.value = '';
    };

    const clearSlot = (index: number) => {
        if (confirm(`Remove the photo in slot ${index + 1}?`)) setSlot(index, emptySlot());
    };

    /* Swap a slot with its neighbour (works for empty slots too) */
    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= SLOT_COUNT) return;
        const next = [...slots];
        [next[index], next[target]] = [next[target], next[index]];
        update(next);
    };

    const save = () => {
        setSaved(slots);
        setMessage('Changes saved');
        onSaved?.();
    };

    const reset = () => {
        setSlots(saved);
        setError('');
        setMessage('');
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {slots.map((slot, i) => (
                    <Panel key={i} className="flex flex-col gap-3 p-4">
                        {/* Photo area: click to upload or replace */}
                        <label
                            className={cx(
                                'group relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-lg',
                                slot.filled ? 'bg-neutral-200' : 'border-2 border-dashed border-black/15 bg-neutral-50',
                            )}
                        >
                            {slot.filled && slot.src && (
                                <img src={slot.src} alt={slot.alt} className="absolute inset-0 size-full object-cover" />
                            )}
                            {slot.filled && !slot.src && <ImageIcon className="size-12 text-neutral-400" />}
                            {!slot.filled && (
                                <span className="flex flex-col items-center gap-1 text-xs font-bold text-ink-soft group-hover:text-gold-dark">
                                    <Upload className="size-7" />
                                    Upload photo
                                    <span className="font-normal">JPG, PNG or WEBP, up to {MAX_IMAGE_MB} MB</span>
                                </span>
                            )}
                            {slot.filled && (
                                <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1.5 text-center text-xs font-bold text-white opacity-0 transition group-hover:opacity-100">
                                    Click to replace
                                </span>
                            )}
                            <span className="absolute top-2 left-2 flex size-7 items-center justify-center rounded-full bg-gold text-xs font-bold text-white">
                                {i + 1}
                            </span>
                            <div className="absolute top-2 right-2">
                                <Pill tone={slot.filled ? 'green' : 'gray'}>{slot.filled ? 'Showing' : 'Empty'}</Pill>
                            </div>
                            <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.webp"
                                hidden
                                onChange={(e) => {
                                    onSlotFile(i, e.target.files);
                                    e.target.value = '';
                                }}
                            />
                        </label>

                        <div className="grid gap-1.5">
                            <label htmlFor={`alt-${i}`} className="text-xs font-bold text-ink">
                                Description
                            </label>
                            <input
                                id={`alt-${i}`}
                                className={inputClass}
                                value={slot.alt}
                                disabled={!slot.filled}
                                placeholder={slot.filled ? 'Describe the photo' : 'Upload a photo first'}
                                onChange={(e) => setSlot(i, { ...slot, alt: e.target.value })}
                            />
                        </div>

                        <div className="mt-auto flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    aria-label={`Move slot ${i + 1} earlier`}
                                    disabled={i === 0}
                                    onClick={() => move(i, -1)}
                                    className="rounded border border-black/15 p-1.5 hover:bg-black/5 disabled:opacity-30"
                                >
                                    <ChevronLeft className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Move slot ${i + 1} later`}
                                    disabled={i === SLOT_COUNT - 1}
                                    onClick={() => move(i, 1)}
                                    className="rounded border border-black/15 p-1.5 hover:bg-black/5 disabled:opacity-30"
                                >
                                    <ChevronRight className="size-4" />
                                </button>
                            </div>
                            <button
                                type="button"
                                aria-label={`Remove photo in slot ${i + 1}`}
                                disabled={!slot.filled}
                                onClick={() => clearSlot(i)}
                                className="inline-flex items-center gap-1.5 rounded border border-red-300 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                                <Trash2 className="size-3.5" /> Remove
                            </button>
                        </div>
                    </Panel>
                ))}
            </div>

            <div className="flex items-center justify-end gap-3">
                {message && <span className="text-xs font-semibold text-green-700">{message}</span>}
                {dirty && !message && <span className="text-xs text-ink-soft">You have unsaved changes</span>}
                <OutlineButton onClick={reset} disabled={!dirty}>
                    <RotateCcw className="size-4" /> Reset
                </OutlineButton>
                <GoldButton onClick={save} disabled={!dirty}>
                    <Check className="size-4" /> Save Changes
                </GoldButton>
            </div>
        </div>
    );
}
