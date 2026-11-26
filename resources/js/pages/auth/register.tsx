import { Head, router, useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { GoogleButton, OrDivider } from '@/components/auth/google-button';
import { PrivacyDialog, TermsDialog } from '@/components/auth/legal-dialogs';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { login } from '@/routes';
import { store } from '@/routes/register';

type Props = {
    passwordRules: string;
};

type RegisterForm = {
    first_name: string;
    last_name: string;
    email: string;
    contact_number: string;
    company_name: string;
    address: string;
    password: string;
    password_confirmation: string;
    terms: boolean;
};

type Field = Exclude<keyof RegisterForm, 'terms'>;

/** Top to bottom, as on the page: the first field with an error gets the focus. */
const FIELD_ORDER: Field[] = [
    'first_name',
    'last_name',
    'email',
    'contact_number',
    'company_name',
    'address',
    'password',
    'password_confirmation',
];

const FILL_OUT = 'Please fill out this field.';
const MOBILE = /^09\d{9}$/;

/** "+63 917-123-4567" -> "09171234567", the same as the server (Customer::normalizeMobile). */
const normalizeMobile = (value: string) => value.trim().replace(/[\s\-().]/g, '').replace(/^\+63/, '0');

/**
 * One message per field, the most basic problem first: empty, then the format,
 * then the length. The server checks the same, plus whether the email or
 * contact number is already registered.
 */
function validate(data: RegisterForm): Partial<Record<Field, string>> {
    const errors: Partial<Record<Field, string>> = {};
    const filled = (field: Field) => data[field].trim() !== '';

    for (const field of ['first_name', 'last_name', 'email', 'contact_number', 'password', 'password_confirmation'] as Field[]) {
        if (!filled(field)) {
            errors[field] = FILL_OUT;
        }
    }

    if (!errors.first_name && data.first_name.trim().length > 50) errors.first_name = 'Keep it to 50 characters or fewer.';
    if (!errors.last_name && data.last_name.trim().length > 50) errors.last_name = 'Keep it to 50 characters or fewer.';
    if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) errors.email = 'Enter a valid email address.';
    if (!errors.contact_number && !MOBILE.test(normalizeMobile(data.contact_number))) {
        errors.contact_number = 'Enter a valid mobile number (09XXXXXXXXX or +639XXXXXXXXX).';
    }
    if (data.company_name.trim().length > 100) errors.company_name = 'Keep the company name to 100 characters or fewer.';
    if (data.address.trim().length > 255) errors.address = 'Keep the address to 255 characters or fewer.';
    if (!errors.password_confirmation && data.password !== data.password_confirmation) {
        errors.password_confirmation = 'The passwords do not match.';
    }

    return errors;
}

const fieldClass =
    'h-11 rounded-lg border-black/15 bg-white focus-visible:border-[#C99A2E] focus-visible:ring-[#C99A2E]/30';
const errorFieldClass = 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20';

function Required() {
    return <span className="text-red-600">*</span>;
}

/**
 * The line under a field. Its space is always kept, so the form does not jump
 * when an error appears: the error, else a hint, else nothing.
 */
function FieldMessage({ id, error, hint, className }: { id?: string; error?: string; hint?: ReactNode; className?: string }) {
    return (
        <p id={id} className={cn('min-h-5 text-sm leading-5', error ? 'text-red-600' : 'text-xs text-ink-soft', className)} role={error ? 'alert' : undefined}>
            {error ?? hint}
        </p>
    );
}

export default function Register({ passwordRules }: Props) {
    const [termsOpen, setTermsOpen] = useState(false);
    const [privacyOpen, setPrivacyOpen] = useState(false);

    const { data, setData, post, processing, errors, setError, clearErrors, reset } = useForm<RegisterForm>({
        first_name: '',
        last_name: '',
        email: '',
        contact_number: '',
        company_name: '',
        address: '',
        password: '',
        password_confirmation: '',
        terms: false,
    });

    useEffect(() => {
        router.reload({ replace: true });
    }, []);

    const focusFirst = (failed: Partial<Record<string, string>>) => {
        const first = FIELD_ORDER.find((field) => failed[field]);

        if (first) {
            document.getElementById(first)?.focus();
        }
    };

    const change = (field: Field, value: string) => {
        setData(field, value);

        if (errors[field]) {
            clearErrors(field);
        }
    };

    const setTerms = (value: boolean) => {
        setData('terms', value);
        clearErrors('terms');
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();

        const failed = validate(data);

        if (Object.keys(failed).length > 0) {
            clearErrors();
            setError(failed as Record<Field, string>);
            focusFirst(failed);

            return;
        }

        post(store.url(), {
            onError: (serverErrors) => focusFirst(serverErrors),
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    /** One text field with its label and the line kept for its error. */
    const textField = (field: Field, label: string, opts: { required?: boolean; type?: string; autoComplete: string; placeholder: string; maxLength?: number; hint?: ReactNode; inputMode?: 'tel' | 'email' | 'text'; tabIndex: number; autoFocus?: boolean }) => (
        <div className="grid gap-2">
            <Label htmlFor={field} className="font-bold">
                {label} {opts.required ? <Required /> : <span className="font-normal text-ink-soft">(optional)</span>}
            </Label>
            <Input
                id={field}
                name={field}
                type={opts.type ?? 'text'}
                inputMode={opts.inputMode}
                value={data[field]}
                onChange={(e) => change(field, e.target.value)}
                autoComplete={opts.autoComplete}
                placeholder={opts.placeholder}
                maxLength={opts.maxLength}
                tabIndex={opts.tabIndex}
                autoFocus={opts.autoFocus}
                aria-invalid={errors[field] ? true : undefined}
                aria-describedby={`${field}-message`}
                className={cn(fieldClass, errors[field] && errorFieldClass)}
            />
            <FieldMessage id={`${field}-message`} error={errors[field]} hint={opts.hint} />
        </div>
    );

    const passwordField = (field: 'password' | 'password_confirmation', label: string, placeholder: string, tabIndex: number) => (
        <div className="grid gap-2">
            <Label htmlFor={field} className="font-bold">
                {label} <Required />
            </Label>
            <PasswordInput
                id={field}
                name={field}
                value={data[field]}
                onChange={(e) => change(field, e.target.value)}
                autoComplete="new-password"
                placeholder={placeholder}
                passwordrules={passwordRules}
                tabIndex={tabIndex}
                aria-invalid={errors[field] ? true : undefined}
                aria-describedby={`${field}-message`}
                className={cn(fieldClass, errors[field] && errorFieldClass)}
            />
            <FieldMessage id={`${field}-message`} error={errors[field]} />
        </div>
    );

    return (
        <>
            <Head title="Register" />
            {/* noValidate: our own "Please fill out this field." under each field, not the browser's bubble. */}
            <form onSubmit={submit} noValidate className="flex flex-col gap-5">
                <div className="grid gap-3">
                    <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
                        {textField('first_name', 'First Name', { required: true, autoComplete: 'given-name', placeholder: 'Enter your first name', maxLength: 50, tabIndex: 1, autoFocus: true })}
                        {textField('last_name', 'Last Name', { required: true, autoComplete: 'family-name', placeholder: 'Enter your last name', maxLength: 50, tabIndex: 2 })}
                        {textField('email', 'Email Address', {
                            required: true,
                            type: 'email',
                            inputMode: 'email',
                            autoComplete: 'email',
                            placeholder: 'Enter your email address',
                            hint: "We'll send a verification link to this email.",
                            tabIndex: 3,
                        })}
                        {textField('contact_number', 'Contact Number', {
                            required: true,
                            type: 'tel',
                            inputMode: 'tel',
                            autoComplete: 'tel',
                            placeholder: '09XXXXXXXXX',
                            maxLength: 20,
                            hint: '09XXXXXXXXX or +639XXXXXXXXX',
                            tabIndex: 4,
                        })}
                        {textField('company_name', 'Company / Organization', { autoComplete: 'organization', placeholder: 'Enter company name', maxLength: 100, tabIndex: 5 })}
                        {textField('address', 'Address', { autoComplete: 'street-address', placeholder: 'House no., street, city', maxLength: 255, tabIndex: 6 })}
                        {passwordField('password', 'Password', 'Create a password', 7)}
                        {passwordField('password_confirmation', 'Confirm Password', 'Confirm your password', 8)}
                    </div>

                    <div className="grid gap-2">
                        <div className="flex items-center justify-center gap-3">
                            <Checkbox
                                id="terms"
                                name="terms"
                                checked={data.terms}
                                onCheckedChange={(checked) => setTerms(checked === true)}
                                tabIndex={9}
                                className="data-[state=checked]:border-[#C99A2E] data-[state=checked]:bg-[#C99A2E]"
                            />
                            <Label htmlFor="terms" className="text-sm font-normal">
                                I agree to the{' '}
                                <button
                                    type="button"
                                    onClick={() => setTermsOpen(true)}
                                    className="font-bold text-[#C99A2E] underline hover:text-[#A67C1F]"
                                >
                                    Terms &amp; Conditions
                                </button>{' '}
                                and{' '}
                                <button
                                    type="button"
                                    onClick={() => setPrivacyOpen(true)}
                                    className="font-bold text-[#C99A2E] underline hover:text-[#A67C1F]"
                                >
                                    Privacy Policy
                                </button>
                            </Label>
                        </div>
                        <FieldMessage className="text-center" error={errors.terms} />
                        <TermsDialog
                            open={termsOpen}
                            onOpenChange={setTermsOpen}
                            onAgree={() => setTerms(true)}
                        />
                        <PrivacyDialog
                            open={privacyOpen}
                            onOpenChange={setPrivacyOpen}
                            onAgree={() => setTerms(true)}
                        />
                    </div>

                    <Button
                        type="submit"
                        className="mx-auto h-11 w-full rounded-full bg-[#C99A2E] font-bold tracking-wide text-[#1F2023] uppercase shadow-sm transition-[background-color,box-shadow] duration-300 hover:bg-[#D8AB3E] hover:shadow-[0_0_20px_rgba(201,154,46,0.55)] focus-visible:bg-[#D8AB3E] focus-visible:shadow-[0_0_20px_rgba(201,154,46,0.55)] focus-visible:outline-none sm:w-1/2"
                        tabIndex={10}
                        disabled={processing || !data.terms}
                        data-test="register-user-button"
                    >
                        {processing && <Spinner />}
                        Create Account
                    </Button>
                    <div className="mx-auto w-1/2">
                        <OrDivider label="or register with" />
                    </div>
                    <div className="mx-auto w-1/2">
                        <GoogleButton className="rounded-full" />
                    </div>
                </div>

                <div className="text-center text-sm text-ink">
                    Already have an account?{' '}
                    <TextLink
                        href={login()}
                        className="font-bold text-[#C99A2E] underline decoration-[#C99A2E] hover:text-[#A67C1F]"
                        tabIndex={11}
                    >
                        Log in
                    </TextLink>
                </div>
            </form>
        </>
    );
}

Register.layout = {
    variant: 'register',
    title: 'Registration',
    description: 'Fill in the details below to create your account.',
};
