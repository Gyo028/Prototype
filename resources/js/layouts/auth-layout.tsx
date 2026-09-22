import type { ComponentProps } from 'react';
import AuthLayoutTemplate from '@/layouts/auth/auth-simple-layout';

export default function AuthLayout(
    props: ComponentProps<typeof AuthLayoutTemplate>,
) {
    return <AuthLayoutTemplate {...props} />;
}