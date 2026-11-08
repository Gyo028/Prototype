import { router } from '@inertiajs/react';
import { Check, Mail, Phone, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Field, GoldButton, OutlineButton, Panel, PanelHeader, inputClass } from '@/components/dashboard/ui';



const LIMITS = { phone: 30, email: 100, address: 150, url: 200, copyright: 150 };

const CONTACT_URL = '/technical-admin/website-content/contact';
export type Contact = {
    phone: string;
    email: string;
    address: string;
    facebook: string;
    instagram: string;
    copyright: string;
};


const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const urlOk = (v: string) => /^https?:\/\/\S+\.\S+/.test(v);

export default function ContactFooterEditor({ contact: initial }: { contact: Contact }) {
    const [saved, setSaved] = useState<Contact>(initial);
    const [contact, setContact] = useState<Contact>(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const dirty = JSON.stringify(contact) !== JSON.stringify(saved);

    const change = (changes: Partial<Contact>) => {
        setContact({ ...contact, ...changes });
        setMessage('');
    };

    const save = () => {
        const e: Record<string, string> = {};
        const email = contact.email.trim();

        if (!contact.phone.trim()) e.phone = 'Phone number is required.';
        else if (contact.phone.replace(/\D/g, '').length < 7) e.phone = 'Enter a valid phone number.';
        if (!email) e.email = 'Email is required.';
        else if (!emailOk(email)) e.email = 'Enter a valid email address.';
        if (!contact.address.trim()) e.address = 'Address is required.';
        if (contact.facebook.trim() && !urlOk(contact.facebook.trim())) e.facebook = 'Enter a full link starting with https://';
        if (contact.instagram.trim() && !urlOk(contact.instagram.trim())) e.instagram = 'Enter a full link starting with https://';
        if (!contact.copyright.trim()) e.copyright = 'Copyright line is required.';
        setErrors(e);
        if (Object.keys(e).length) return;

        router.put(CONTACT_URL, contact, {
            preserveScroll: true,
            preserveState: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onSuccess: () => {
                setSaved(contact);
                setMessage('Changes saved');
            },
            onError: (serverErrors) => setErrors(serverErrors),
        });
    };

    const reset = () => {
        setContact(saved);
        setErrors({});
        setMessage('');
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
                <Panel>
                    <PanelHeader
                        title="Contact Details"
                        description="Shown in the footer of every public page"
                        icon={<Phone className="size-5" />}
                    />
                    <div className="space-y-4">
                        <Field label="Phone" htmlFor="ct-phone" required error={errors.phone}>
                            <input
                                id="ct-phone"
                                type="tel"
                                className={inputClass}
                                maxLength={LIMITS.phone}
                                value={contact.phone}
                                onChange={(e) => change({ phone: e.target.value })}
                            />
                        </Field>
                        <Field label="Email" htmlFor="ct-email" required error={errors.email}>
                            <input
                                id="ct-email"
                                type="email"
                                className={inputClass}
                                maxLength={LIMITS.email}
                                value={contact.email}
                                onChange={(e) => change({ email: e.target.value })}
                            />
                        </Field>
                        <Field label="Address" htmlFor="ct-address" required error={errors.address}>
                            <input
                                id="ct-address"
                                className={inputClass}
                                maxLength={LIMITS.address}
                                value={contact.address}
                                onChange={(e) => change({ address: e.target.value })}
                            />
                        </Field>
                    </div>
                </Panel>

                <Panel>
                    <PanelHeader
                        title="Social Media & Copyright"
                        description="Leave a link empty to hide its icon"
                        icon={<Mail className="size-5" />}
                    />
                    <div className="space-y-4">
                        <Field label="Facebook page link" htmlFor="ct-fb" error={errors.facebook}>
                            <input
                                id="ct-fb"
                                type="url"
                                placeholder="https://facebook.com/..."
                                className={inputClass}
                                maxLength={LIMITS.url}
                                value={contact.facebook}
                                onChange={(e) => change({ facebook: e.target.value })}
                            />
                        </Field>
                        <Field label="Instagram link" htmlFor="ct-ig" error={errors.instagram}>
                            <input
                                id="ct-ig"
                                type="url"
                                placeholder="https://instagram.com/..."
                                className={inputClass}
                                maxLength={LIMITS.url}
                                value={contact.instagram}
                                onChange={(e) => change({ instagram: e.target.value })}
                            />
                        </Field>
                        <Field label="Copyright line" htmlFor="ct-copyright" required error={errors.copyright}>
                            <input
                                id="ct-copyright"
                                className={inputClass}
                                maxLength={LIMITS.copyright}
                                value={contact.copyright}
                                onChange={(e) => change({ copyright: e.target.value })}
                            />
                        </Field>
                    </div>
                </Panel>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
                {message && <span className="text-xs font-semibold text-green-700">{message}</span>}
                {dirty && !message && <span className="text-xs text-ink-soft">You have unsaved changes</span>}
                <OutlineButton onClick={reset} disabled={!dirty}>
                    <RotateCcw className="size-4" /> Reset
                </OutlineButton>
                <GoldButton onClick={save} disabled={!dirty || saving}>
                    <Check className="size-4" /> Save Changes
                </GoldButton>
            </div>
        </div>
    );
}
