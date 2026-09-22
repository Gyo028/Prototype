import { Check, Layers, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Field, GoldButton, OutlineButton, Panel, PanelHeader, inputClass, textareaClass } from '@/components/dashboard/ui';
import { cn } from '@/lib/utils';

/*
 * Editor for the Our Services section on the landing page: a section title,
 * an optional intro line, and the three service cards shown under it.
 *
 * Maps to `website_contents` rows with section = 'services' in the ERD
 * (title and content for the heading, and one row per card).
 *
 * These cards are a short introduction to the service areas. The individual
 * services customers can select, and their prices, are managed under
 * Services & Assets.
 */

const LIMITS = { title: 40, intro: 200, cardTitle: 40, cardText: 150 };

type Card = { title: string; description: string };
type OurServices = { title: string; intro: string; cards: Card[] };

// Current landing page content.
const seedServices: OurServices = {
    title: 'Our Services',
    intro: '',
    cards: [
        { title: 'Corporate Events', description: 'Professional styling and management for brand activations, mall events, and corporate functions.' },
        { title: 'Special Occasions', description: 'Creative setups for weddings, birthdays, debuts, and milestone celebrations.' },
        { title: 'Custom Fabrication', description: 'Design and production of customized backdrops, props, and themed event structures.' },
    ],
};

function Counter({ value, max }: { value: string; max: number }) {
    return (
        <span className="text-right text-[11px] text-ink-soft">
            {value.length}/{max}
        </span>
    );
}

export default function OurServicesEditor({ onSaved }: { onSaved?: () => void }) {
    const [saved, setSaved] = useState<OurServices>(seedServices);
    const [data, setData] = useState<OurServices>(seedServices);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [message, setMessage] = useState('');

    const dirty = JSON.stringify(data) !== JSON.stringify(saved);

    const change = (next: OurServices) => {
        setData(next);
        setMessage('');
    };

    const setCard = (index: number, changes: Partial<Card>) =>
        change({ ...data, cards: data.cards.map((c, i) => (i === index ? { ...c, ...changes } : c)) });

    const save = () => {
        const e: Record<string, string> = {};
        if (!data.title.trim()) e.title = 'Section title is required.';
        data.cards.forEach((c, i) => {
            if (!c.title.trim()) e[`title-${i}`] = 'Card title is required.';
            if (!c.description.trim()) e[`description-${i}`] = 'Card description is required.';
        });
        setErrors(e);
        if (Object.keys(e).length) return;

        setSaved(data);
        setMessage('Changes saved');
        onSaved?.();
    };

    const reset = () => {
        setData(saved);
        setErrors({});
        setMessage('');
    };

    return (
        <div className="space-y-5">
            <div>
                {/* Form */}
                <div className="space-y-5">
                    <Panel>
                        <PanelHeader
                            title="Section Heading"
                            description="The title shown above the service cards"
                            icon={<Layers className="size-5" />}
                        />
                        <div className="space-y-4">
                            <Field label="Section title" htmlFor="svc-title" required error={errors.title}>
                                <input
                                    id="svc-title"
                                    className={inputClass}
                                    maxLength={LIMITS.title}
                                    value={data.title}
                                    onChange={(e) => change({ ...data, title: e.target.value })}
                                />
                                <Counter value={data.title} max={LIMITS.title} />
                            </Field>
                            <Field label="Intro line (optional)" htmlFor="svc-intro">
                                <input
                                    id="svc-intro"
                                    className={inputClass}
                                    maxLength={LIMITS.intro}
                                    value={data.intro}
                                    onChange={(e) => change({ ...data, intro: e.target.value })}
                                />
                                <Counter value={data.intro} max={LIMITS.intro} />
                            </Field>
                        </div>
                    </Panel>

                    <div className="grid gap-5 lg:grid-cols-3">
                    {data.cards.map((card, i) => (
                        <Panel key={i}>
                            <div className="mb-4 flex items-center gap-3">
                                <span className="flex size-7 items-center justify-center rounded-full bg-gold text-xs font-bold text-white">
                                    {i + 1}
                                </span>
                                <h2 className="text-base font-bold text-ink">Card {i + 1}</h2>
                            </div>
                            <div className="space-y-4">
                                <Field label="Title" htmlFor={`card-title-${i}`} required error={errors[`title-${i}`]}>
                                    <input
                                        id={`card-title-${i}`}
                                        className={inputClass}
                                        maxLength={LIMITS.cardTitle}
                                        value={card.title}
                                        onChange={(e) => setCard(i, { title: e.target.value })}
                                    />
                                    <Counter value={card.title} max={LIMITS.cardTitle} />
                                </Field>
                                <Field label="Description" htmlFor={`card-text-${i}`} required error={errors[`description-${i}`]}>
                                    <textarea
                                        id={`card-text-${i}`}
                                        className={cn(textareaClass, 'min-h-28')}
                                        maxLength={LIMITS.cardText}
                                        value={card.description}
                                        onChange={(e) => setCard(i, { description: e.target.value })}
                                    />
                                    <Counter value={card.description} max={LIMITS.cardText} />
                                </Field>
                            </div>
                        </Panel>
                    ))}
                    </div>
                </div>
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
