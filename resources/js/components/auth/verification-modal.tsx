import { router } from '@inertiajs/react';
import { MailCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

/**
 * "Verify your email" on the login page: after registering, or when an
 * unverified account tries to log in (the account is not logged in). Resend
 * sends the email again to that account only, at most once a minute.
 */
export type Verification = {
    reason: 'registered' | 'login' | 'resent';
    email: string;
    /** Seconds until Resend can be used again. */
    retryAfter: number;
};

const TEXT: Record<Verification['reason'], { title: string; body: (email: string) => string }> = {
    registered: {
        title: 'Check your email',
        body: (email) => `Your account is created. We sent a verification link to ${email}. Click it to activate your account, then log in.`,
    },
    login: {
        title: 'Verify your email first',
        body: (email) => `Your account isn't verified yet. Click the link we sent to ${email}, then log in again.`,
    },
    resent: {
        title: 'Email sent again',
        body: (email) => `We sent a new verification link to ${email}. It can take a minute to arrive.`,
    },
};

export default function VerificationModal({ verification }: { verification?: Verification | null }) {
    // The last modal the server sent. It stays when a later reload of the page
    // has none (the server sends it once), until the customer closes it.
    const [shown, setShown] = useState<Verification | null>(verification ?? null);
    const [open, setOpen] = useState(Boolean(verification));
    const [wait, setWait] = useState(verification?.retryAfter ?? 0);
    const [sending, setSending] = useState(false);

    // A new modal from the server (after Resend, or another login attempt).
    useEffect(() => {
        if (!verification) return;
        setShown(verification);
        setOpen(true);
        setWait(verification.retryAfter);
    }, [verification]);

    // Count down to when Resend works again.
    useEffect(() => {
        if (wait <= 0) return;
        const timer = setTimeout(() => setWait((w) => w - 1), 1000);
        return () => clearTimeout(timer);
    }, [wait]);

    if (!shown) return null;

    const text = TEXT[shown.reason];

    const resend = () =>
        router.post('/email/verification/resend', {}, {
            preserveScroll: true,
            onStart: () => setSending(true),
            onFinish: () => setSending(false),
        });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="items-center text-center sm:text-center">
                    <span aria-hidden className="mb-2 flex size-14 items-center justify-center rounded-full bg-[#F5EDD8] text-[#8B6914]">
                        <MailCheck className="size-7" />
                    </span>
                    <DialogTitle className="text-xl">{text.title}</DialogTitle>
                    <DialogDescription className="text-sm leading-relaxed text-ink">{text.body(shown.email)}</DialogDescription>
                </DialogHeader>

                <p className="text-center text-xs text-ink-soft">Not in your inbox? Check Spam or Promotions. The link works for 60 minutes.</p>

                <DialogFooter className="gap-2 sm:justify-center">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={resend}
                        disabled={wait > 0 || sending}
                        className="h-11 rounded-full border-[#C99A2E] font-bold"
                    >
                        {sending && <Spinner />}
                        {wait > 0 ? `Resend in ${wait}s` : 'Resend email'}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="h-11 rounded-full bg-[#C99A2E] px-8 font-bold text-[#1F2023] hover:bg-[#D8AB3E]"
                    >
                        OK
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
