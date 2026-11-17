/**
 * The GR3AT A's logo with the business name, for light backgrounds
 * (dashboard top bars, auth pages). Same logo image as the landing page nav.
 */
export default function BrandLogo() {
    return (
        <span className="flex items-center gap-3">
            <img
                src="/images/Logo.png"
                alt="GR3AT A's logo"
                className="size-12 shrink-0 rounded-full border-2 border-gold bg-black object-cover md:size-[52px]"
            />
            <span className="flex flex-col">
                <span className="text-[20px] leading-tight font-bold text-ink">GR3AT A's</span>
                <span className="mt-0.5 text-[8px] font-medium tracking-[.16em] text-ink-soft uppercase">
                    Event Styling Services
                </span>
            </span>
        </span>
    );
}
