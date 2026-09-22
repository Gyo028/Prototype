export default function BrandLogo() {
    return (
        <span className="flex items-center gap-3">
            <span className="flex h-[52px] w-[52px] flex-col items-center justify-center rounded-full bg-ink">
                <span className="text-lg leading-none font-extrabold text-gold">G</span>
                <span className="mt-0.5 text-[6px] leading-none font-bold tracking-wider text-white">
                    R3AT A's
                </span>
                <span className="mt-0.5 text-[7px] leading-none text-gold">★</span>
            </span>
            <span className="flex flex-col">
                <span className="text-[20px] leading-tight font-bold text-ink">GR3AT A's</span>
                <span className="mt-0.5 text-[8px] font-medium tracking-[.16em] text-ink-soft uppercase">
                    Event Styling Services
                </span>
            </span>
        </span>
    );
}
