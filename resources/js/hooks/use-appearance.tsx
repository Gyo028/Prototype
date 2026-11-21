/*
 * Appearance: one light theme for every device.
 *
 * The Laravel starter kit followed the device's dark mode ("system"), but the
 * app's screens are designed in light only, so dark mode left some text and
 * icons unreadable. The page is always light, even when the computer or phone
 * is set to dark mode. Dark mode may come back later as a polish item.
 *
 * The hook keeps its shape so the starter-kit components that use it
 * (toasts, two-factor setup) don't need changes.
 */

export type ResolvedAppearance = 'light' | 'dark';
export type Appearance = ResolvedAppearance | 'system';

export type UseAppearanceReturn = {
    readonly appearance: Appearance;
    readonly resolvedAppearance: ResolvedAppearance;
    readonly updateAppearance: (mode: Appearance) => void;
};

const applyLight = (): void => {
    if (typeof document === 'undefined') {
        return;
    }

    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
};

export function initializeTheme(): void {
    if (typeof window === 'undefined') {
        return;
    }

    // Clear a "dark" or "system" choice saved before the app went light-only.
    localStorage.removeItem('appearance');
    document.cookie = 'appearance=;path=/;max-age=0;SameSite=Lax';

    applyLight();
}

const LIGHT: UseAppearanceReturn = {
    appearance: 'light',
    resolvedAppearance: 'light',
    // Light only for now: any choice keeps the light theme.
    updateAppearance: () => applyLight(),
};

export function useAppearance(): UseAppearanceReturn {
    return LIGHT;
}
