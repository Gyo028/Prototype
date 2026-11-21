import { useState } from 'react';
import type { ReactNode } from 'react';
import { Field, GoldButton, OutlineButton, cx, inputClass, selectClass, textareaClass } from '@/components/dashboard/ui';
import { DialogFooter } from '@/components/ui/dialog';
import { BUDGET_RANGES, CONSULTATION_OUTCOMES, PROJECT_DECISIONS } from '@/data/project-manager/project-requests';
import type { ConsultationOutcome, ProjectDecision, ProjectRequest } from '@/data/project-manager/project-requests';

/*
 * Backlog #16: Record consultation outcomes.
 * After the consultation, the Project Manager records what happened, updates the
 * project details, says whether an ocular visit is needed (the customer books the
 * date later, after paying the reservation fee), and decides if the project can proceed.
 * The form will not save until the outcome, the ocular visit requirement and the
 * project decision are all specified.
 */

/** Everything the form holds. Choices start as '' (nothing picked yet). */
export type ConsultationValues = {
    outcome: ConsultationOutcome | '';
    summary: string;
    eventDate: string; // 'YYYY-MM-DD'
    startTime: string; // 'HH:mm'
    endTime: string; // 'HH:mm'
    venue: string;
    venueSetting: 'Indoor' | 'Outdoor';
    guests: string; // kept as text while typing, converted to a number when saving
    budget: string;
    additionalNotes: string;
    ocularVisitRequired: '' | 'yes' | 'no';
    decision: ProjectDecision | '';
    decisionReason: string;
};

export type ConsultationErrors = Partial<Record<keyof ConsultationValues, string>>;

// Shown in the "please complete" box under the form.
const FIELD_LABELS: Record<keyof ConsultationValues, string> = {
    outcome: 'Consultation outcome',
    summary: 'Consultation summary',
    eventDate: 'Event date',
    startTime: 'Start time',
    endTime: 'End time',
    venue: 'Venue',
    venueSetting: 'Venue setting',
    guests: 'Guests',
    budget: 'Budget',
    additionalNotes: 'Additional notes',
    ocularVisitRequired: 'Ocular visit requirement',
    decision: 'Project decision',
    decisionReason: 'Reason for not proceeding',
};

/** Fills the form from the request: current project details, plus the saved consultation if there is one. */
function initialValues(r: ProjectRequest): ConsultationValues {
    const c = r.consultation;
    return {
        outcome: c?.outcome ?? '',
        summary: c?.summary ?? '',
        eventDate: r.eventDate,
        startTime: r.startTime,
        endTime: r.endTime,
        venue: r.venue,
        venueSetting: r.venueSetting,
        guests: r.guests === null ? '' : String(r.guests),
        budget: r.budget,
        additionalNotes: c?.additionalNotes ?? '',
        ocularVisitRequired: c ? (c.ocularVisit.required ? 'yes' : 'no') : '',
        decision: c?.decision ?? '',
        decisionReason: c?.decisionReason ?? '',
    };
}

/** Checks the form in the browser before anything is sent. Returns the problems found. */
function validate(v: ConsultationValues, isMall: boolean): ConsultationErrors {
    const e: ConsultationErrors = {};

    // Acceptance criterion 2: these three must be specified.
    if (!v.outcome) e.outcome = 'Select the consultation outcome.';
    if (!v.ocularVisitRequired) e.ocularVisitRequired = 'Specify whether an ocular visit is required.';
    if (!v.decision) e.decision = 'Select whether the project can proceed.';

    if (!v.summary.trim()) e.summary = 'Summarize what was discussed in the consultation.';

    if (!v.eventDate) e.eventDate = 'Event date is required.';
    if (!v.startTime) e.startTime = 'Start time is required.';
    if (!v.endTime) e.endTime = 'End time is required.';
    else if (v.startTime && v.endTime <= v.startTime) e.endTime = 'End time must be after the start time.';
    if (!v.venue.trim()) e.venue = 'Venue is required.';
    if (!v.budget) e.budget = 'Budget is required.';
    if (!isMall && (!v.guests || Number(v.guests) < 1)) e.guests = 'Enter the expected number of guests.';

    if (v.decision === 'Do not proceed' && !v.decisionReason.trim()) {
        e.decisionReason = 'Give the reason the project will not proceed.';
    }

    return e;
}

/* ---------- small pieces ---------- */

function FormSection({ step, title, children }: { step: number; title: string; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-black/10 p-4">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
                <span className="flex size-6 items-center justify-center rounded-full bg-gold text-xs text-white">{step}</span>
                {title}
            </h3>
            <div className="grid gap-4">{children}</div>
        </section>
    );
}

/** A row of buttons that work like radio buttons (only one can be picked). */
function ChoiceGroup<T extends string>({
    label,
    options,
    value,
    onChange,
    error,
}: {
    label: string;
    options: { value: T; label: string }[];
    value: T | '';
    onChange: (value: T) => void;
    error?: string;
}) {
    return (
        <div className="grid gap-1.5">
            <p className="text-sm text-ink">
                {label}
                <span className="text-red-600"> *</span>
            </p>
            <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
                {options.map((o) => (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={value === o.value}
                        onClick={() => onChange(o.value)}
                        className={cx(
                            'rounded-lg border px-4 py-2 text-sm font-semibold transition',
                            value === o.value
                                ? 'border-gold bg-gold text-white'
                                : cx('bg-white text-ink hover:bg-gold/10', error ? 'border-red-500' : 'border-black/15'),
                        )}
                    >
                        {o.label}
                    </button>
                ))}
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
}

/* ---------- the form ---------- */

type Props = {
    request: ProjectRequest;
    saving: boolean;
    /** Validation errors sent back by Laravel, if any. */
    serverErrors: ConsultationErrors;
    onCancel: () => void;
    onSave: (values: ConsultationValues) => void;
};

export default function ConsultationForm({ request, saving, serverErrors, onCancel, onSave }: Props) {
    const isMall = request.eventType === 'Mall Activation';

    const [values, setValues] = useState<ConsultationValues>(() => initialValues(request));
    const [clientErrors, setClientErrors] = useState<ConsultationErrors>({});

    // Browser checks come first; Laravel's errors show when the browser found nothing.
    const errors = Object.keys(clientErrors).length ? clientErrors : serverErrors;
    const missing = Object.keys(errors) as (keyof ConsultationValues)[];

    // Updates one field and clears its error as soon as the user fixes it.
    const set = <K extends keyof ConsultationValues>(key: K, value: ConsultationValues[K]) => {
        setValues((v) => ({ ...v, [key]: value }));
        if (clientErrors[key]) {
            setClientErrors((e) => {
                const next = { ...e };
                delete next[key];
                return next;
            });
        }
    };

    const submit = () => {
        const e = validate(values, isMall);
        setClientErrors(e);
        if (Object.keys(e).length) return; // criterion 2: nothing is saved
        onSave(values);
    };

    return (
        <form
            className="grid gap-4"
            noValidate
            onSubmit={(e) => {
                e.preventDefault();
                submit();
            }}
        >
            {/* 1. What happened in the consultation */}
            <FormSection step={1} title="Consultation Outcome">
                <ChoiceGroup
                    label="Outcome"
                    options={CONSULTATION_OUTCOMES.map((o) => ({ value: o, label: o }))}
                    value={values.outcome}
                    onChange={(v) => set('outcome', v)}
                    error={errors.outcome}
                />
                <Field label="Summary of the consultation" htmlFor="c-summary" required error={errors.summary}>
                    <textarea
                        id="c-summary"
                        value={values.summary}
                        onChange={(e) => set('summary', e.target.value)}
                        placeholder="e.g. Client confirmed the theme and asked for a rain plan."
                        className={cx(textareaClass, errors.summary && 'border-red-500')}
                    />
                </Field>
            </FormSection>

            {/* 2. Project details, pre-filled from the request so the PM only changes what was agreed */}
            <FormSection step={2} title="Project Details">
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Event date" htmlFor="c-date" required error={errors.eventDate}>
                        <input
                            id="c-date"
                            type="date"
                            value={values.eventDate}
                            onChange={(e) => set('eventDate', e.target.value)}
                            className={inputClass}
                        />
                    </Field>
                    <Field label="Start time" htmlFor="c-start" required error={errors.startTime}>
                        <input
                            id="c-start"
                            type="time"
                            value={values.startTime}
                            onChange={(e) => set('startTime', e.target.value)}
                            className={inputClass}
                        />
                    </Field>
                    <Field label="End time" htmlFor="c-end" required error={errors.endTime}>
                        <input
                            id="c-end"
                            type="time"
                            value={values.endTime}
                            onChange={(e) => set('endTime', e.target.value)}
                            className={inputClass}
                        />
                    </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Venue" htmlFor="c-venue" required error={errors.venue} className="sm:col-span-2">
                        <input
                            id="c-venue"
                            value={values.venue}
                            onChange={(e) => set('venue', e.target.value)}
                            className={inputClass}
                        />
                    </Field>
                    <Field label="Venue setting" htmlFor="c-setting" required>
                        <select
                            id="c-setting"
                            value={values.venueSetting}
                            onChange={(e) => set('venueSetting', e.target.value as ConsultationValues['venueSetting'])}
                            className={selectClass}
                        >
                            <option>Indoor</option>
                            <option>Outdoor</option>
                        </select>
                    </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Guests" htmlFor="c-guests" required={!isMall} error={errors.guests}>
                        <input
                            id="c-guests"
                            type="number"
                            min={1}
                            disabled={isMall}
                            placeholder={isMall ? 'Not applicable' : ''}
                            value={values.guests}
                            onChange={(e) => set('guests', e.target.value)}
                            className={inputClass}
                        />
                    </Field>
                    <Field label="Budget" htmlFor="c-budget" required error={errors.budget} className="sm:col-span-2">
                        <select
                            id="c-budget"
                            value={values.budget}
                            onChange={(e) => set('budget', e.target.value)}
                            className={selectClass}
                        >
                            {BUDGET_RANGES.map((b) => (
                                <option key={b}>{b}</option>
                            ))}
                        </select>
                    </Field>
                </div>

                <Field label="Additional details (optional)" htmlFor="c-notes">
                    <textarea
                        id="c-notes"
                        value={values.additionalNotes}
                        onChange={(e) => set('additionalNotes', e.target.value)}
                        placeholder="e.g. Add a tent as backup in case of rain. Client prefers white flowers."
                        className={textareaClass}
                    />
                </Field>
            </FormSection>

            {/* 3. Ocular visit (site inspection) */}
            <FormSection step={3} title="Ocular Visit">
                <ChoiceGroup
                    label="Is an ocular visit required?"
                    options={[
                        { value: 'yes', label: 'Required' },
                        { value: 'no', label: 'Not required' },
                    ]}
                    value={values.ocularVisitRequired}
                    onChange={(v) => set('ocularVisitRequired', v)}
                    error={errors.ocularVisitRequired}
                />
                {values.ocularVisitRequired === 'yes' && (
                    <p className="text-xs text-ink-soft">
                        The customer will book the ocular visit date after paying the reservation fee.
                    </p>
                )}
            </FormSection>

            {/* 4. Can the project proceed? */}
            <FormSection step={4} title="Project Decision">
                <ChoiceGroup
                    label="Can the project proceed?"
                    options={PROJECT_DECISIONS.map((d) => ({ value: d, label: d }))}
                    value={values.decision}
                    onChange={(v) => set('decision', v)}
                    error={errors.decision}
                />
                {values.decision === 'Do not proceed' && (
                    <Field label="Reason" htmlFor="c-reason" required error={errors.decisionReason}>
                        <textarea
                            id="c-reason"
                            value={values.decisionReason}
                            onChange={(e) => set('decisionReason', e.target.value)}
                            placeholder="e.g. The venue cannot accommodate the required setup."
                            className={cx(textareaClass, errors.decisionReason && 'border-red-500')}
                        />
                    </Field>
                )}
            </FormSection>

            {/* Listed again next to the Save button, because the fields may be scrolled out of view */}
            {missing.length > 0 && (
                <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                    <p className="font-bold">The consultation was not saved. Complete these first:</p>
                    <ul className="mt-1 list-disc pl-5">
                        {missing.map((key) => (
                            <li key={key}>{FIELD_LABELS[key]}</li>
                        ))}
                    </ul>
                </div>
            )}

            <DialogFooter>
                <OutlineButton onClick={onCancel} disabled={saving}>
                    Cancel
                </OutlineButton>
                <GoldButton type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Consultation'}
                </GoldButton>
            </DialogFooter>
        </form>
    );
}
