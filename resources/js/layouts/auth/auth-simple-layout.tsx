import { Link } from '@inertiajs/react';
import { ArrowLeft, UserRound } from 'lucide-react';
import BrandLogo from '@/components/brand-logo';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

/**
 * default  - logo, centered title and description (forgot password, reset, etc.)
 * login    - Figma Login: round user icon and a centered subtitle, no logo or title
 * register - Figma Customer Registration: wider card, left-aligned heading, no logo
 */
type AuthLayoutVariant = 'default' | 'login' | 'register';

type Props = AuthLayoutProps & {
    variant?: AuthLayoutVariant;
};

const cardStyles: Record<AuthLayoutVariant, string> = {
    default: 'max-w-md border border-cream-dark bg-white shadow-sm',
    login: 'max-w-md border border-[#C99A2E] bg-white/85 shadow-[0_0_60px_12px_rgba(201,154,46,0.16),0_30px_90px_-20px_rgba(0,0,0,0.22)] backdrop-blur-md',
    register: 'max-w-3xl border border-[#C99A2E] bg-white/85 shadow-[0_0_60px_12px_rgba(201,154,46,0.16),0_30px_90px_-20px_rgba(0,0,0,0.22)] backdrop-blur-md',
};

export default function AuthSimpleLayout({
    children,
    title,
    description,
    variant = 'default',
}: Props) {
    // Login and register share the same gold-framed look.
    const isFramed = variant === 'login' || variant === 'register';

    return (
        <div
            className={`relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden p-6 md:p-10 ${isFramed ? 'bg-[#F6F1E6]' : 'bg-cream'}`}
        >
            {/* Login / register: soft blurred photo behind the frosted card */}
            {isFramed && (
                <>
                    <img
                        src="/images/hero-bg.webp"
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 -z-20 size-full scale-110 object-cover blur-md"
                    />
                    <div
                        aria-hidden="true"
                        className="absolute inset-0 -z-10 bg-white/65"
                    />
                </>
            )}

            <div
                className={`relative w-full rounded-2xl p-8 md:p-10 ${cardStyles[variant]}`}
            >
                {/* Login / register: back to the home page */}
                {isFramed && (
                    <Link
                        href={home()}
                        className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-[#C99A2E] transition-colors hover:bg-[#C99A2E]/10 hover:text-[#A67C1F] focus-visible:ring-2 focus-visible:ring-[#C99A2E]/40 focus-visible:outline-none md:top-5 md:left-5"
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        Back
                    </Link>
                )}

                <div className="flex flex-col gap-8">
                    {variant === 'default' && (
                        <div className="flex flex-col items-center gap-6">
                            <Link href={home()} aria-label="Back to home page">
                                <BrandLogo />
                            </Link>

                            <div className="space-y-2 text-center">
                                <h1 className="text-2xl font-bold text-ink">
                                    {title}
                                </h1>
                                <p className="text-center text-sm text-ink-soft">
                                    {description}
                                </p>
                            </div>
                        </div>
                    )}

                    {isFramed && (
                        <div className="flex flex-col items-center gap-3">
                            <div className="flex size-16 items-center justify-center rounded-full border border-[#C99A2E] bg-[#C99A2E]/10">
                                <UserRound
                                    className="size-8 text-[#C99A2E]"
                                    strokeWidth={1.75}
                                />
                            </div>
                            <div className="space-y-1.5 text-center">
                                {title && (
                                    <h1 className="font-['DM_Serif_Display',serif] text-3xl font-normal tracking-wide text-ink">
                                        {title}
                                    </h1>
                                )}
                                <p className="text-center text-sm text-ink-soft">
                                    {description}
                                </p>
                            </div>
                        </div>
                    )}

                    {children}
                </div>
            </div>
        </div>
    );
}
