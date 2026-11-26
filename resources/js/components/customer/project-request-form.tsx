import { Link, router } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, FileText, ImageIcon, Plus, Sparkles, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import DatePicker, { formatRange } from '@/components/customer/date-picker';
import type { RequestCatalog, RequestType } from '@/components/customer/request-catalog';
import { defaultThemeFor, peso, themeFits, toISODate } from '@/components/customer/request-catalog';
import type { LayoutChoice } from '@/components/customer/layout-selection';
import { EMPTY_LAYOUT_CHOICE } from '@/components/customer/layout-selection';
import ServicesAssetsSelector from '@/components/customer/services-assets-selector';
import { Field, GoldButton, OutlineButton, Panel, cx, inputClass, selectClass, textareaClass } from '@/components/dashboard/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/*
 * Customer > Request New Project.
 *
 * First the customer picks the request type:
 *  - Standard Event Styling: Project Details → Services & Assets → Description & Files
 *  - Custom Project:         Details & Files (one page), then a summary modal to confirm
 * The browser checks the same rules as the server (ServiceRequestRequest),
 * and the server's messages are shown on the matching fields if it disagrees.
 */

const SUBMIT_URL = '/customer/new-request';

// Time slots from 6:00 AM to 11:30 PM, every 30 minutes.
const TIME_SLOTS = Array.from({ length: 36 }, (_, i) => {
    const total = 6 * 60 + i * 30;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return {
        value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        label: `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`,
        minutes: total,
    };
});

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

const toMinutes = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
};

const monthsFromTodayISO = (months: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + months);
    return toISODate(d);
};

/** Days from the first to the last day, counting both. */
const spanDays = (start: string, end: string) => {
    const [ys, ms, ds] = start.split('-').map(Number);
    const [ye, me, de] = end.split('-').map(Number);
    return Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86_400_000) + 1;
};

const longDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

type Step = 'type' | 'details' | 'selection' | 'extras' | 'done';

type Form = {
    // standard
    eventTypeId: string;
    eventDate: string;
    eventStartTime: string;
    eventEndTime: string;
    guests: string;
    // custom
    projectTitle: string;
    /** One date or a run of several days; one day keeps the end date equal to the start date. */
    dayMode: 'one' | 'multi';
    startDate: string;
    endDate: string;
    // both
    venue: string;
    /** A range label, or 'exact' with the amount in budgetExact. */
    budget: string;
    budgetExact: string;
    description: string;
};

const EMPTY_FORM: Form = {
    eventTypeId: '',
    eventDate: '',
    eventStartTime: '',
    eventEndTime: '',
    guests: '',
    projectTitle: '',
    dayMode: 'one',
    startDate: '',
    endDate: '',
    venue: '',
    budget: '',
    budgetExact: '',
    description: '',
};

/** The budget choice for an amount the customer types. */
const EXACT = 'exact';

type RefFile = { id: number; file: File; url?: string };

const STEPS: Record<RequestType, { step: Step; label: string }[]> = {
    standard: [
        { step: 'type', label: 'Request Type' },
        { step: 'details', label: 'Project Details' },
        { step: 'selection', label: 'Services & Assets' },
        { step: 'extras', label: 'Description & Files' },
    ],
    custom: [
        { step: 'type', label: 'Request Type' },
        { step: 'details', label: 'Details & Files' },
    ],
};

function StepIndicator({ type, current }: { type: RequestType; current: Step }) {
    const steps = STEPS[type];
    const currentIndex = steps.findIndex((s) => s.step === current);

    return (
        <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {steps.map((s, i) => (
                <li key={s.step} className="flex items-center gap-2">
                    <span
                        className={cx(
                            'inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold',
                            i < currentIndex && 'bg-gold text-white',
                            i === currentIndex && 'border-2 border-gold text-gold-dark',
                            i > currentIndex && 'border border-black/20 text-ink-soft',
                        )}
                    >
                        {i + 1}
                    </span>
                    <span className={i === currentIndex ? 'font-bold text-ink' : 'text-ink-soft'}>{s.label}</span>
                    {i < steps.length - 1 && <span className="text-ink-soft">›</span>}
                </li>
            ))}
        </ol>
    );
}

function TypeCard({
    icon: Icon,
    title,
    text,
    note,
    onClick,
}: {
    icon: LucideIcon;
    title: string;
    text: string;
    note: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex h-full flex-col gap-3 rounded-2xl border border-black/15 bg-white p-6 text-left transition hover:border-gold hover:bg-gold/5"
        >
            <span className="inline-flex size-11 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
                <Icon className="size-6" />
            </span>
            <span className="text-lg font-bold text-ink">{title}</span>
            <span className="text-sm text-ink-soft">{text}</span>
            <span className="mt-auto text-xs font-bold text-gold-dark">{note}</span>
        </button>
    );
}

export default function ProjectRequestForm({ catalog }: { catalog: RequestCatalog }) {
    const { eventTypes, budgetRanges, profileMissing } = catalog;
    // Falls back to 30 days if the page props don't carry the limit yet.
    const limits = {
        ...catalog.limits,
        maxProjectDays: catalog.limits.maxProjectDays ?? 30,
        customLeadMonths: catalog.limits.customLeadMonths ?? 2,
    };

    const [step, setStep] = useState<Step>('type');
    const [requestType, setRequestType] = useState<RequestType | null>(null);
    const [form, setForm] = useState<Form>(EMPTY_FORM);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [serviceIds, setServiceIds] = useState<number[]>([]);
    const [themeId, setThemeIdState] = useState<number | null>(null);
    const [layoutChoice, setLayoutChoice] = useState<LayoutChoice>(EMPTY_LAYOUT_CHOICE);

    /** Another theme starts with its own default set ticked; "Other" items stay. */
    const setThemeId = (id: number | null) => {
        if (id === themeId) return;
        setThemeIdState(id);
        setLayoutChoice((c) => ({ ...c, assetIds: null }));
        clearErrors('layout');
    };

    const changeLayout = (choice: LayoutChoice) => {
        setLayoutChoice(choice);
        clearErrors('layout');
    };

    const fileRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<RefFile[]>([]);
    const [fileError, setFileError] = useState('');
    const [dragging, setDragging] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    // Custom projects: the summary modal shown before the request is sent.
    const [reviewOpen, setReviewOpen] = useState(false);
    const [profileError, setProfileError] = useState('');

    const isCustom = requestType === 'custom';
    const minEventDate = monthsFromTodayISO(limits.minLeadMonths);
    const minCustomDate = monthsFromTodayISO(limits.customLeadMonths);
    const customLeadText = plural(limits.customLeadMonths, 'month');
    const budgets = requestType ? budgetRanges[requestType] : [];
    /** The budget as the customer chose it: a range label, or the exact amount ("₱180,000"). */
    const budgetText = form.budget === EXACT ? (Number(form.budgetExact) > 0 ? peso(Number(form.budgetExact)) : '') : form.budget;

    /** Removes the messages of fields the customer has just changed. */
    const clearErrors = (...keys: string[]) =>
        setErrors((prev) => {
            if (!keys.some((k) => k in prev)) return prev;
            const next = { ...prev };
            keys.forEach((k) => delete next[k]);
            return next;
        });

    const set = <K extends keyof Form>(key: K, value: Form[K]) => {
        setForm((f) => ({ ...f, [key]: value }));
        clearErrors(
            key,
            ...(key === 'eventStartTime' || key === 'eventEndTime' ? ['eventTime'] : []),
            ...(key === 'budget' || key === 'budgetExact' ? ['budget', 'budgetExact'] : []),
        );
    };

    const chooseDayMode = (mode: 'one' | 'multi') => {
        setForm((f) => ({ ...f, dayMode: mode, endDate: mode === 'one' ? f.startDate : '' }));
        setErrors((prev) => {
            const next = { ...prev };
            delete next.startDate;
            delete next.endDate;
            return next;
        });
    };

    const goTo = (next: Step) => {
        setStep(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    /** Shows the errors and scrolls to the first one. Returns true when there are none. */
    const check = (e: Record<string, string>) => {
        setErrors(e);
        if (Object.keys(e).length === 0) return true;
        setTimeout(() => document.querySelector('[data-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
        return false;
    };

    /* ---------------- Step 1: request type ---------------- */

    const chooseType = (type: RequestType) => {
        setRequestType(type);
        // Keep what both types share; drop a budget the new type does not offer.
        setForm((f) => ({ ...f, budget: f.budget === EXACT || budgetRanges[type].includes(f.budget) ? f.budget : '' }));
        setErrors({});
        goTo('details');
    };

    /* ---------------- Step 2: project details ---------------- */

    const chooseEventType = (id: string) => {
        set('eventTypeId', id);
        // A theme belongs to one event type, so a theme for another type is cleared.
        const theme = catalog.themes.find((t) => t.id === themeId);
        if (theme && String(theme.eventTypeId) !== id) setThemeId(null);
    };

    const lastSlotMinutes = TIME_SLOTS[TIME_SLOTS.length - 1].minutes;
    const startSlots = TIME_SLOTS.filter((t) => t.minutes + limits.minEventHours * 60 <= lastSlotMinutes);
    const endSlots = form.eventStartTime ? TIME_SLOTS.filter((t) => t.minutes >= toMinutes(form.eventStartTime) + limits.minEventHours * 60) : [];

    /** Checks the Project Details fields; shows the errors and returns false if any. */
    const validateDetails = () => {
        const e: Record<string, string> = {};

        if (!form.venue.trim()) e.venue = isCustom ? 'Venue or mall location is required.' : 'Venue is required.';
        if (!form.budget) e.budget = 'Choose a budget range, or enter an exact amount.';
        else if (form.budget === EXACT) {
            const amount = Number(form.budgetExact);
            const min = limits.minExactBudget?.[isCustom ? 'custom' : 'standard'] ?? 0;
            if (!form.budgetExact || !Number.isFinite(amount)) e.budgetExact = 'Enter your exact budget.';
            else if (amount < min) e.budgetExact = `Your exact budget must be at least ${peso(min)}.`;
            else if (!/^\d+(\.\d{1,2})?$/.test(form.budgetExact)) e.budgetExact = 'Use at most two decimal places.';
        }

        if (isCustom) {
            if (!form.projectTitle.trim()) e.projectTitle = 'Enter a project title.';
            if (form.dayMode === 'one') {
                if (!form.startDate) e.startDate = 'Choose the project date.';
                else if (form.startDate < minCustomDate) e.startDate = `The project date must be at least ${customLeadText} from today.`;
            } else {
                if (!form.startDate) e.startDate = 'Choose the first day.';
                else if (form.startDate < minCustomDate) e.startDate = `The first day must be at least ${customLeadText} from today.`;
                else if (!form.endDate) e.endDate = 'Now choose the last day, or switch to One day.';
                else if (spanDays(form.startDate, form.endDate) < 2) e.endDate = 'Multiple days needs at least 2 days.';
                else if (spanDays(form.startDate, form.endDate) > limits.maxProjectDays)
                    e.endDate = `A custom project can run up to ${plural(limits.maxProjectDays, 'day')}.`;
            }
        } else {
            if (!form.eventTypeId) e.eventTypeId = 'Choose an event type.';
            if (!form.eventDate) e.eventDate = 'Choose the event date.';
            else if (form.eventDate < minEventDate) e.eventDate = `The event date must be at least ${plural(limits.minLeadMonths, 'month')} from today.`;
            if (!form.eventStartTime) e.eventTime = 'Choose the start time.';
            else if (!form.eventEndTime) e.eventTime = 'Choose the end time.';
            else if (toMinutes(form.eventEndTime) - toMinutes(form.eventStartTime) < limits.minEventHours * 60)
                e.eventTime = `The event must run at least ${plural(limits.minEventHours, 'hour')}.`;
            if (!form.guests || Number(form.guests) < 1) e.guests = 'Enter the expected number of guests.';
        }

        return check(e);
    };

    const continueFromDetails = () => {
        if (!validateDetails()) return;

        if (!isCustom) {
            // Start with the event type's default theme, unless the chosen one still suits.
            const eventTypeId = Number(form.eventTypeId);
            const guests = Number(form.guests);
            const current = catalog.themes.find((t) => t.id === themeId);
            if (!current || current.eventTypeId !== eventTypeId || !themeFits(current, guests)) {
                setThemeId(defaultThemeFor(catalog.themes, eventTypeId, guests)?.id ?? null);
            }
        }

        goTo('selection');
    };

    /** Custom projects: check the page, then show the summary to confirm. */
    const reviewCustom = () => {
        if (validateDetails()) setReviewOpen(true);
    };

    /* ---------------- Step 3 (standard): services & assets ---------------- */

    // Nothing is required here: the Event Styling fee always counts, and an untouched layout is the theme's default set.
    const continueFromSelection = () => {
        if (check({})) goTo('extras');
    };

    /* ---------------- Last step: description & files ---------------- */

    const addFiles = (list: FileList | File[]) => {
        const problems: string[] = [];
        const accepted: RefFile[] = [];

        for (const file of Array.from(list)) {
            if (!ALLOWED_FILE_TYPES.includes(file.type) || file.size > limits.maxFileMb * 1024 * 1024) {
                problems.push(`${file.name}: only JPG, PNG or PDF up to ${limits.maxFileMb} MB.`);
            } else if (files.length + accepted.length >= limits.maxFiles) {
                problems.push(`You can upload up to ${limits.maxFiles} files. "${file.name}" was not added.`);
            } else {
                accepted.push({
                    id: Date.now() + accepted.length,
                    file,
                    url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
                });
            }
        }

        setFileError(problems.join(' '));
        if (accepted.length) setFiles((f) => [...f, ...accepted]);
        if (fileRef.current) fileRef.current.value = '';
    };

    const removeFile = (id: number) => {
        const file = files.find((f) => f.id === id);
        if (file?.url) URL.revokeObjectURL(file.url);
        setFiles((list) => list.filter((f) => f.id !== id));
    };

    /** Puts each server message on its field and opens the step that has the first problem. */
    const applyServerErrors = (serverErrors: Record<string, string>) => {
        const e: Record<string, string> = {};
        const fileMessages: string[] = [];
        // Custom projects have every field on the details page.
        let target: Step = isCustom ? 'details' : 'extras';
        setReviewOpen(false);

        for (const [key, message] of Object.entries(serverErrors)) {
            if (key === 'profile') {
                setProfileError(message);
            } else if (key === 'files' || key.startsWith('files.')) {
                const index = Number(key.split('.')[1]);
                const name = Number.isInteger(index) ? files[index]?.file.name : undefined;
                fileMessages.push(name ? `${name}: ${message}` : message);
            } else if (key === 'description') {
                e.description = message;
            } else if (key === 'serviceIds' || key.startsWith('serviceIds.')) {
                e.services = message;
                if (target === 'extras') target = 'selection';
            } else if (['themeId', 'assetIds', 'customItems'].some((k) => key === k || key.startsWith(`${k}.`))) {
                e.layout = e.layout ?? message;
                if (target === 'extras') target = 'selection';
            } else if (key === 'eventStartTime' || key === 'eventEndTime') {
                e.eventTime = message;
                target = 'details';
            } else {
                e[key] = message;
                target = 'details';
            }
        }

        setFileError(fileMessages.join(' '));
        setErrors(e);
        if (target !== step) goTo(target);
    };

    const submit = () => {
        if (!requestType) return;
        setProfileError('');

        const shared = {
            requestType,
            venue: form.venue,
            budget: form.budget,
            budgetExact: form.budget === EXACT ? form.budgetExact : '',
            description: form.description,
            files: files.map((f) => f.file),
        };

        const payload = isCustom
            ? { ...shared, projectTitle: form.projectTitle, startDate: form.startDate, endDate: form.endDate }
            : {
                  ...shared,
                  eventTypeId: form.eventTypeId,
                  eventDate: form.eventDate,
                  eventStartTime: form.eventStartTime,
                  eventEndTime: form.eventEndTime,
                  guests: form.guests,
                  serviceIds,
                  themeId: themeId ?? '',
                  // None ticked (or untouched) = the theme's default set, on the server as here.
                  assetIds: layoutChoice.assetIds ?? [],
                  customItems: layoutChoice.customItems.map(({ category, name, description }) => ({ category, name, description })),
              };

        router.post(SUBMIT_URL, payload, {
            forceFormData: true,
            preserveScroll: true,
            preserveState: true,
            onStart: () => setSubmitting(true),
            onFinish: () => setSubmitting(false),
            onSuccess: () => {
                setReviewOpen(false);
                goTo('done');
            },
            onError: (serverErrors: Record<string, string>) => applyServerErrors(serverErrors),
        });
    };

    const startOver = () => {
        files.forEach((f) => f.url && URL.revokeObjectURL(f.url));
        setForm(EMPTY_FORM);
        setRequestType(null);
        setServiceIds([]);
        setThemeIdState(null);
        setLayoutChoice(EMPTY_LAYOUT_CHOICE);
        setFiles([]);
        setErrors({});
        setFileError('');
        setProfileError('');
        goTo('type');
    };

    /* ---------------- Shared pieces ---------------- */

    const header = (
        <div className="mb-6">
            <h1 className="text-2xl font-bold text-ink">Request New Project</h1>
            <p className="mt-1 text-base text-ink-soft">Tell us about your project. Our Project Manager reviews every request.</p>
            {requestType && step !== 'type' && <StepIndicator type={requestType} current={step} />}
            {(profileMissing || profileError) && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <p>{profileError || 'Your customer profile is missing, so a request cannot be submitted yet. Please contact us for help.'}</p>
                </div>
            )}
        </div>
    );

    const backButton = (label: string, to: Step) => (
        <button type="button" onClick={() => goTo(to)} className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-gold-dark hover:underline">
            <ArrowLeft className="size-3.5" /> {label}
        </button>
    );

    const fixFieldsNote = Object.keys(errors).length > 0 && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Please fix the highlighted fields before continuing.</p>
    );

    const choiceButton = (on: boolean) =>
        cx('rounded-lg border p-2.5 text-left text-sm font-bold text-ink transition', on ? 'border-gold bg-gold/10' : 'border-black/15 hover:bg-black/[0.02]');

    // Budget choices stay on one line, even on phones: smaller text and no wrapping.
    const budgetButton = (on: boolean) =>
        cx(
            'rounded-lg border px-2.5 py-2.5 text-left text-xs font-bold whitespace-nowrap text-ink tabular-nums transition sm:text-sm',
            on ? 'border-gold bg-gold/10' : 'border-black/15 hover:bg-black/[0.02]',
        );

    const exactMin = limits.minExactBudget?.[isCustom ? 'custom' : 'standard'] ?? 0;

    const budgetField = (
        <Field label="Budget" required error={errors.budget}>
            <div data-error={errors.budget ? '' : undefined} className="grid grid-cols-2 gap-2">
                {budgets.map((b) => (
                    <button key={b} type="button" aria-pressed={form.budget === b} onClick={() => set('budget', b)} className={budgetButton(form.budget === b)}>
                        {b}
                    </button>
                ))}
                <button
                    type="button"
                    aria-pressed={form.budget === EXACT}
                    onClick={() => set('budget', EXACT)}
                    className={cx(budgetButton(form.budget === EXACT), form.budget !== EXACT && 'border-dashed')}
                >
                    Enter exact amount
                </button>
            </div>

            {form.budget === EXACT && (
                <div className="mt-2" data-error={errors.budgetExact ? '' : undefined}>
                    <label htmlFor="pr-budget-exact" className="text-xs text-ink-soft">
                        Your exact budget (at least {peso(exactMin)})
                    </label>
                    <div className="relative mt-1">
                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-soft">₱</span>
                        <input
                            id="pr-budget-exact"
                            type="number"
                            inputMode="decimal"
                            min={exactMin}
                            step="0.01"
                            className={cx(inputClass, 'pl-7', errors.budgetExact && 'border-red-400')}
                            placeholder={String(exactMin * 2)}
                            value={form.budgetExact}
                            onChange={(e) => set('budgetExact', e.target.value)}
                        />
                    </div>
                    {errors.budgetExact && <p className="mt-1 text-xs text-red-600">{errors.budgetExact}</p>}
                </div>
            )}
        </Field>
    );

    const descriptionField = (
        <Field label="Project Description" htmlFor="pr-desc" error={errors.description}>
            <textarea
                id="pr-desc"
                className={cx(textareaClass, 'min-h-32')}
                maxLength={5000}
                placeholder={
                    isCustom
                        ? 'Describe the concept, the size of the space, and anything our team should know.'
                        : 'Describe the mood, theme, must-haves and anything specific you want our team to know.'
                }
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
            />
        </Field>
    );

    /** Reference files: the drop area and the thumbnails. `compact` puts a narrow drop area beside the thumbnails. */
    /**
     * Reference files: the "+" tile comes first, and each upload fills the next
     * tile. The whole grid takes dropped files too. Empty tiles show how many
     * more can go in a row.
     */
    const renderFiles = (compact: boolean) => {
        const perRow = compact ? 3 : 4;
        const canAdd = files.length < limits.maxFiles;
        const used = files.length + (canAdd ? 1 : 0);
        // Fill the first row, then the rest of the last row; none once the limit is reached.
        const empty = canAdd ? Math.max(perRow - used, (perRow - (used % perRow)) % perRow) : 0;

        return (
            <>
                <p className="text-sm font-bold text-ink">Upload Peg / Reference Images</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">
                    JPG, PNG or PDF up to {limits.maxFileMb}MB each · Max {limits.maxFiles} files. Tap + or drop files here.
                </p>
                <input
                    ref={fileRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    multiple
                    hidden
                    onChange={(e) => e.target.files && addFiles(e.target.files)}
                />

                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        addFiles(e.dataTransfer.files);
                    }}
                    className={cx(
                        'mt-3 grid gap-2 rounded-xl transition sm:gap-3',
                        compact ? 'grid-cols-3' : 'grid-cols-4',
                        dragging && 'bg-gold/10 ring-2 ring-gold ring-offset-4',
                    )}
                >
                    {canAdd && (
                        <button
                            type="button"
                            aria-label="Add reference files"
                            onClick={() => fileRef.current?.click()}
                            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-black/20 bg-white text-ink-soft transition hover:border-gold hover:text-gold-dark"
                        >
                            <Plus className="size-7 sm:size-8" />
                            <span className="text-[10px] font-bold sm:text-xs">Add files</span>
                        </button>
                    )}

                    {files.map((f) => (
                        <div key={f.id} className="group relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-neutral-100">
                            {f.url ? (
                                <img src={f.url} alt={f.file.name} className="size-full object-cover" />
                            ) : (
                                <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-ink-soft">
                                    <FileText className="size-7 sm:size-8" />
                                    <span className="line-clamp-2 text-[10px] break-all">{f.file.name}</span>
                                </div>
                            )}
                            <button
                                type="button"
                                aria-label={`Remove ${f.file.name}`}
                                onClick={() => removeFile(f.id)}
                                className="absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    ))}

                    {Array.from({ length: empty }, (_, i) => (
                        <div key={`empty-${i}`} aria-hidden className="flex aspect-square items-center justify-center rounded-xl bg-neutral-200 text-neutral-400">
                            <ImageIcon className="size-7 sm:size-10" />
                        </div>
                    ))}
                </div>
                <p className="mt-2 text-[11px] text-ink-soft">
                    {files.length}/{limits.maxFiles} files
                </p>
                {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
            </>
        );
    };

    const venueField = (
        <Field label={isCustom ? 'Venue / Mall Location' : 'Venue / Location'} htmlFor="pr-venue" required error={errors.venue}>
            <input
                id="pr-venue"
                data-error={errors.venue ? '' : undefined}
                className={inputClass}
                maxLength={255}
                placeholder={isCustom ? 'Mall name and area, or exact address' : 'Venue name or exact address'}
                value={form.venue}
                onChange={(e) => set('venue', e.target.value)}
            />
        </Field>
    );

    /* ---------------- Screens ---------------- */

    if (step === 'done') {
        return (
            <Panel className="mx-auto max-w-2xl p-10 text-center">
                <CheckCircle2 className="mx-auto size-14 text-green-600" />
                <h1 className="mt-4 text-2xl font-bold text-ink">Request submitted</h1>
                <p className="mt-2 text-sm text-ink-soft">
                    Thank you! Your {isCustom ? 'custom project' : 'event styling'} request was sent to our Project Manager for review. You will be
                    notified once it is approved, and you can then schedule a consultation.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Link href="/customer" className="rounded-lg bg-gold px-5 py-2 text-sm font-bold text-white hover:bg-gold-dark">
                        Back to dashboard
                    </Link>
                    <OutlineButton className="px-5 py-2" onClick={startOver}>
                        Submit another request
                    </OutlineButton>
                </div>
            </Panel>
        );
    }

    if (step === 'type' || !requestType) {
        return (
            <>
                {header}
                <div className="mx-auto max-w-4xl">
                    <h2 className="mb-3 text-lg font-bold text-ink">What kind of project is this?</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <TypeCard
                            icon={Sparkles}
                            title="Standard Event Styling"
                            text="Weddings, birthdays, debuts and corporate events. Pick add-on services, a design theme and assets, and see an initial cost estimate right away."
                            note="One event date, with a start and end time"
                            onClick={() => chooseType('standard')}
                        />
                        <TypeCard
                            icon={Building2}
                            title="Custom Project"
                            text="Mall activations, mall area designs and other made-to-order set-ups. Describe the project and share references. We quote it with the design proposal."
                            note="Can run for several days"
                            onClick={() => chooseType('custom')}
                        />
                    </div>
                </div>
            </>
        );
    }

    if (step === 'selection' && !isCustom) {
        return (
            <>
                {header}
                <div className="w-full space-y-5">
                    <Panel>
                        <div className="mb-4 flex flex-col-reverse items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <h2 className="text-lg font-bold text-ink">Services &amp; Assets</h2>
                            {backButton('Back to Project Details', 'details')}
                        </div>

                        <ServicesAssetsSelector
                            baseFee={catalog.baseFee}
                            services={catalog.services}
                            themes={catalog.themes}
                            assets={catalog.assets}
                            assetCategories={catalog.assetCategories}
                            eventTypeId={form.eventTypeId ? Number(form.eventTypeId) : null}
                            guests={Number(form.guests) || 0}
                            budget={budgetText}
                            serviceIds={serviceIds}
                            onServiceIdsChange={setServiceIds}
                            themeId={themeId}
                            onThemeIdChange={setThemeId}
                            layoutChoice={layoutChoice}
                            onLayoutChoiceChange={changeLayout}
                            layoutError={errors.layout ?? errors.services}
                        />
                    </Panel>

                    {fixFieldsNote}

                    <div className="flex justify-end">
                        <GoldButton className="px-8 py-2.5" onClick={continueFromSelection}>
                            Continue
                        </GoldButton>
                    </div>
                </div>
            </>
        );
    }

    if (step === 'extras') {
        return (
            <>
                {header}
                <div className="w-full space-y-5">
                    <Panel>
                        <div className="mb-4 flex flex-col-reverse items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <h2 className="text-lg font-bold text-ink">Description &amp; Reference Files</h2>
                            {backButton('Back to Services & Assets', 'selection')}
                        </div>

                        {descriptionField}
                        <div className="mt-6 border-t border-black/10 pt-6">{renderFiles(false)}</div>
                    </Panel>

                    {fixFieldsNote}

                    <div className="flex justify-end">
                        <GoldButton className="px-8 py-2.5" onClick={submit} disabled={submitting || profileMissing}>
                            {submitting ? 'Submitting…' : 'Submit Request'}
                        </GoldButton>
                    </div>
                </div>
            </>
        );
    }

    /* ---------------- Project Details ---------------- */

    return (
        <>
            {/* Custom: the heading lines up with the capped panel below it. */}
            {isCustom ? <div className="mx-auto w-full max-w-6xl">{header}</div> : header}
            {/* Custom: wide but capped, so the text boxes don't stretch on large screens. */}
            <div className={cx('mx-auto space-y-4', isCustom ? 'w-full max-w-6xl' : 'max-w-4xl')}>
                <Panel>
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h2 className="text-lg font-bold text-ink">{isCustom ? 'Custom Project Details' : 'Project Details'}</h2>
                        {backButton('Change request type', 'type')}
                    </div>

                    {isCustom ? (
                        <>
                            {/* Wide form: details and files on the left (3/5), the calendar on the right (2/5). */}
                            <div className="grid gap-6 lg:grid-cols-5">
                                <div className="flex flex-col gap-5 lg:col-span-3">
                                    <Field label="Project Title" htmlFor="pr-title" required error={errors.projectTitle}>
                                        <input
                                            id="pr-title"
                                            data-error={errors.projectTitle ? '' : undefined}
                                            className={inputClass}
                                            maxLength={150}
                                            placeholder="e.g. Christmas display for the mall's main atrium"
                                            value={form.projectTitle}
                                            onChange={(e) => set('projectTitle', e.target.value)}
                                        />
                                    </Field>

                                    {venueField}
                                    {budgetField}
                                    {descriptionField}
                                    <div>{renderFiles(true)}</div>
                                </div>

                                <div className="flex flex-col gap-5 lg:col-span-2">
                                    <Field label="Project Dates" htmlFor="pr-start-date" required error={errors.startDate ?? errors.endDate}>
                                        <div role="radiogroup" aria-label="How long the project runs" className="mb-2 flex flex-wrap gap-2">
                                            {(
                                                [
                                                    ['one', 'One day'],
                                                    ['multi', 'Multiple days'],
                                                ] as const
                                            ).map(([mode, label]) => (
                                                <label
                                                    key={mode}
                                                    className={cx(
                                                        'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold text-ink transition',
                                                        form.dayMode === mode ? 'border-gold bg-gold/10' : 'border-black/15 hover:bg-black/[0.02]',
                                                    )}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="pr-day-mode"
                                                        className="accent-gold-dark"
                                                        checked={form.dayMode === mode}
                                                        onChange={() => chooseDayMode(mode)}
                                                    />
                                                    {label}
                                                </label>
                                            ))}
                                        </div>

                                        <div data-error={errors.startDate || errors.endDate ? '' : undefined}>
                                            {form.dayMode === 'one' ? (
                                                <DatePicker
                                                    id="pr-start-date"
                                                    value={form.startDate}
                                                    onChange={(iso) => {
                                                        setForm((f) => ({ ...f, startDate: iso, endDate: iso }));
                                                        clearErrors('startDate', 'endDate');
                                                    }}
                                                    minDate={minCustomDate}
                                                    leadMonths={limits.customLeadMonths}
                                                    disabledDates={[]} // a custom request is judged by the Project Manager, so no day is blocked here
                                                    hint={`Pick the day of the project, at least ${customLeadText} from today. The Project Manager confirms availability.`}
                                                    hasError={!!errors.startDate}
                                                />
                                            ) : (
                                                <DatePicker
                                                    id="pr-start-date"
                                                    mode="range"
                                                    value={form.startDate}
                                                    endValue={form.endDate}
                                                    onChange={() => undefined}
                                                    onRangeChange={(start, end) => {
                                                        setForm((f) => ({ ...f, startDate: start, endDate: end }));
                                                        clearErrors('startDate', 'endDate');
                                                    }}
                                                    minDate={minCustomDate}
                                                    leadMonths={limits.customLeadMonths}
                                                    disabledDates={[]} // no booked days: the Project Manager checks the schedule when reviewing
                                                    minDays={2}
                                                    maxDays={limits.maxProjectDays}
                                                    hint={`Click the first day, then the last day, at least ${customLeadText} from today. A project runs 2 to ${limits.maxProjectDays} days. The Project Manager confirms availability.`}
                                                    hasError={!!errors.startDate || !!errors.endDate}
                                                />
                                            )}
                                        </div>
                                    </Field>
                                </div>
                            </div>

                            <p className="mt-5 rounded-lg bg-gold/10 px-3 py-2 text-xs text-ink">
                                Custom projects are not priced on this form. Our team prepares the design proposal and quotation after the consultation
                                and ocular visit, so describe your concept and attach references for that visit.
                            </p>
                        </>
                    ) : (
                        <div className="grid gap-5 lg:grid-cols-2">
                            <div className="flex flex-col gap-5">
                                <Field label="Event Type" required error={errors.eventTypeId}>
                                    {eventTypes.length === 0 ? (
                                        <p className="text-xs text-ink-soft">No event types are available right now. Please contact us.</p>
                                    ) : (
                                        <div data-error={errors.eventTypeId ? '' : undefined} className="grid grid-cols-2 gap-2">
                                            {eventTypes.map((t) => {
                                                const on = form.eventTypeId === String(t.id);
                                                return (
                                                    <button key={t.id} type="button" aria-pressed={on} onClick={() => chooseEventType(String(t.id))} className={choiceButton(on)}>
                                                        {t.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </Field>

                                {venueField}

                                <Field label="Expected Guests" htmlFor="pr-guests" required error={errors.guests}>
                                    <input
                                        id="pr-guests"
                                        type="number"
                                        min="1"
                                        data-error={errors.guests ? '' : undefined}
                                        className={inputClass}
                                        placeholder="e.g. 100"
                                        value={form.guests}
                                        onChange={(e) => set('guests', e.target.value)}
                                    />
                                    <span className="text-[11px] text-ink-soft">An estimate is fine if you don&apos;t have an exact count yet.</span>
                                </Field>

                                {budgetField}
                            </div>

                            <div className="flex flex-col gap-5">
                                <Field label="Event Date" htmlFor="pr-date" required error={errors.eventDate}>
                                    <div data-error={errors.eventDate ? '' : undefined}>
                                        <DatePicker
                                            id="pr-date"
                                            value={form.eventDate}
                                            onChange={(iso) => set('eventDate', iso)}
                                            minDate={minEventDate}
                                            hasError={!!errors.eventDate}
                                        />
                                    </div>
                                    <span className="text-[11px] text-ink-soft">At least {plural(limits.minLeadMonths, 'month')} from today.</span>
                                </Field>

                                <Field label="Event Time" required error={errors.eventTime}>
                                    <div data-error={errors.eventTime ? '' : undefined} className="grid grid-cols-2 gap-3">
                                        <div className="grid gap-1">
                                            <label htmlFor="pr-start" className="text-[11px] text-ink-soft">
                                                Start
                                            </label>
                                            <select
                                                id="pr-start"
                                                className={selectClass}
                                                value={form.eventStartTime}
                                                onChange={(e) => {
                                                    const start = e.target.value;
                                                    // Changing the start clears the end unless it still meets the minimum length.
                                                    setForm((f) => ({
                                                        ...f,
                                                        eventStartTime: start,
                                                        eventEndTime:
                                                            start && f.eventEndTime && toMinutes(f.eventEndTime) - toMinutes(start) >= limits.minEventHours * 60
                                                                ? f.eventEndTime
                                                                : '',
                                                    }));
                                                }}
                                            >
                                                <option value="">Select start</option>
                                                {startSlots.map((t) => (
                                                    <option key={t.value} value={t.value}>
                                                        {t.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid gap-1">
                                            <label htmlFor="pr-end" className="text-[11px] text-ink-soft">
                                                End
                                            </label>
                                            <select
                                                id="pr-end"
                                                className={selectClass}
                                                value={form.eventEndTime}
                                                disabled={!form.eventStartTime}
                                                onChange={(e) => set('eventEndTime', e.target.value)}
                                            >
                                                <option value="">{form.eventStartTime ? 'Select end' : 'Choose a start first'}</option>
                                                {endSlots.map((t) => (
                                                    <option key={t.value} value={t.value}>
                                                        {t.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <span className="text-[11px] text-ink-soft">
                                        30-minute steps, and an event runs at least {plural(limits.minEventHours, 'hour')}. Latest start:{' '}
                                        {startSlots[startSlots.length - 1]?.label}.
                                    </span>
                                </Field>
                            </div>
                        </div>
                    )}
                </Panel>

                {fixFieldsNote}

                <div className="flex justify-end">
                    {isCustom ? (
                        <GoldButton className="px-8 py-2.5" onClick={reviewCustom} disabled={profileMissing}>
                            Review &amp; Submit
                        </GoldButton>
                    ) : (
                        <GoldButton className="px-8 py-2.5" onClick={continueFromDetails}>
                            Continue
                        </GoldButton>
                    )}
                </div>
            </div>

            {isCustom && (
                <Dialog open={reviewOpen} onOpenChange={(open) => !submitting && setReviewOpen(open)}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Review your custom project</DialogTitle>
                            <DialogDescription>Check the details before sending. Our team will contact you to schedule the consultation.</DialogDescription>
                        </DialogHeader>

                        <dl className="grid gap-x-3 gap-y-2.5 text-sm" style={{ gridTemplateColumns: '8rem minmax(0, 1fr)' }}>
                            <dt className="text-ink-soft">Project title</dt>
                            <dd className="font-bold break-words text-ink">{form.projectTitle}</dd>

                            <dt className="text-ink-soft">Venue / location</dt>
                            <dd className="break-words text-ink">{form.venue}</dd>

                            <dt className="text-ink-soft">{form.dayMode === 'one' ? 'Date' : 'Dates'}</dt>
                            <dd className="text-ink">
                                {form.startDate &&
                                    (form.dayMode === 'one' || !form.endDate ? longDate(form.startDate) : formatRange(form.startDate, form.endDate))}
                            </dd>

                            <dt className="text-ink-soft">Budget range</dt>
                            <dd className="text-ink">{budgetText}</dd>

                            <dt className="text-ink-soft">Description</dt>
                            <dd className="line-clamp-4 break-words whitespace-pre-line text-ink">
                                {form.description.trim() || <span className="text-ink-soft">None</span>}
                            </dd>

                            <dt className="text-ink-soft">Reference files</dt>
                            <dd className="text-ink">
                                {files.length === 0 ? (
                                    <span className="text-ink-soft">None</span>
                                ) : (
                                    <>
                                        {plural(files.length, 'file')}
                                        <span className="block truncate text-xs text-ink-soft">{files.map((f) => f.file.name).join(', ')}</span>
                                    </>
                                )}
                            </dd>
                        </dl>

                        <p className="rounded-lg bg-gold/10 px-3 py-2 text-xs text-ink">No quotation yet: it comes after the design proposal is reviewed.</p>

                        {profileError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{profileError}</p>}

                        <DialogFooter className="gap-2 sm:gap-2">
                            <OutlineButton className="px-5 py-2" onClick={() => setReviewOpen(false)} disabled={submitting}>
                                Edit details
                            </OutlineButton>
                            <GoldButton className="px-6 py-2" onClick={submit} disabled={submitting || profileMissing}>
                                {submitting ? 'Submitting…' : 'Confirm & Submit'}
                            </GoldButton>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
