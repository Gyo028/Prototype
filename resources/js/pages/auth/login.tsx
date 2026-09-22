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
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

export default function Login({ status, canResetPassword }: Props) {
    useEffect(() => {
        // Already logged in (e.g. pressed Back)? The server redirects to the dashboard.
        router.reload({ replace: true });
    }, []);

    return (
        <>
            <Head title="Log in" />

            {status && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">
                    {status}
                </div>
            )}

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-5"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password">Password</Label>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                />
                                <InputError message={errors.password} />
                            </div>

                            {/* Figma: Remember me on the left, Forgot Password? on the right */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <Checkbox
                                        id="remember"
                                        name="remember"
                                        tabIndex={3}
                                        className="data-[state=checked]:border-gold data-[state=checked]:bg-gold"
                                    />
                                    <Label
                                        htmlFor="remember"
                                        className="font-normal"
                                    >
                                        Remember me
                                    </Label>
                                </div>
                                {canResetPassword && (
                                    <TextLink
                                        href={request()}
                                        className="text-sm font-bold text-gold decoration-transparent hover:text-gold-dark"
                                        tabIndex={6}
                                    >
                                        Forgot Password?
                                    </TextLink>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="h-11 w-full bg-gold font-bold text-white hover:bg-gold-dark"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                Login
                            </Button>

                            <OrDivider />
                            <GoogleButton />
                        </div>

                        <div className="text-center text-sm text-ink">
                            Don't have an account?{' '}
                            <TextLink
                                href={register()}
                                className="font-bold text-gold underline decoration-gold hover:text-gold-dark"
                                tabIndex={7}
                            >
                                Register
                            </TextLink>
                        </div>
                    </>
                )}
            </Form>
        </>
    );
}

Login.layout = {
    // Figma shows only the user icon and this subtitle (drawn by the layout).
    variant: 'login',
    title: '',
    description: 'Sign in to continue to your account',
};
