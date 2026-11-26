import { router } from '@inertiajs/react';
import { Check, Info, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Field, GoldButton, OutlineButton, Panel, textareaClass } from '@/components/dashboard/ui';
import { BASE_URL } from '@/components/technical-admin/website-photos';
import { cn } from '@/lib/utils';

/*
 * Our Services: the descriptions of the three service cards.
 * The section title and the card titles are fixed: they match the menu and
 * the three service pages the cards link to. A minimum and a maximum keep the
 * three cards about the same height.
 */

const LIMITS = { min: 50, max: 110 };

type Card = { title: string; description: string };
export type OurServices = { cards: Card[] };

const oneLine = (text: string) => text.replace(/\s*[\r\n]+\s*/g, ' ');

export default function OurServicesEditor({ services }: { services: OurServices }) {
    const [saved, setSaved] = useState<Card[]>(services.cards);
    const [cards, setCards] = useState<Card[]>(services.cards);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const dirty = JSON.stringify(cards) !== JSON.stringify(saved);

    const setDescription = (index: number, description: string) => {
        setCards(cards.map((c, i) => (i === index ? { ...c, description } : c)));
        setMessage('');
    };

    const save = () => {
        const e: Record<string, string> = {};
        cards.forEach((c, i) => {
            const length = c.description.trim().length;
            if (!length) e[`cards.${i}.description`] = 'Card description is required.';
            else if (length < LIMITS.min) e[`cards.${i}.description`] = `Write at least ${LIMITS.min} characters so the three cards stay balanced.`;
        });
        setErrors(e);
        if (Object.keys(e).length) return;

        router.put(
            `${BASE_URL}/services`,
            { cards: cards.map((c) => ({ description: c.description })) },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => {
                    setSaved(cards);
                    setMessage('Changes saved');
                },
                onError: (serverErrors) => setErrors(serverErrors),
            },
        );
    };

    const reset = () => {
        setCards(saved);
        setErrors({});
        setMessage('');
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-3">
                {cards.map((card, i) => {
                    const length = card.description.length;
                    return (
                        <Panel key={i}>
                            <div className="mb-4 flex items-center gap-3">
                                <span className="flex size-7 items-center justify-center rounded-full bg-gold text-xs font-bold text-white">{i + 1}</span>
                                <h2 className="text-base font-bold text-ink">{card.title}</h2>
                            </div>
                            <Field label="Description" htmlFor={`card-text-${i}`} required error={errors[`cards.${i}.description`] ?? errors.cards}>
                                <textarea
                                    id={`card-text-${i}`}
                                    className={cn(textareaClass, 'min-h-28 resize-none')}
                                    maxLength={LIMITS.max}
                                    value={card.description}
                                    onChange={(e) => setDescription(i, oneLine(e.target.value))}
                                    onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                />
                                <span className={cn('text-right text-[11px]', length > 0 && length < LIMITS.min ? 'text-yellow-800' : 'text-ink-soft')}>
                                    {length}/{LIMITS.max} · at least {LIMITS.min}
                                </span>
                            </Field>
                        </Panel>
                    );
                })}
            </div>

            <p className="flex items-start gap-2 rounded-lg bg-gold/10 p-3 text-xs text-ink-soft">
                <Info className="mt-0.5 size-4 shrink-0 text-gold-dark" />
                The section title and the card titles are fixed. They match the menu and the three service pages the cards open. The services
                customers can request are managed under Services &amp; Assets.
            </p>

            <div className="flex flex-wrap items-center justify-end gap-3">
                {message && <span className="text-xs font-semibold text-green-700">{message}</span>}
                {dirty && !message && <span className="text-xs text-ink-soft">You have unsaved changes</span>}
                <OutlineButton onClick={reset} disabled={!dirty}>
                    <RotateCcw className="size-4" /> Reset
                </OutlineButton>
                <GoldButton onClick={save} disabled={!dirty || saving}>
                    <Check className="size-4" /> Save Changes
                </GoldButton>
            </div>
        </div>
    );
}
