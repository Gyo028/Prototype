import { ChevronLeft, ChevronRight, Download, ImageIcon } from 'lucide-react';
import { useRef } from 'react';
import { OutlineButton } from '@/components/dashboard/ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/*
 * Photo viewer for the site assessment photos and the finished-work photos.
 *
 *  - Laptop and tablet: a large dialog with Previous, Next and Download.
 *  - Phones: full screen; swipe left or right to move between photos.
 */

export type ViewerPhoto = { id: number; name: string; url: string };

export default function PhotoViewer({
    photos,
    index,
    onIndex,
    caption,
}: {
    photos: ViewerPhoto[];
    /** The photo shown, or null when closed. */
    index: number | null;
    onIndex: (i: number | null) => void;
    /** Shown after "Photo 2 of 5", e.g. "Ocular visit on Nov 23, 2026". */
    caption?: string;
}) {
    const shown = index === null ? null : photos[index];
    const touchX = useRef<number | null>(null);
    const many = photos.length > 1;

    const go = (step: number) => {
        if (index === null || !many) return;
        onIndex((index + step + photos.length) % photos.length);
    };

    return (
        <Dialog open={shown != null} onOpenChange={(open) => !open && onIndex(null)}>
            <DialogContent className="flex h-svh max-h-svh w-screen max-w-none flex-col gap-3 rounded-none border-0 p-3 sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-lg sm:border sm:p-6">
                {shown && index !== null && (
                    <>
                        <DialogHeader className="pr-8 text-left">
                            <DialogTitle className="flex min-w-0 items-center gap-2 text-base sm:text-lg">
                                <ImageIcon className="size-5 shrink-0 text-gold-dark" /> <span className="truncate">{shown.name}</span>
                            </DialogTitle>
                            <DialogDescription>
                                Photo {index + 1} of {photos.length}
                                {caption && ` · ${caption}`}
                            </DialogDescription>
                        </DialogHeader>

                        <div
                            className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-black/5"
                            onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
                            onTouchEnd={(e) => {
                                if (touchX.current === null) return;
                                const dx = e.changedTouches[0].clientX - touchX.current;
                                touchX.current = null;
                                if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
                            }}
                        >
                            <img src={shown.url} alt={shown.name} className="max-h-full w-full object-contain sm:max-h-[65vh]" />
                        </div>

                        {many && <p className="text-center text-xs text-ink-soft sm:hidden">Swipe to see the other photos.</p>}

                        <div className="flex items-center justify-between gap-2">
                            <div className="flex gap-2">
                                <OutlineButton onClick={() => go(-1)} disabled={!many} aria-label="Previous photo" className="px-3">
                                    <ChevronLeft className="size-4" /> <span className="hidden sm:inline">Previous</span>
                                </OutlineButton>
                                <OutlineButton onClick={() => go(1)} disabled={!many} aria-label="Next photo" className="px-3">
                                    <span className="hidden sm:inline">Next</span> <ChevronRight className="size-4" />
                                </OutlineButton>
                            </div>
                            <a
                                href={`${shown.url}?download=1`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gold bg-white px-3 py-2 text-sm font-bold text-ink hover:bg-gold/10"
                            >
                                <Download className="size-4" /> Download
                            </a>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
