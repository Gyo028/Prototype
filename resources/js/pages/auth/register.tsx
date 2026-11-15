import { Form, Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { GoogleButton, OrDivider } from '@/components/auth/google-button';
import { PrivacyDialog, TermsDialog } from '@/components/auth/legal-dialogs';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { login } from '@/routes';
import { store } from '@/routes/register';

type Props = {
    passwordRules: string;
};

const fieldClass =
    'h-11 rounded-lg border-black/15 bg-white focus-visible:border-[#C99A2E] focus-visible:ring-[#C99A2E]/30';

function Required() {
    return <span className="text-red-600">*</span>;
}

export default function Register({ passwordRules }: Props) {
    const [agreed, setAgreed] = useState(false);
    const [termsOpen, setTermsOpen] = useState(false);
    const [privacyOpen, setPrivacyOpen] = useState(false);

    useEffect(() => {
        router.reload({ replace: true });
    }, []);

    return (
        <>
            <Head title="Register" />
            <Form
                {...store.form()}
                resetOnSuccess={['password', 'password_confirmation']}
                disableWhileProcessing
                className="flex flex-col gap-5"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-5">
                            <div className="grid gap-5 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="name" className="font-bold">
                                        Full Name <Required />
                                    </Label>
                                    <Input
                                        id="name"
                                        type="text"
                                        name="name"
                                        required
                                        autoFocus
                                        tabIndex={1}
                                        autoComplete="name"
                                        className={fieldClass}
                                        placeholder="Enter your full name"
                                    />
                                    <InputError message={errors.name} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="email" className="font-bold">
                                        Email Address <Required />
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        name="email"
                                        required
                                        tabIndex={2}
                                        autoComplete="email"
                                        className={fieldClass}
                                        placeholder="Enter your email address"
                                    />
                                    <InputError message={errors.email} />
                                </div>
                            </div>

                            <div className="grid gap-5 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="phone" className="font-bold">
                                        Phone Number <Required />
                                    </Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        name="phone"
                                        required
                                        tabIndex={3}
                                        autoComplete="tel"
                                        className={fieldClass}
                                        placeholder="Enter your phone number"
                                    />
                                    <InputError message={errors.phone} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="company" className="font-bold">
                                        Company / Organization (Optional)
                                    </Label>
                                    <Input
                                        id="company"
                                        type="text"
                                        name="company"
                                        tabIndex={4}
                                        autoComplete="organization"
                                        className={fieldClass}
                                        placeholder="Enter company name"
                                    />
                                    <InputError message={errors.company} />
                                </div>
                            </div>

                            <div className="grid gap-5 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="password" className="font-bold">
                                        Password <Required />
                                    </Label>
                                    <PasswordInput
                                        id="password"
                                        name="password"
                                        required
                                        tabIndex={5}
                                        autoComplete="new-password"
                                        className={fieldClass}
                                        placeholder="Create a password"
                                        passwordrules={passwordRules}
                                    />
                                    <InputError message={errors.password} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="password_confirmation" className="font-bold">
                                        Confirm Password <Required />
                                    </Label>
                                    <PasswordInput
                                        id="password_confirmation"
                                        name="password_confirmation"
                                        required
                                        tabIndex={6}
                                        autoComplete="new-password"
                                        className={fieldClass}
                                        placeholder="Confirm your password"
                                        passwordrules={passwordRules}
                                    />
                                    <InputError
                                        message={errors.password_confirmation}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center justify-center gap-3">
                                    <Checkbox
                                        id="terms"
                                        name="terms"
                                        required
                                        checked={agreed}
                                        onCheckedChange={(checked) => setAgreed(checked === true)}
                                        tabIndex={7}
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
                                <InputError className="text-center" message={errors.terms} />
                                <TermsDialog
                                    open={termsOpen}
                                    onOpenChange={setTermsOpen}
                                    onAgree={() => setAgreed(true)}
                                />
                                <PrivacyDialog
                                    open={privacyOpen}
                                    onOpenChange={setPrivacyOpen}
                                    onAgree={() => setAgreed(true)}
                                />
                            </div>

                            <Button
                                type="submit"
                                className="mx-auto h-11 w-full rounded-full bg-[#C99A2E] font-bold tracking-wide text-[#1F2023] uppercase shadow-sm transition-[background-color,box-shadow] duration-300 hover:bg-[#D8AB3E] hover:shadow-[0_0_20px_rgba(201,154,46,0.55)] focus-visible:bg-[#D8AB3E] focus-visible:shadow-[0_0_20px_rgba(201,154,46,0.55)] focus-visible:outline-none sm:w-1/2"
                                tabIndex={8}
                                disabled={processing || !agreed}
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
                                tabIndex={9}
                            >
                                Log in
                            </TextLink>
                        </div>
                    </>
                )}
            </Form>
        </>
    );
}

Register.layout = {
    variant: 'register',
    title: 'Registration',
    description: 'Fill in the details below to create your account.',
};