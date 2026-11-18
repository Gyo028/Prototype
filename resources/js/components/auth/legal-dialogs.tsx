import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const LAST_UPDATED = 'November 14, 2026';

type LegalSection = { title: string; text: string };

const termsSections: LegalSection[] = [
    {
        title: '1. Acceptance of These Terms',
        text: "By creating an account on the GR3AT A's Event Styling Services platform (the \"Platform\"), you confirm that you have read, understood and agree to these Terms & Conditions. If you do not agree, please do not create an account or use the Platform.",
    },
    {
        title: '2. About the Platform',
        text: "The Platform lets customers of GR3AT A's Event Styling Services submit event styling requests, review proposals and designs, and follow the progress of their projects. Using the Platform does not by itself create a booking.",
    },
    {
        title: '3. Your Account',
        text: 'You must provide accurate and complete information when you register and keep it up to date. You are responsible for keeping your password confidential and for all activity under your account. Tell us right away if you think your account has been used without your permission.',
    },
    {
        title: '4. Project Requests and Bookings',
        text: "A project request is an invitation for us to prepare a proposal and is not a confirmed booking. A booking is confirmed only when GR3AT A's accepts it in writing, for example through a signed quotation or contract. Availability, designs, materials and prices may change until a booking is confirmed.",
    },
    {
        title: '5. Payments, Changes and Cancellations',
        text: 'Fees, deposits, payment schedules and the cancellation or rescheduling policy for each project are stated in your quotation or contract. Requests to change the scope, date or venue of a confirmed project may affect the price and availability, and must be agreed in writing.',
    },
    {
        title: '6. Your Responsibilities',
        text: 'You agree to provide accurate event details, arrange venue access and any permits or approvals needed for the setup, and respond to our questions in good time. Delays or incorrect information from the client may affect the delivery of the project.',
    },
    {
        title: '7. Photos and Portfolio',
        text: "GR3AT A's may photograph or record completed setups and use the images in its portfolio, website and social media. If you prefer that your event is not shown, tell us in writing before the event.",
    },
    {
        title: '8. Intellectual Property',
        text: "Designs, concepts, drawings, fabricated items and website content created by GR3AT A's remain our property unless ownership is transferred in writing. You may not copy, resell or reuse them without our permission.",
    },
    {
        title: '9. Acceptable Use',
        text: "You agree not to misuse the Platform, including by submitting false requests, trying to access other people's accounts or data, interfering with the operation of the system, or using it for any unlawful purpose.",
    },
    {
        title: '10. Privacy and Personal Data',
        text: 'We collect and use your personal data as described in our Privacy Policy, which forms part of these Terms. By creating an account you also confirm that you have read the Privacy Policy.',
    },
    {
        title: '11. Limitation of Liability',
        text: "GR3AT A's is not responsible for delays or changes caused by events beyond our reasonable control, such as bad weather, venue restrictions, supplier delays or emergencies. To the extent allowed by law, our liability for any claim related to a project is limited to the amount you paid for the affected service.",
    },
    {
        title: '12. Suspension and Termination',
        text: 'We may suspend or close an account that breaks these Terms or is used in a harmful way. You may ask us to close your account at any time, subject to any unfinished projects and payments.',
    },
    {
        title: '13. Changes to These Terms',
        text: 'We may update these Terms from time to time. The latest version will be shown on the Platform with its update date, and continued use of the Platform means you accept the changes.',
    },
    {
        title: '14. Governing Law',
        text: 'These Terms are governed by the laws of the Republic of the Philippines.',
    },
    {
        title: '15. Contact',
        text: "For questions about these Terms, please contact GR3AT A's Event Styling Services through the contact details on our website.",
    },
];

const privacySections: LegalSection[] = [
    {
        title: '1. Who We Are',
        text: "GR3AT A's Event Styling Services (\"we\", \"us\") operates this Platform. This Privacy Policy explains what personal data we collect, how we use it, and the choices you have. By creating an account you confirm that you have read this policy.",
    },
    {
        title: '2. Information We Collect',
        text: 'Details you give us when you register: your full name, email address, phone number and, if any, your company or organization. We also store your password in a protected (hashed) form, the details of your event and project requests such as dates, venue, themes and notes, any messages you send us, and technical information such as your IP address, browser type and login activity.',
    },
    {
        title: '3. How We Use Your Information',
        text: 'We use your information to create and manage your account; to review and respond to your project requests, prepare quotations and deliver our services; to contact you about your projects, bookings and payments; to keep the Platform secure and prevent misuse; to improve the Platform and our services; and to meet our legal obligations.',
    },
    {
        title: '4. Legal Basis',
        text: 'We process your personal data with your consent, to carry out our agreement with you, to meet legal obligations, and for our legitimate business interests, in line with the Data Privacy Act of 2012 (Republic Act No. 10173).',
    },
    {
        title: '5. Who Can See Your Information',
        text: 'Your information is available only to authorized GR3AT A\'s personnel, such as administrators and the project managers handling your request. We may share it with trusted service providers that help us run the Platform (for example hosting, database and email services) and who must keep it confidential, or with authorities when the law requires it. We do not sell or rent your personal data.',
    },
    {
        title: '6. Cookies',
        text: 'We use essential cookies to keep you signed in and to protect your account, and a small preference cookie to remember your display settings. You can clear or block cookies in your browser, but some parts of the Platform may stop working.',
    },
    {
        title: '7. Data Security',
        text: 'We use reasonable organizational, physical and technical measures to protect your data, including role-based access and protected password storage. No online system is completely secure, so please keep your password private.',
    },
    {
        title: '8. How Long We Keep Your Data',
        text: 'We keep your information for as long as your account is active and as needed to complete your projects, resolve disputes and meet legal, tax and accounting requirements. After that, we delete or anonymize it.',
    },
    {
        title: '9. Your Rights',
        text: 'Under the Data Privacy Act, you have the right to be informed, to access your personal data, to correct it, to object to its processing, to ask for its deletion or blocking, to data portability, and to claim damages if your data is misused. You may also file a complaint with the National Privacy Commission. To use these rights, contact us using the details below.',
    },
    {
        title: '10. Third-Party Sign-In',
        text: 'If you choose to register with a third-party account such as Google, we receive basic profile details (such as your name and email address) from that provider. The provider\'s own privacy policy applies to how it handles your data.',
    },
    {
        title: "11. Children's Privacy",
        text: 'The Platform is not intended for people under 18, and we do not knowingly collect their personal data.',
    },
    {
        title: '12. Changes to This Policy',
        text: 'We may update this policy from time to time. The latest version will be shown on the Platform with its update date.',
    },
    {
        title: '13. Contact Us',
        text: "For questions or requests about your personal data, please contact GR3AT A's Event Styling Services through the contact details on our website.",
    },
];


type LegalDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAgree: () => void;
};

function LegalDialog({
    title,
    sections,
    open,
    onOpenChange,
    onAgree,
}: LegalDialogProps & { title: string; sections: LegalSection[] }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="border-b px-6 py-5 pr-12 text-left">
                    <DialogTitle className="text-xl text-ink">{title}</DialogTitle>
                    <DialogDescription>
                        GR3AT A's Event Styling Services &middot; Last updated {LAST_UPDATED}
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm leading-6 text-ink-soft text-justify">
                    {sections.map((section) => (
                        <section key={section.title}>
                            <h3 className="font-semibold text-ink">{section.title}</h3>
                            <p className="mt-1">{section.text}</p>
                        </section>
                    ))}
                </div>

                <DialogFooter className="gap-2 border-t px-6 py-4 sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button
                        type="button"
                        className="rounded-full bg-[#C99A2E] font-bold text-[#1F2023] hover:bg-[#D8AB3E]"
                        onClick={() => {
                            onAgree();
                            onOpenChange(false);
                        }}
                    >
                        I Agree
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function TermsDialog(props: LegalDialogProps) {
    return <LegalDialog title="Terms & Conditions" sections={termsSections} {...props} />;
}

export function PrivacyDialog(props: LegalDialogProps) {
    return <LegalDialog title="Privacy Policy" sections={privacySections} {...props} />;
}