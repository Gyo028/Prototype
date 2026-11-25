import { Head, useForm } from '@inertiajs/react';
import { Info } from 'lucide-react';
import type { FormEvent } from 'react';
import { Field, GoldButton, inputClass, PageHeader, Panel } from '@/components/dashboard/ui';
import CustomerLayout from '@/layouts/customer-layout';

type Profile = {
    firstName: string;
    lastName: string;
    email: string;
    contactNumber: string;
    companyName: string;
    address: string;
};

type Props = {
    profile: Profile;
    /** False until a contact number is saved; a service request needs one. */
    complete: boolean;
};

/**
 * Customer > My Profile. Registration asks only for the name, email and
 * password; the contact number is added here before the first service request.
 */
export default function CustomerProfile({ profile, complete }: Props) {
    const { data, setData, patch, processing, errors } = useForm({
        first_name: profile.firstName,
        last_name: profile.lastName,
        contact_number: profile.contactNumber,
        company_name: profile.companyName,
        address: profile.address,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        patch('/customer/profile', { preserveScroll: true });
    };

    return (
        <CustomerLayout>
            <Head title="My Profile" />

            <div className="max-w-3xl">
                <PageHeader title="My Profile" description="Your details, so our team can reach you about your events." />

                {!complete && (
                    <p className="mb-5 flex items-start gap-2 rounded-xl border border-gold/40 bg-cream px-4 py-3 text-sm text-ink">
                        <Info className="mt-0.5 size-4 shrink-0 text-gold-dark" />
                        Welcome{profile.firstName ? `, ${profile.firstName}` : ''}! Add your contact number to start sending service requests.
                    </p>
                )}

                <form onSubmit={submit} noValidate>
                    <Panel className="space-y-5 p-5 md:p-7">
                        <h2 className="text-base font-bold text-ink">Account</h2>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <Field label="First Name" htmlFor="first_name" required error={errors.first_name}>
                                <input
                                    id="first_name"
                                    className={inputClass}
                                    value={data.first_name}
                                    onChange={(e) => setData('first_name', e.target.value)}
                                    maxLength={50}
                                    autoComplete="given-name"
                                />
                            </Field>
                            <Field label="Last Name" htmlFor="last_name" required error={errors.last_name}>
                                <input
                                    id="last_name"
                                    className={inputClass}
                                    value={data.last_name}
                                    onChange={(e) => setData('last_name', e.target.value)}
                                    maxLength={50}
                                    autoComplete="family-name"
                                />
                            </Field>
                        </div>

                        <Field label="Email Address" htmlFor="email">
                            <input id="email" type="email" className={inputClass} value={profile.email} disabled readOnly />
                        </Field>

                        <div className="border-t border-black/10" />

                        <h2 className="text-base font-bold text-ink">Contact details</h2>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <Field label="Contact Number" htmlFor="contact_number" required error={errors.contact_number}>
                                <input
                                    id="contact_number"
                                    type="tel"
                                    inputMode="tel"
                                    className={inputClass}
                                    value={data.contact_number}
                                    onChange={(e) => setData('contact_number', e.target.value)}
                                    maxLength={20}
                                    placeholder="09XXXXXXXXX"
                                    autoComplete="tel"
                                />
                                {!errors.contact_number && <p className="text-xs text-ink-soft">09XXXXXXXXX or +639XXXXXXXXX</p>}
                            </Field>
                            <Field label="Company / Organization (optional)" htmlFor="company_name" error={errors.company_name}>
                                <input
                                    id="company_name"
                                    className={inputClass}
                                    value={data.company_name}
                                    onChange={(e) => setData('company_name', e.target.value)}
                                    maxLength={100}
                                    placeholder="Enter company name"
                                    autoComplete="organization"
                                />
                            </Field>
                        </div>

                        <Field label="Address (optional)" htmlFor="address" error={errors.address}>
                            <input
                                id="address"
                                className={inputClass}
                                value={data.address}
                                onChange={(e) => setData('address', e.target.value)}
                                maxLength={255}
                                placeholder="House no., street, city"
                                autoComplete="street-address"
                            />
                        </Field>

                        <div className="flex justify-end">
                            <GoldButton type="submit" disabled={processing} className="min-h-11 w-full px-6 sm:w-auto">
                                Save profile
                            </GoldButton>
                        </div>
                    </Panel>
                </form>
            </div>
        </CustomerLayout>
    );
}
