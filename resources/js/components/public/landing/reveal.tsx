import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type Props = {
    children: ReactNode;
    className?: string;
    delay?: number;
};

export default function Reveal({ children, className = '', delay = 0 }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setShown(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setShown(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
        );

        observer.observe(el);

        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            style={{ transitionDelay: `${delay}ms` }}
            className={`transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${
                shown ? 'translate-y-0 opacity-100' : 'translate-y-7 opacity-0'
            } ${className}`}
        >
            {children}
        </div>
    );
}
