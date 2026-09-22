import { Link } from '@inertiajs/react';
import { UserRound } from 'lucide-react';
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
    default: 'max-w-md border border-cream-dark shadow-sm',
    login: 'max-w-lg border border-transparent shadow-lg',
    register: 'max-w-3xl border border-cream-dark shadow-none',
};

export default function AuthSimpleLayout({
    children,
    title,
    description,
    variant = 'default',
}: Props) {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-cream p-6 md:p-10">
            <div
                className={`w-full rounded-2xl bg-white p-8 md:p-10 ${cardStyles[variant]}`}
            >
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

                    {variant === 'login' && (
                        <div className="flex flex-col items-center gap-3">
                            <div className="flex size-16 items-center justify-center rounded-full bg-gold/20">
                                <UserRound
                                    className="size-8 text-gold"
                                    strokeWidth={1.75}
                                />
                            </div>
                            <p className="text-center text-sm text-ink-soft">
                                {description}
                            </p>
                        </div>
                    )}

                    {variant === 'register' && (
                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-ink">
                                {title}
                            </h1>
                            <p className="text-sm text-ink">{description}</p>
                        </div>
                    )}

                    {children}
                </div>
            </div>
        </div>
    );
}
