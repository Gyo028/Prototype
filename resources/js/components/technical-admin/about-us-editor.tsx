import { router } from '@inertiajs/react';
import { Check, Images, Info, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Field, GoldButton, OutlineButton, Panel, PanelHeader, textareaClass } from '@/components/dashboard/ui';
import { BASE_URL, PhotoSlot } from '@/components/technical-admin/website-photos';
import type { SlotPhoto } from '@/components/technical-admin/website-photos';
import { cn } from '@/lib/utils';

/*
 * About Us: two paragraphs and the three collage photos.
 * The section title is fixed. The limits keep the text about as tall as the
 * photo collage beside it. Line breaks are turned into spaces (the server does
 * the same), since each paragraph is shown as one block.
 */

const LIMITS = { first: 180, second: 420 };

type Paragraphs = { first: string; second: string };

export type AboutUs = Paragraphs & {
    photos: { about_1: SlotPhoto; about_2: SlotPhoto; about_3: SlotPhoto };
};

const oneLine = (text: string) => text.replace(/\s*[\r\n]+\s*/g, ' ');

export default function AboutUsEditor({ about }: { about: AboutUs }) {
    const initial: Paragraphs = { first: about.first, second: about.second };
    const [saved, setSaved] = useState<Paragraphs>(initial);
    const [data, setData] = useState<Paragraphs>(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const dirty = JSON.stringify(data) !== JSON.stringify(saved);

    const change = (changes: Partial<Paragraphs>) => {
        setData({ ...data, ...changes });
        setMessage('');
    };

    const save = () => {
        const e: Record<string, string> = {};
        if (!data.first.trim()) e.first = 'The first paragraph is required.';
        if (!data.second.trim()) e.second = 'The second paragraph is required.';
        setErrors(e);
        if (Object.keys(e).length) return;

        router.put(`${BASE_URL}/about`, data, {
            preserveScroll: true,
            preserveState: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onSuccess: () => {
                setSaved(data);
                setMessage('Changes saved');
            },
            onError: (serverErrors) => setErrors(serverErrors),
        });
    };

    const reset = () => {
        setData(saved);
        setErrors({});
        setMessage('');
    };

    const paragraph = (key: keyof Paragraphs, label: string, rows: number) => (
        <Field label={label} htmlFor={`about-${key}`} required error={errors[key]}>
            <textarea
                id={`about-${key}`}
                className={cn(textareaClass, 'resize-none')}
                rows={rows}
                maxLength={LIMITS[key]}
                value={data[key]}
                onChange={(e) => {
                    const value = oneLine(e.target.value);
                    change(key === 'first' ? { first: value } : { second: value });
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            />
            <span className="text-right text-[11px] text-ink-soft">
                {data[key].length}/{LIMITS[key]}
            </span>
        </Field>
    );

    return (
        <div className="space-y-5">
            <Panel>
                <PanelHeader title="About Us Text" description="Two paragraphs shown beside the photo collage" icon={<Info className="size-5" />} />

                <div className="space-y-4">
                    {paragraph('first', 'First paragraph', 3)}
                    {paragraph('second', 'Second paragraph', 6)}
                    <p className="text-xs text-ink-soft">The section title “About Us” is fixed. It matches the menu link.</p>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                    {message && <span className="text-xs font-semibold text-green-700">{message}</span>}
                    {dirty && !message && <span className="text-xs text-ink-soft">You have unsaved changes</span>}
                    <OutlineButton onClick={reset} disabled={!dirty}>
                        <RotateCcw className="size-4" /> Reset
                    </OutlineButton>
                    <GoldButton onClick={save} disabled={!dirty || saving}>
                        <Check className="size-4" /> Save Changes
                    </GoldButton>
                </div>
            </Panel>

            <Panel>
                <PanelHeader title="Photo Collage" description="Each photo saves as soon as you choose it" icon={<Images className="size-5" />} />
                <div className="grid gap-5 sm:grid-cols-3">
                    <PhotoSlot block="about" slot="about_1" photo={about.photos.about_1} label="Main photo" kind="photo" aspect="aspect-[3/4]" />
                    <PhotoSlot block="about" slot="about_2" photo={about.photos.about_2} label="Top right" kind="photo" aspect="aspect-[4/5]" />
                    <PhotoSlot block="about" slot="about_3" photo={about.photos.about_3} label="Bottom right" kind="photo" aspect="aspect-[4/5]" />
                </div>
            </Panel>
        </div>
    );
}
