import { Info, LayoutTemplate } from 'lucide-react';
import { Panel, PanelHeader } from '@/components/dashboard/ui';
import { PhotoSlot } from '@/components/technical-admin/website-photos';
import type { SlotPhoto } from '@/components/technical-admin/website-photos';

/*
 * Hero section: only the background photo is managed here.
 * The headline and subheadline are fixed in the page, because longer text
 * would break the hero layout.
 */

export type Hero = { photos: { hero: SlotPhoto } };

export default function HeroEditor({ hero }: { hero: Hero }) {
    return (
        <Panel>
            <PanelHeader title="Background Photo" description="Shown behind the headline at the top of the landing page" icon={<LayoutTemplate className="size-5" />} />

            <div className="max-w-3xl">
                <PhotoSlot block="hero" slot="hero" photo={hero.photos.hero} label="Hero banner" kind="banner" aspect="aspect-[16/8]" />
            </div>

            <p className="mt-5 flex items-start gap-2 rounded-lg bg-gold/10 p-3 text-xs text-ink-soft">
                <Info className="mt-0.5 size-4 shrink-0 text-gold-dark" />
                The headline “Your Vision, Our Creative Touch” and the line below it are fixed to keep the page layout. The left side of the photo sits
                behind the text, so choose a photo whose subject is on the right.
            </p>
        </Panel>
    );
}
