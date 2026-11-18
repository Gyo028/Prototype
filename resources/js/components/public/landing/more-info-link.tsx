import { Link } from '@inertiajs/react';

import { cn } from '@/lib/utils';

type Props = {
    href?: string;
    className?: string;
};

/** Gold "More Info ⟶" text link used in About and Services. */
export default function MoreInfoLink({ href = '#about', className }: Props) {
    const classes = cn(
        'group inline-flex items-center gap-4 text-sm text-[#E8830E] transition-colors hover:text-[#B8650A]',
        className,
    );

    const content = (
        <>
            More Info
            <svg
                aria-hidden="true"
                viewBox="0 0 48 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-12 transition-transform duration-200 group-hover:translate-x-1"
            >
                <path d="M1 6h45M41 1l5 5-5 5" />
            </svg>
        </>
    );

    // Links to another page use Inertia so the page changes without a full reload;
    // #section links stay plain anchors.
    if (href.startsWith('/') && !href.includes('#')) {
        return (
            <Link href={href} className={classes}>
                {content}
            </Link>
        );
    }

    return (
        <a href={href} className={classes}>
            {content}
        </a>
    );
}
