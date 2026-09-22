import { Link, usePage } from '@inertiajs/react';
import { Bell, Menu, Search, UserRound } from 'lucide-react';
import BrandLogo from '@/components/brand-logo';

type Props = {
    notificationsHref?: string;
    unreadCount?: number;
    /** Opens the sidebar drawer on small screens */
    onMenuClick?: () => void;
};

type SharedProps = { auth?: { user?: { name?: string } } };

export default function TopBar({
    notificationsHref,
    unreadCount = 0,
    onMenuClick,
}: Props) {
    const { props } = usePage<SharedProps>();
    const name = props.auth?.user?.name ?? 'User';

    return (
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-4 bg-white px-4 shadow-md md:px-8">
            {/* Left: menu button (small screens) and brand */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    className="rounded-md p-2 hover:bg-black/5 lg:hidden"
                    aria-label="Open menu"
                    onClick={onMenuClick}
                >
                    <Menu className="size-5" />
                </button>

                <Link href="/" aria-label="Back to home page">
                    <BrandLogo />
                </Link>
            </div>

            {/* Right: search, notifications, user */}
            <div className="flex items-center gap-4">
                <label className="hidden h-11 w-72 items-center gap-3 rounded-full bg-neutral-200 px-4 md:flex lg:w-80">
                    <Menu className="size-4 text-ink-soft" />
                    <input
                        type="search"
                        placeholder="Search"
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft"
                    />
                    <Search className="size-4 text-ink-soft" />
                </label>

                <Link
                    href={notificationsHref ?? '#'}
                    aria-label="Notifications"
                    className="relative rounded-md border border-ink/60 p-1.5"
                >
                    <Bell className="size-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-white">
                            {unreadCount}
                        </span>
                    )}
                </Link>

                <div
                    className="flex size-11 items-center justify-center rounded-full bg-purple-100 text-purple-700"
                    aria-label={name}
                >
                    <UserRound className="size-6" />
                </div>
            </div>
        </header>
    );
}
