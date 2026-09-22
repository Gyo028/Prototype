import { Link } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, FileText, ImageIcon, Info, PartyPopper, Plus, Upload, Wrench, X } from 'lucide-react';
import { useRef, useState } from 'react';
import DatePicker from '@/components/customer/date-picker';
import ServicesAssetsSelector from '@/components/customer/services-assets-selector';
import { Field, GoldButton, OutlineButton, Panel, cx, inputClass, textareaClass } from '@/components/dashboard/ui';

/*
 * "Request New Project" — built one step at a time.
 *
 * Step 1: choose a request type (card selection).
 * Step 2: project details. Event Styling is fully built; Custom Designing
 * is deferred (its fields have not been decided yet), so it shows a
 * placeholder notice instead of a form.
 *
 * Step 3: Services & Assets — which services the customer needs, and
 * (optionally) which design assets they want, styled after the Figma 2D
 * Design Tool's Assets Library. No theme or canvas yet: this step only
 * builds the list; placement happens in the next step.
 *
 * Step 4: Project Description & Reference Files — both optional, and moved
 * out of Project Details so Step 2 stays short. This is the last step;
 * Submit Request lives here now.
 *
 * Added later, one at a time:
 *  - Design layout: design theme + layout assets, auto-placement, running
 *    initial cost                                                 [backlog 14]
 *  - Custom (non-library) items
 *  - Initial cost summary
 *
 * Maps to `service_requests` in the ERD. `request_type` is
 * ('event_styling' | 'custom_designing') — matching the ERD's enum.
 * Full name and email are not collected here; they come from the
 * logged-in customer's account.
 *
 * NOTE FOR THE DOCUMENTATION: `service_requests` has no budget column yet.
 * Budget is required on this form and needs to be added to the ERD
 * (e.g. `budget_range varchar(50)` or a numeric min/max pair).
 */

const EVENT_TYPES = [
    { id: 'corporate', name: 'Corporate' },
    { id: 'wedding', name: 'Wedding' },
    { id: 'birthday', name: 'Birthday' },
    { id: 'debut', name: 'Debut' },
    { id: 'mall', name: 'Mall Activation' },
];

const BUDGETS = ['Below ₱50,000', '₱50,000 – ₱100,000', '₱100,000 – ₱250,000', '₱250,000 – ₱500,000', 'Above ₱500,000'];

// Step 4: reference image / file uploads.
const MAX_FILES = 10;
const MAX_FILE_MB = 10;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
type RefFile = { id: number; file: File; url?: string };


// Matches the ERD's service_requests.request_type enum.
type RequestType = 'event_styling' | 'custom_designing';

const REQUEST_TYPES: { value: RequestType; title: string; hint: string; icon: typeof PartyPopper; available: boolean }[] = [
    { value: 'event_styling', title: 'Event Styling', hint: 'Weddings, birthdays, corporate events, mall activations', icon: PartyPopper, available: true },
    { value: 'custom_designing', title: 'Custom Designing', hint: 'A custom piece designed and produced for you, outside a full event', icon: Wrench, available: false },
];

type Form = {
    requestType: RequestType | null;
    eventTypeId: string;
    eventDate: string;
    venue: string;
    budget: string;
    guests: string;
    description: string;
};

export default function ProjectRequestForm() {
    const [form, setForm] = useState<Form>({
        requestType: null,
        eventTypeId: '',
        eventDate: '',
        venue: '',
        budget: '',
        guests: '',
        description: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitted, setSubmitted] = useState(false);

    // Step 2 (Project Details) -> Step 3 (Services & Assets) -> Step 4
    // (Description & Reference Files), once request type is Event Styling.
    const [formStep, setFormStep] = useState<2 | 3 | 4>(2);
    const [serviceIds, setServiceIds] = useState<number[]>([]);
    const [themeId, setThemeId] = useState<string | null>(null);
    const [assetIds, setAssetIds] = useState<string[]>([]);
    // TODO (next step): re-add layoutItems state (with quantities, derived from guest count)
    // once the Layout Panel can place design assets.

    // Step 4: reference files
    const fileRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<RefFile[]>([]);
    const [fileError, setFileError] = useState('');
    const [dragging, setDragging] = useState(false);
    

    const isStyling = form.requestType === 'event_styling';
    const selectType = (value: RequestType) => setForm((f) => ({ ...f, requestType: value }));

    // Requests need at least 1 month of lead time to prepare (matches DatePicker's default).
    const minEventDate = new Date();
    minEventDate.setHours(0, 0, 0, 0);
    minEventDate.setMonth(minEventDate.getMonth() + 1);
    const minEventDateISO = `${minEventDate.getFullYear()}-${String(minEventDate.getMonth() + 1).padStart(2, '0')}-${String(minEventDate.getDate()).padStart(2, '0')}`;

    const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

    const continueFromDetails = () => {
        const e: Record<string, string> = {};
        if (!form.eventTypeId) e.eventTypeId = 'Choose an event type.';
        if (!form.eventDate) e.eventDate = 'Choose the event date.';
        else if (form.eventDate < minEventDateISO) e.eventDate = 'The event date must be at least 1 month from today.';
        if (!form.venue.trim()) e.venue = 'Venue is required.';
        if (!form.budget) e.budget = 'Choose a budget range.';
        if (!form.guests || Number(form.guests) < 1) e.guests = 'Enter the expected number of guests.';
        setErrors(e);

        if (Object.keys(e).length) {
            document.querySelector('[data-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setErrors({});
        setFormStep(3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const continueFromServices = () => {
        const e: Record<string, string> = {};
        if (serviceIds.length === 0) e.services = 'Select at least one service.';
        setErrors(e);

        if (Object.keys(e).length) {
            document.querySelector('[data-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setErrors({});
        setFormStep(4);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Step 4: reference files (JPG, PNG or PDF; up to MAX_FILE_MB each, MAX_FILES total)
    const addFiles = (list: FileList | File[]) => {
        const incoming = Array.from(list);
        const problems: string[] = [];
        const accepted: RefFile[] = [];

        for (const file of incoming) {
            if (!ALLOWED_FILE_TYPES.includes(file.type) || file.size > MAX_FILE_MB * 1024 * 1024) {
                problems.push(`${file.name}: only JPG, PNG or PDF up to ${MAX_FILE_MB} MB.`);
            } else if (files.length + accepted.length >= MAX_FILES) {
                problems.push(`You can upload up to ${MAX_FILES} files. "${file.name}" was not added.`);
            } else {
                accepted.push({ id: Date.now() + accepted.length, file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined });
            }
        }
        setFileError(problems.join(' '));
        if (accepted.length) setFiles((f) => [...f, ...accepted]);
        if (fileRef.current) fileRef.current.value = '';
    };

    const submit = () => {
        // TODO (backend): send to Laravel, e.g. router.post('/customer/projects', { ...form, serviceIds, themeId, assetIds, files })
        // TODO (next step): design layout (theme + layout assets, auto-placement, running
        // initial cost) and custom items are added to the payload here.
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (submitted) {
        return (
            <Panel className="mx-auto max-w-2xl p-10 text-center">
                <CheckCircle2 className="mx-auto size-14 text-green-600" />
                <h1 className="mt-4 text-2xl font-bold text-ink">Request submitted</h1>
                <p className="mt-2 text-sm text-ink-soft">
                    Thank you! Your project request was sent to our Project Manager for review. You will be notified once it is approved, and you can then
                    schedule a consultation.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Link href="/customer" className="rounded-lg bg-gold px-5 py-2 text-sm font-bold text-white hover:bg-gold-dark">
                        Back to dashboard
                    </Link>
                    <Link href="/customer/projects" className="rounded-lg border border-gold px-5 py-2 text-sm font-bold text-ink hover:bg-gold/10">
                        View my projects
                    </Link>
                </div>
            </Panel>
        );
    }

    /* ---- step 1: choose a request type ---- */

    if (!form.requestType) {
        return (
            <>
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-ink">Request New Project</h1>
                    <p className="mt-1 text-base text-ink-soft">What would you like to request?</p>
                </div>

                <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
                    {REQUEST_TYPES.map((t) => (
                        <button
                            key={t.value}
                            type="button"
                            onClick={() => selectType(t.value)}
                            aria-label={`Request ${t.title}`}
                            className="group text-left"
                        >
                            <Panel className="flex h-full flex-col overflow-hidden p-0 transition group-hover:border-gold group-hover:shadow-md">
                                {/* Image placeholder */}
                                <div className="relative flex aspect-video items-center justify-center bg-neutral-200 text-neutral-400">
                                    <ImageIcon className="size-16" />
                                    {!t.available && (
                                        <span className="absolute top-2 right-2 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold tracking-wide text-ink-soft uppercase">
                                            Coming soon
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-1 items-start gap-3 p-5">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-gold-dark">
                                        <t.icon className="size-5" />
                                    </span>
                                    <div>
                                        <h2 className="text-lg font-bold text-ink">{t.title}</h2>
                                        <p className="mt-1 text-xs text-ink-soft">{t.hint}</p>
                                    </div>
                                </div>
                            </Panel>
                        </button>
                    ))}
                </div>
            </>
        );
    }

    /* ---- step 2, custom designing: deferred ---- */

    if (!isStyling) {
        return (
            <div className="mx-auto max-w-2xl">
                <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, requestType: null }))}
                    className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-gold-dark hover:underline"
                >
                    <ArrowLeft className="size-3.5" /> Change request type
                </button>
                <Panel className="p-8 text-center">
                    <Info className="mx-auto size-10 text-gold-dark" />
                    <h1 className="mt-3 text-xl font-bold text-ink">Custom Designing requests aren't open yet</h1>
                    <p className="mt-2 text-sm text-ink-soft">
                        We're still setting up this request type. For now, please reach out to us directly for custom, made-to-order pieces, or submit an
                        Event Styling request if your project is part of a full event.
                    </p>
                    <OutlineButton className="mt-5" onClick={() => setForm((f) => ({ ...f, requestType: 'event_styling' }))}>
                        Switch to Event Styling
                    </OutlineButton>
                </Panel>
            </div>
        );
    }

    /* ---- step 3, event styling: Services & Assets ---- */

    if (formStep === 3) {
        return (
            <>
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-ink">Request New Project</h1>
                    <p className="mt-1 text-base text-ink-soft">Tell us about your event. Our Project Manager reviews every request.</p>
                </div>

                <div className="w-full space-y-5">
                    <Panel>
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h2 className="text-lg font-bold text-ink">Services &amp; Assets</h2>
                            <button
                                type="button"
                                onClick={() => setFormStep(2)}
                                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-gold-dark hover:underline"
                            >
                                <ArrowLeft className="size-3.5" /> Back to Project Details
                            </button>
                        </div>

                        <ServicesAssetsSelector
                            serviceIds={serviceIds}
                            onServiceIdsChange={setServiceIds}
                            serviceError={errors.services}
                            guests={Number(form.guests) || 0}
                            themeId={themeId}
                            onThemeIdChange={setThemeId}
                            eventTypeId={form.eventTypeId}
                            budget={form.budget}
                            assetIds={assetIds}
                            onAssetIdsChange={setAssetIds}
                        />
                    </Panel>

                    {Object.keys(errors).length > 0 && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Please fix the highlighted fields before submitting.</p>
                    )}

                    <div className="flex justify-end">
                        <GoldButton className="px-8 py-2.5" onClick={continueFromServices}>
                            Continue
                        </GoldButton>
                    </div>
                </div>
            </>
        );
    }

    /* ---- step 4, event styling: Description & Reference Files ---- */

    if (formStep === 4) {
        return (
            <>
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-ink">Request New Project</h1>
                    <p className="mt-1 text-base text-ink-soft">Tell us about your event. Our Project Manager reviews every request.</p>
                </div>

                <div className="w-full space-y-5">
                    <Panel>
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h2 className="text-lg font-bold text-ink">Description &amp; Reference Files</h2>
                            <button
                                type="button"
                                onClick={() => setFormStep(3)}
                                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-gold-dark hover:underline"
                            >
                                <ArrowLeft className="size-3.5" /> Back to Services &amp; Assets
                            </button>
                        </div>

                        <Field label="Project Description" htmlFor="pr-desc">
                            <textarea
                                id="pr-desc"
                                className={cx(textareaClass, 'min-h-32')}
                                placeholder="Describe the mood, theme, must-haves and anything specific you want our team to know."
                                value={form.description}
                                onChange={(e) => set('description', e.target.value)}
                            />
                        </Field>

                        <div className="mt-6 border-t border-black/10 pt-6">
                            <p className="text-sm font-bold text-ink">Upload Peg / Reference Images</p>
                            <div className="mt-3 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
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
                                        'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition',
                                        dragging ? 'border-gold bg-gold/10' : 'border-black/20 bg-neutral-50',
                                    )}
                                >
                                    <Upload className="size-8 text-gold" />
                                    <p className="text-xs font-bold text-ink">Drag and drop your reference photos here</p>
                                    <p className="text-[11px] text-ink-soft">or</p>
                                    <OutlineButton className="px-4 py-1.5 text-xs" onClick={() => fileRef.current?.click()}>
                                        Choose file
                                    </OutlineButton>
                                    <p className="text-[10px] text-ink-soft">
                                        JPG, PNG, PDF up to {MAX_FILE_MB}MB each · Max {MAX_FILES} files
                                    </p>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.pdf"
                                        multiple
                                        hidden
                                        onChange={(e) => e.target.files && addFiles(e.target.files)}
                                    />
                                </div>

                                <div>
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                                        {files.map((f) => (
                                            <div key={f.id} className="group relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-neutral-100">
                                                {f.url ? (
                                                    <img src={f.url} alt={f.file.name} className="size-full object-cover" />
                                                ) : (
                                                    <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-ink-soft">
                                                        <FileText className="size-8" />
                                                        <span className="line-clamp-2 text-[10px]">{f.file.name}</span>
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    aria-label={`Remove ${f.file.name}`}
                                                    onClick={() => setFiles((list) => list.filter((x) => x.id !== f.id))}
                                                    className="absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                                                >
                                                    <X className="size-3.5" />
                                                </button>
                                            </div>
                                        ))}

                                        {files.length < MAX_FILES && (
                                            <button
                                                type="button"
                                                aria-label="Add file"
                                                onClick={() => fileRef.current?.click()}
                                                className="flex aspect-square items-center justify-center rounded-xl border border-black/20 text-ink-soft hover:border-gold hover:text-gold-dark"
                                            >
                                                <Plus className="size-8" />
                                            </button>
                                        )}

                                        {files.length === 0 &&
                                            [0, 1].map((i) => (
                                                <div key={i} className="hidden aspect-square items-center justify-center rounded-xl bg-neutral-200 text-neutral-400 sm:flex">
                                                    <ImageIcon className="size-10" />
                                                </div>
                                            ))}
                                    </div>
                                    <p className="mt-2 text-[11px] text-ink-soft">
                                        {files.length}/{MAX_FILES} files
                                    </p>
                                    {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
                                </div>
                            </div>
                        </div>
                    </Panel>

                    <div className="flex justify-end">
                        <GoldButton className="px-8 py-2.5" onClick={submit}>
                            Submit Request
                        </GoldButton>
                    </div>
                </div>
            </>
        );
    }

    /* ---- step 2, event styling ---- */

    return (
        <>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-ink">Request New Project</h1>
                <p className="mt-1 text-base text-ink-soft">Tell us about your event. Our Project Manager reviews every request.</p>
            </div>

            <div className="mx-auto max-w-4xl space-y-4">
                <Panel>
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h2 className="text-lg font-bold text-ink">Project Details</h2>
                        <button
                            type="button"
                            onClick={() => {
                                setForm((f) => ({ ...f, requestType: null }));
                                setFormStep(2);
                            }}
                            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-gold-dark hover:underline"
                        >
                            <ArrowLeft className="size-3.5" /> Change request type
                        </button>
                    </div>

                    {/* Left: the dropdown / text fields, no outer box. Project Description
                        moved to Step 4, so this column is intentionally shorter than the
                        calendar now — that's fine, there's no border here to reveal it. */}
                    <div className="grid gap-5 lg:grid-cols-2">
                        <div className="flex flex-col gap-5">
                            <Field label="Event Type" required error={errors.eventTypeId}>
                                {/* Buttons instead of a dropdown — fewer clicks, and it fills the
                                    gap in this column better than a single-line select would. */}
                                <div data-error={errors.eventTypeId ? '' : undefined} className="grid grid-cols-2 gap-2">
                                    {EVENT_TYPES.map((t) => {
                                        const on = form.eventTypeId === t.id;
                                        return (
                                            <button
                                                key={t.id}
                                                type="button"
                                                aria-pressed={on}
                                                onClick={() => set('eventTypeId', t.id)}
                                                className={cx(
                                                    'rounded-lg border p-2.5 text-left text-sm font-bold text-ink transition',
                                                    on ? 'border-gold bg-gold/10' : 'border-black/15 hover:bg-black/[0.02]',
                                                )}
                                            >
                                                {t.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Field>

                            <Field label="Venue / Location" htmlFor="pr-venue" required error={errors.venue}>
                                <input
                                    id="pr-venue"
                                    data-error={errors.venue ? '' : undefined}
                                    className={inputClass}
                                    placeholder="Venue name or exact address"
                                    value={form.venue}
                                    onChange={(e) => set('venue', e.target.value)}
                                />
                            </Field>


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
                                <span className="text-[11px] text-ink-soft">An estimate is fine if you don't have an exact count yet.</span>
                            </Field>

                            <Field label="Budget Range" required error={errors.budget}>
                                <div data-error={errors.budget ? '' : undefined} className="grid grid-cols-2 gap-2">
                                    {BUDGETS.map((b) => {
                                        const on = form.budget === b;
                                        return (
                                            <button
                                                key={b}
                                                type="button"
                                                aria-pressed={on}
                                                onClick={() => set('budget', b)}
                                                className={cx(
                                                    'rounded-lg border p-2.5 text-left text-sm font-bold text-ink transition',
                                                    on ? 'border-gold bg-gold/10' : 'border-black/15 hover:bg-black/[0.02]',
                                                )}
                                            >
                                                {b}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Field>
                        </div>

                        <Field label="Event Date" htmlFor="pr-date" required error={errors.eventDate}>
                            <div data-error={errors.eventDate ? '' : undefined}>
                                <DatePicker
                                    id="pr-date"
                                    value={form.eventDate}
                                    onChange={(iso) => set('eventDate', iso)}
                                    minDate={minEventDateISO}
                                    hasError={!!errors.eventDate}
                                />
                            </div>
                        </Field>
                    </div>
                </Panel>

                {Object.keys(errors).length > 0 && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Please fix the highlighted fields before submitting.</p>
                )}

                <div className="flex justify-end">
                    <GoldButton className="px-8 py-2.5" onClick={continueFromDetails}>
                        Continue
                    </GoldButton>
                </div>
            </div>
        </>
    );
}
