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
                                    className="h-11 rounded-lg border-black/15 bg-white focus-visible:border-[#C99A2E] focus-visible:ring-[#C99A2E]/30"
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
                                    className="h-11 rounded-lg border-black/15 bg-white focus-visible:border-[#C99A2E] focus-visible:ring-[#C99A2E]/30"
                                />
                                <InputError message={errors.password} />
                            </div>

                            {/* Remember me on the left, Forgot Password? on the right */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <Checkbox
                                        id="remember"
                                        name="remember"
                                        tabIndex={3}
                                        className="data-[state=checked]:border-[#C99A2E] data-[state=checked]:bg-[#C99A2E]"
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
                                        className="text-sm font-bold text-[#C99A2E] decoration-transparent hover:text-[#A67C1F]"
                                        tabIndex={6}
                                    >
                                        Forgot Password?
                                    </TextLink>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="h-11 w-full rounded-full bg-[#C99A2E] font-bold tracking-wide text-[#1F2023] uppercase shadow-sm transition-[background-color,box-shadow] duration-300 hover:bg-[#D8AB3E] hover:shadow-[0_0_20px_rgba(201,154,46,0.55)] focus-visible:bg-[#D8AB3E] focus-visible:shadow-[0_0_20px_rgba(201,154,46,0.55)] focus-visible:outline-none"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                Login
                            </Button>

                            <OrDivider />
                            <GoogleButton className="rounded-full" />
                        </div>

                        <div className="text-center text-sm text-ink">
                            Don't have an account?{' '}
                            <TextLink
                                href={register()}
                                className="font-bold text-[#C99A2E] underline decoration-[#C99A2E] hover:text-[#A67C1F]"
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
    variant: 'login',
    description: 'Sign in to continue to your account',
};
