import { Check, ImageIcon, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Field, GoldButton, OutlineButton, Panel, PanelHeader, inputClass, textareaClass } from '@/components/dashboard/ui';

/*
 * Editor for the Hero Section at the top of the landing page.
 * The headline is shown in two parts (first line dark, second line gold),
 * followed by the subheadline, the background image and the call-to-action
 * button. The button always leads to the customer service request, so only
 * its label is editable.
 *
 * Maps to `website_contents` (title, content) and `website_content_images`
 * (the background) in the ERD.
 */

// Backlog item 10 leaves the size limit as [X] MB. Set it here once decided.
const MAX_IMAGE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// The background the landing page uses when no custom image has been uploaded.
const DEFAULT_BACKGROUND = '/images/hero-bg.webp';

const LIMITS = { headline: 60, highlight: 60, subheadline: 200, button: 30 };

type Hero = {
    headline: string;
    highlight: string;
    subheadline: string;
    button: string;
    /** Background image URL. Undefined means the default background is used. */
    background?: string;
};

// Current landing page content.
const seedHero: Hero = {
    headline: 'Unforgettable Events,',
    highlight: 'Perfectly Planned',
    subheadline:
        'We bring ideas to life through thoughtful planning, creative styling, and smooth coordination — making every event seamless and memorable.',
    button: 'Start Project',
};

function Counter({ value, max }: { value: string; max: number }) {
    return (
        <span className="text-right text-[11px] text-ink-soft">
            {value.length}/{max}
        </span>
    );
}

export default function HeroEditor({ onSaved }: { onSaved?: () => void }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [saved, setSaved] = useState<Hero>(seedHero);
    const [hero, setHero] = useState<Hero>(seedHero);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [imageError, setImageError] = useState('');
    const [message, setMessage] = useState('');

    const dirty = JSON.stringify(hero) !== JSON.stringify(saved);

    const change = (changes: Partial<Hero>) => {
        setHero({ ...hero, ...changes });
        setMessage('');
    };

    const onImage = (files: FileList | null) => {
        const file = files?.[0];
        if (!file) return;
        if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_IMAGE_MB * 1024 * 1024) {
            setImageError(`Only JPG, PNG, or WEBP images up to ${MAX_IMAGE_MB} MB are allowed.`);
        } else {
            setImageError('');
            change({ background: URL.createObjectURL(file) });
        }
        if (fileRef.current) fileRef.current.value = '';
    };

    const save = () => {
        const e: Record<string, string> = {};
        if (!hero.headline.trim()) e.headline = 'Headline is required.';
        if (!hero.highlight.trim()) e.highlight = 'Highlighted line is required.';
        if (!hero.subheadline.trim()) e.subheadline = 'Subheadline is required.';
        if (!hero.button.trim()) e.button = 'Button label is required.';
        setErrors(e);
        if (Object.keys(e).length) return;

        setSaved(hero);
        setMessage('Changes saved');
        onSaved?.();
    };

    const reset = () => {
        setHero(saved);
        setErrors({});
        setImageError('');
        setMessage('');
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-5">
                {/* Form */}
                <Panel>
                    <PanelHeader
                        title="Hero Content"
                        description="The first thing visitors see on the landing page"
                        icon={<ImageIcon className="size-5" />}
                    />

                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Headline" htmlFor="hero-headline" required error={errors.headline}>
                            <input
                                id="hero-headline"
                                className={inputClass}
                                maxLength={LIMITS.headline}
                                value={hero.headline}
                                onChange={(e) => change({ headline: e.target.value })}
                            />
                            <Counter value={hero.headline} max={LIMITS.headline} />
                        </Field>

                        <Field label="Highlighted line (shown in gold)" htmlFor="hero-highlight" required error={errors.highlight}>
                            <input
                                id="hero-highlight"
                                className={inputClass}
                                maxLength={LIMITS.highlight}
                                value={hero.highlight}
                                onChange={(e) => change({ highlight: e.target.value })}
                            />
                            <Counter value={hero.highlight} max={LIMITS.highlight} />
                        </Field>
                        </div>

                        <Field label="Subheadline" htmlFor="hero-sub" required error={errors.subheadline}>
                            <textarea
                                id="hero-sub"
                                className={textareaClass}
                                maxLength={LIMITS.subheadline}
                                value={hero.subheadline}
                                onChange={(e) => change({ subheadline: e.target.value })}
                            />
                            <Counter value={hero.subheadline} max={LIMITS.subheadline} />
                        </Field>

                        <Field label="Button label" htmlFor="hero-button" required error={errors.button}>
                            <input
                                id="hero-button"
                                className={inputClass}
                                maxLength={LIMITS.button}
                                value={hero.button}
                                onChange={(e) => change({ button: e.target.value })}
                            />
                            <span className="text-[11px] text-ink-soft">
                                The button always leads to the customer service request.
                            </span>
                        </Field>

                        {/* Background image */}
                        <div className="grid gap-1.5">
                            <span className="text-sm text-ink">Background image</span>
                            <div className="flex items-center gap-4">
                                <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-200">
                                    <img
                                        src={hero.background ?? DEFAULT_BACKGROUND}
                                        alt="Hero background"
                                        className="size-full object-cover"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs text-ink-soft">
                                        {hero.background ? 'Custom background' : 'Default background'} · JPG, PNG or WEBP,
                                        up to {MAX_IMAGE_MB} MB
                                    </p>
                                    <div className="flex gap-2">
                                        <OutlineButton className="px-3 py-1.5 text-xs" onClick={() => fileRef.current?.click()}>
                                            <Upload className="size-3.5 text-gold" />
                                            {hero.background ? 'Replace' : 'Upload'}
                                        </OutlineButton>
                                        {hero.background && (
                                            <OutlineButton
                                                className="px-3 py-1.5 text-xs text-red-600"
                                                onClick={() => change({ background: undefined })}
                                            >
                                                <Trash2 className="size-3.5" /> Use default
                                            </OutlineButton>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {imageError && <p className="text-xs text-red-600">{imageError}</p>}
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".jpg,.jpeg,.png,.webp"
                                hidden
                                onChange={(e) => onImage(e.target.files)}
                            />
                        </div>
                    </div>
                </Panel>

            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
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
