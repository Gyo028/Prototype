import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
    Field,
    GoldButton,
    OutlineButton,
    Panel,
    cx,
    inputClass,
    textareaClass,
} from '@/components/dashboard/ui';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { faqs as landingPageFaqs } from '@/data/faqs';
import type { Faq } from '@/data/faqs';

/*
 * Editor for the FAQ page. Each entry maps to a row of `website_contents`
 * in the ERD with section = 'faq': title (the question, max 150 characters),
 * content (the answer) and sort_order (position in the list).
 *
 * Add and edit happen in a modal. Add, edit, delete and reorder apply to the
 * list right away; publishing them to the public site is done from the main
 * Website Content screen.
 */

const QUESTION_MAX = 150;
const PAGE_SIZE = 2;

const emptyForm = { question: '', answer: '' };

/* Icon-only button with an accessible name and a tooltip */
function IconButton({
    label,
    onClick,
    disabled,
    tone = 'plain',
    children,
}: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    tone?: 'plain' | 'gold' | 'danger';
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className={cx(
                'inline-flex size-9 items-center justify-center rounded-lg border transition disabled:opacity-30',
                tone === 'plain' && 'border-black/15 bg-white text-ink hover:bg-black/5',
                tone === 'gold' && 'border-gold bg-gold text-white hover:bg-gold-dark',
                tone === 'danger' && 'border-red-500 bg-red-100 text-red-700 hover:bg-red-200',
            )}
        >
            {children}
        </button>
    );
}

export default function FaqEditor({ onSaved }: { onSaved?: () => void }) {
    const [faqs, setFaqs] = useState<Faq[]>(landingPageFaqs);
    const [page, setPage] = useState(1);

    // Add / edit modal
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const pages = Math.max(1, Math.ceil(faqs.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const start = (current - 1) * PAGE_SIZE;
    const visible = faqs.slice(start, start + PAGE_SIZE);

    const commit = (next: Faq[]) => {
        setFaqs(next);
        onSaved?.();
    };

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyForm);
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (f: Faq) => {
        setEditingId(f.id);
        setForm({ question: f.question, answer: f.answer });
        setErrors({});
        setDialogOpen(true);
    };

    const save = () => {
        const e: Record<string, string> = {};
        if (!form.question.trim()) e.question = 'Question is required.';
        if (!form.answer.trim()) e.answer = 'Answer is required.';
        setErrors(e);
        if (Object.keys(e).length) return;

        const data = { question: form.question.trim(), answer: form.answer.trim() };
        if (editingId === null) {
            commit([...faqs, { id: Date.now(), ...data }]);
            setPage(Math.ceil((faqs.length + 1) / PAGE_SIZE)); // jump to the new entry
        } else {
            commit(faqs.map((f) => (f.id === editingId ? { ...f, ...data } : f)));
        }
        setDialogOpen(false);
    };

    const remove = (f: Faq) => {
        if (!confirm('Delete this FAQ?')) return;
        commit(faqs.filter((x) => x.id !== f.id));
    };

    // Moving an entry can push it onto another page, so the view follows it
    const move = (id: number, direction: -1 | 1) => {
        const index = faqs.findIndex((f) => f.id === id);
        const target = index + direction;
        if (target < 0 || target >= faqs.length) return;
        const next = [...faqs];
        [next[index], next[target]] = [next[target], next[index]];
        commit(next);
        setPage(Math.floor(target / PAGE_SIZE) + 1);
    };

    return (
        <div className="space-y-4">
            {/* Header row: entry count and the Add button (upper right) */}
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">
                    {faqs.length} {faqs.length === 1 ? 'entry' : 'entries'}
                </p>
                <GoldButton onClick={openAdd}>
                    <Plus className="size-4" />
                    Add New FAQs
                </GoldButton>
            </div>

            {/* FAQ cards (two per page) */}
            {visible.map((f) => {
                const index = faqs.findIndex((x) => x.id === f.id);
                return (
                    <Panel key={f.id} className="p-5">
                        <div className="flex items-start gap-3">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold text-white">
                                {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-ink">{f.question}</p>
                                <p className="mt-2 text-xs leading-relaxed text-ink-soft">{f.answer}</p>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                            <div className="flex gap-2">
                                <IconButton label="Move up" disabled={index === 0} onClick={() => move(f.id, -1)}>
                                    <ArrowUp className="size-4" />
                                </IconButton>
                                <IconButton
                                    label="Move down"
                                    disabled={index === faqs.length - 1}
                                    onClick={() => move(f.id, 1)}
                                >
                                    <ArrowDown className="size-4" />
                                </IconButton>
                            </div>
                            <div className="flex gap-2">
                                <IconButton label="Edit FAQ" tone="gold" onClick={() => openEdit(f)}>
                                    <Pencil className="size-4" />
                                </IconButton>
                                <IconButton label="Delete FAQ" tone="danger" onClick={() => remove(f)}>
                                    <Trash2 className="size-4" />
                                </IconButton>
                            </div>
                        </div>
                    </Panel>
                );
            })}

            {faqs.length === 0 && (
                <Panel className="p-8 text-center text-sm text-ink-soft">
                    No FAQs yet. Use the + button to add the first one.
                </Panel>
            )}

            {/* Pagination */}
            {faqs.length > 0 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-ink-soft">
                        Showing {start + 1}–{Math.min(start + PAGE_SIZE, faqs.length)} of {faqs.length}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            aria-label="Previous page"
                            disabled={current === 1}
                            onClick={() => setPage(current - 1)}
                            className="rounded border border-black/15 bg-white p-1.5 disabled:opacity-40"
                        >
                            <ChevronLeft className="size-4" />
                        </button>
                        {Array.from({ length: pages }).map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Page ${i + 1}`}
                                onClick={() => setPage(i + 1)}
                                className={cx(
                                    'size-8 rounded border text-xs font-bold',
                                    current === i + 1 ? 'border-gold bg-gold text-white' : 'border-black/15 bg-white',
                                )}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            type="button"
                            aria-label="Next page"
                            disabled={current === pages}
                            onClick={() => setPage(current + 1)}
                            className="rounded border border-black/15 bg-white p-1.5 disabled:opacity-40"
                        >
                            <ChevronRight className="size-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Add / edit modal */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingId === null ? 'Add FAQ' : 'Edit FAQ'}</DialogTitle>
                        <DialogDescription>Create or update a question and answer entry.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Field label="Question" htmlFor="faq-question" required error={errors.question}>
                            <input
                                id="faq-question"
                                className={inputClass}
                                maxLength={QUESTION_MAX}
                                value={form.question}
                                onChange={(e) => setForm({ ...form, question: e.target.value })}
                            />
                            <span className="text-right text-[11px] text-ink-soft">
                                {form.question.length}/{QUESTION_MAX}
                            </span>
                        </Field>
                        <Field label="Answer" htmlFor="faq-answer" required error={errors.answer}>
                            <textarea
                                id="faq-answer"
                                className={cx(textareaClass, 'min-h-40')}
                                value={form.answer}
                                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                            />
                        </Field>
                    </div>

                    <DialogFooter>
                        <OutlineButton onClick={() => setDialogOpen(false)}>Cancel</OutlineButton>
                        <GoldButton onClick={save}>
                            <Check className="size-4" /> Save
                        </GoldButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
