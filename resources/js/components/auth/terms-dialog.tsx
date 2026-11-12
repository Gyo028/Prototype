import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const LAST_UPDATED = 'November 12, 2026';

// The text of the Terms & Conditions. Edit the wording here.
const sections: { title: string; text: string }[] = [
    {
        title: '1. Acceptance of These Terms',
        text: "By creating an account on the GR3AT A's Event Styling Services platform (the \"Platform\"), you confirm that you have read, understood and agree to these Terms & Conditions. If you do not agree, please do not create an account or use the Platform.",
    },
    {
        title: '2. About the Platform',
        text: 'The Platform lets customers of GR3AT A\'s Event Styling Services submit event styling requests, review proposals and designs, and follow the progress of their projects. Using the Platform does not by itself create a booking.',
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
        text: 'We collect the details you provide, such as your name, email address, phone number, company and event information, to create your account, process your requests and communicate with you. We handle personal data in line with the Data Privacy Act of 2012 (Republic Act No. 10173) and our Privacy Policy.',
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

type TermsDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called when the person clicks "I Agree" */
    onAgree: () => void;
};

export default function TermsDialog({ open, onOpenChange, onAgree }: TermsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="border-b px-6 py-5 pr-12 text-left">
                    <DialogTitle className="text-xl text-ink">Terms &amp; Conditions</DialogTitle>
                    <DialogDescription>
                        GR3AT A's Event Styling Services &middot; Last updated {LAST_UPDATED}
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm leading-6 text-ink-soft">
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
                        className="bg-gold text-white hover:bg-gold-dark"
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