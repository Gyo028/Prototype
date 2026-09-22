import { Form, Head, router } from '@inertiajs/react';
import { useEffect } from 'react';
import { GoogleButton, OrDivider } from '@/components/auth/google-button';
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

function Required() {
    return <span className="text-red-600">*</span>;
}

export default function Register({ passwordRules }: Props) {
    useEffect(() => {
        // Already logged in (e.g. pressed Back)? The server redirects to the dashboard.
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
                            {/* Row 1: Full Name | Email Address */}
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
                                        placeholder="Enter your email address"
                                    />
                                    <InputError message={errors.email} />
                                </div>
                            </div>

                            {/* Row 2: Phone Number | Company / Organization */}
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
                                        placeholder="Enter company name"
                                    />
                                    <InputError message={errors.company} />
                                </div>
                            </div>

                            {/* Row 3: Password | Confirm Password */}
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
                                        placeholder="Confirm your password"
                                        passwordrules={passwordRules}
                                    />
                                    <InputError
                                        message={errors.password_confirmation}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-3">
                                <Checkbox
                                    id="terms"
                                    name="terms"
                                    required
                                    tabIndex={7}
                                    className="data-[state=checked]:border-ink data-[state=checked]:bg-ink"
                                />
                                <Label htmlFor="terms" className="text-sm font-normal">
                                    I agree to the{' '}
                                    <a href="#" className="font-bold text-gold underline hover:text-gold-dark">
                                        Terms &amp; Conditions
                                    </a>{' '}
                                    and{' '}
                                    <a href="#" className="font-bold text-gold underline hover:text-gold-dark">
                                        Privacy Policy
                                    </a>
                                </Label>
                            </div>

                            <Button
                                type="submit"
                                className="mx-auto h-11 w-1/2  bg-gold font-normal text-white hover:bg-gold-dark"
                                tabIndex={8}
                                disabled={processing}
                                data-test="register-user-button"
                            >
                                {processing && <Spinner />}
                                Create Account
                            </Button>
                            <div className="mx-auto w-1/2">
                                <OrDivider label="or register with" />
                            </div>
                            <div className="mx-auto w-1/2">
                                <GoogleButton />
                            </div>
                        </div>

                        <div className="text-center text-sm text-ink">
                            Already have an account?{' '}
                            <TextLink
                                href={login()}
                                className="font-bold text-gold underline decoration-gold hover:text-gold-dark"
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
    title: 'Customer Registration',
    description: 'Fill in the details below to create your account.',
};
