import { usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';

/**
 * Wraps every public page. When the path changes, the content area re-mounts
 * and fades in (see .page-enter in app.css). The fixed top nav stays put.
 */
export default function PublicTransition({ children }: PropsWithChildren) {
    const path = usePage().url.split(/[?#]/)[0] || '/';

    return (
        <div key={path} className="page-enter">
            {children}
        </div>
    );
}
