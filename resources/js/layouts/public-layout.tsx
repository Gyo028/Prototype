import { Head } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';

import Footer from '@/components/public/footer';
import Header from '@/components/public/header';

type Props = PropsWithChildren<{ title?: string }>;

export default function PublicLayout({ title = "GR3AT A's", children }: Props) {
    return (
        <div className="min-h-screen bg-white text-ink">
            <Head title={title} />
            <Header />
            <main>{children}</main>
            <Footer />
        </div>
    );
}