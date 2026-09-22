import type { ButtonHTMLAttributes, ReactNode } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) =>
    c.filter(Boolean).join(' ');

/* ---------- form control classes ---------- */
export const inputClass =
    'h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus:border-gold focus:ring-2 focus:ring-gold/30 disabled:bg-black/5';
export const textareaClass =
    'min-h-24 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus:border-gold focus:ring-2 focus:ring-gold/30';
export const selectClass = inputClass + ' appearance-auto';

/* ---------- layout blocks ---------- */
export function PageHeader({
    title,
    description,
    actions,
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
}) {
    return (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-ink">{title}</h1>
                {description && (
                    <p className="mt-1 text-base text-ink-soft">{description}</p>
                )}
            </div>
            {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
        </div>
    );
}

export function Panel({
    className,
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <section
            className={cx(
                'rounded-2xl border border-black/10 bg-white p-6 shadow-sm',
                className,
            )}
        >
            {children}
        </section>
    );
}

export function PanelHeader({
    title,
    description,
    icon,
    round = false,
}: {
    title: string;
    description?: string;
    icon?: ReactNode;
    round?: boolean;
}) {
    return (
        <div className="mb-5 flex items-center gap-3">
            <div
                className={cx(
                    'flex size-10 shrink-0 items-center justify-center text-white',
                    round ? 'rounded-full bg-gold' : 'rounded-lg bg-gold/30 text-gold-dark',
                )}
            >
                {icon}
            </div>
            <div>
                <h2 className="text-lg font-bold leading-tight text-ink">
                    {title}
                </h2>
                {description && (
                    <p className="text-xs text-ink-soft">{description}</p>
                )}
            </div>
        </div>
    );
}

export function Field({
    label,
    htmlFor,
    required,
    error,
    className,
    children,
}: {
    label: string;
    htmlFor?: string;
    required?: boolean;
    error?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cx('grid gap-1.5', className)}>
            <label htmlFor={htmlFor} className="text-sm text-ink">
                {label}
                {required && <span className="text-red-600"> *</span>}
            </label>
            {children}
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
}

/* ---------- buttons ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement>;
const btnBase =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-50';

export function GoldButton({ className, ...p }: BtnProps) {
    return (
        <button
            type="button"
            {...p}
            className={cx(btnBase, 'bg-gold text-white hover:bg-gold-dark', className)}
        />
    );
}

export function OutlineButton({ className, ...p }: BtnProps) {
    return (
        <button
            type="button"
            {...p}
            className={cx(
                btnBase,
                'border border-gold bg-white text-ink hover:bg-gold/10',
                className,
            )}
        />
    );
}

export function DangerButton({ className, ...p }: BtnProps) {
    return (
        <button
            type="button"
            {...p}
            className={cx(
                btnBase,
                'border border-red-500 bg-red-100 text-red-700 hover:bg-red-200',
                className,
            )}
        />
    );
}

/* ---------- status pills ---------- */
const tones = {
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-800',
    blue: 'bg-sky-200 text-blue-900',
    purple: 'bg-purple-200 text-purple-900',
    cream: 'bg-gold/20 text-gold-dark',
    gray: 'bg-black/10 text-ink-soft',
    red: 'bg-red-100 text-red-700',
} as const;

export type PillTone = keyof typeof tones;

export function Pill({
    tone = 'gray',
    children,
    className,
}: {
    tone?: PillTone;
    children: ReactNode;
    className?: string;
}) {
    return (
        <span
            className={cx(
                'inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold',
                tones[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}

/* ---------- on/off switch ---------- */
export function Switch({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={cx(
                'relative h-5 w-9 shrink-0 rounded-full transition',
                checked ? 'bg-gold' : 'bg-black/25',
            )}
        >
            <span
                className={cx(
                    'absolute top-0.5 size-4 rounded-full bg-white transition-all',
                    checked ? 'left-[18px]' : 'left-0.5',
                )}
            />
        </button>
    );
}
