import { Check, Info, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Field, GoldButton, OutlineButton, Panel, PanelHeader, inputClass, textareaClass } from '@/components/dashboard/ui';
import { cn } from '@/lib/utils';

/*
 * Editor for the About Us section on the landing page.
 * A section title plus the body text. Paragraphs are separated by a blank line.
 *
 * Maps to a `website_contents` row: title and content (text) in the ERD.
 */

const LIMITS = { title: 40, content: 1500 };

type AboutUs = { title: string; content: string };

// Current landing page content.
const seedAbout: AboutUs = {
    title: 'About Us',
    content: [
        "Gr3at A's Events Styling & Services - specializes in event set-up and styling. We customize according to the needs of our clients. We supply rattan lamps, synthetic rattan furniture, drum furniture, upholstery, gigantic fabric and foam flowers, sticker decals, lighted signage, sublimation, tarp and sticker prints. We manufacture wood and steel structures with installation. We also supply plants for your greening projects.",
        "Gr3at A's is a company with a heart. We are committed to supporting the education of our scholars and selected charitable institutions.",
        "With Gr3at A's, graces are shared. Happy to serve!",
    ].join('\n\n'),
};

const toParagraphs = (text: string) =>
    text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);

export default function AboutUsEditor({ onSaved }: { onSaved?: () => void }) {
    const [saved, setSaved] = useState<AboutUs>(seedAbout);
    const [about, setAbout] = useState<AboutUs>(seedAbout);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [message, setMessage] = useState('');

    const dirty = JSON.stringify(about) !== JSON.stringify(saved);
    const paragraphs = toParagraphs(about.content);

    const change = (changes: Partial<AboutUs>) => {
        setAbout({ ...about, ...changes });
        setMessage('');
    };

    const save = () => {
        const e: Record<string, string> = {};
        if (!about.title.trim()) e.title = 'Section title is required.';
        if (!about.content.trim()) e.content = 'Content is required.';
        setErrors(e);
        if (Object.keys(e).length) return;

        setSaved(about);
        setMessage('Changes saved');
        onSaved?.();
    };

    const reset = () => {
        setAbout(saved);
        setErrors({});
        setMessage('');
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-5">
                {/* Form */}
                <Panel>
                    <PanelHeader
                        title="About Us Content"
                        description="Introduce the company below the hero section"
                        icon={<Info className="size-5" />}
                    />

                    <div className="space-y-4">
                        <Field label="Section title" htmlFor="about-title" required error={errors.title}>
                            <input
                                id="about-title"
                                className={inputClass}
                                maxLength={LIMITS.title}
                                value={about.title}
                                onChange={(e) => change({ title: e.target.value })}
                            />
                            <span className="text-right text-[11px] text-ink-soft">
                                {about.title.length}/{LIMITS.title}
                            </span>
                        </Field>

                        <Field label="Content" htmlFor="about-content" required error={errors.content}>
                            <textarea
                                id="about-content"
                                className={cn(textareaClass, 'field-sizing-content')}
                                rows={10}
                                style={{ minHeight: 'clamp(14rem, 45vh, 32rem)' }}
                                maxLength={LIMITS.content}
                                value={about.content}
                                onChange={(e) => change({ content: e.target.value })}
                            />
                            <div className="flex items-center justify-between text-[11px] text-ink-soft">
                                <span>Leave a blank line between paragraphs.</span>
                                <span>
                                    {about.content.length}/{LIMITS.content}
                                </span>
                            </div>
                        </Field>
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
