import { router } from '@inertiajs/react';
import { CalendarCheck, CalendarClock, History, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AppointmentCard, Block, BlockHeader, EMPTY_SLOT, Notice, ReasonField, SlotPicker } from '@/components/customer/appointment-parts';
import type { AppointmentErrors, AppointmentSlot } from '@/components/customer/appointment-parts';
import { formatLongDate, formatTime } from '@/components/customer/project-types';
import type { ConsultationInfo, ConsultationRules } from '@/components/customer/project-types';
import { DangerButton, GoldButton, OutlineButton } from '@/components/dashboard/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/*
 * Schedule a consultation appointment (Plan Project, step 1).
 *
 * The customer picks a date, a 1-hour slot, and online or face to face.
 * Face to face also needs the place (one line, any address; the customer's
 * choice is final). A day with every slot taken shows as "Booked".
 * Monday to Saturday, 9:00 AM – 5:00 PM, at least 7 days ahead and before
 * the event date. A booking is confirmed right away.
 *
 * The customer can reschedule or cancel, with a reason, until the day before
 * the appointment. Earlier bookings stay in the history with the reason.
 */

type Props = {
    projectId: number;
    consultation: ConsultationInfo;
    availableSlots: Record<string, string[]>;
    rules: ConsultationRules;
    /** The decision recorded after the consultation (null until then). */
    decision: 'proceed' | 'hold' | 'cancelled' | null;
};

const DECISION_TEXT: Record<'proceed' | 'hold' | 'cancelled', string> = {
    proceed: 'You decided to go ahead with the project.',
    hold: 'You put the project on hold for now.',
    cancelled: 'You decided not to go ahead with the project.',
};

type Slot = AppointmentSlot;
type Errors = AppointmentErrors;

export default function ConsultationPanel({ projectId, consultation, availableSlots, rules, decision }: Props) {
    const base = `/customer/projects/${projectId}/consultation`;
    const { current, history, canBook, bookingBlockedReason, canChange, changeBlockedReason, officeAddress, placeMax } = consultation;
    // The consultation that took place, shown as the summary; the rest stay in History.
    const held = history.find((s) => s.status === 'completed') ?? null;
    const earlier = history.filter((s) => s !== held);

    const [slot, setSlot] = useState<Slot>(EMPTY_SLOT);
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);
    const [dialog, setDialog] = useState<'reschedule' | 'cancel' | null>(null);
    const [reason, setReason] = useState('');

    const openDialog = (kind: 'reschedule' | 'cancel') => {
        setSlot(
            kind === 'reschedule'
                ? { ...EMPTY_SLOT, meetingMode: current?.meetingMode ?? '', meetingPlace: current?.meetingPlace ?? '' }
                : EMPTY_SLOT,
        );
        setReason('');
        setErrors({});
        setDialog(kind);
    };

    /** Checks the form before sending; the server checks everything again. */
    const checkSlot = (): Errors => {
        const e: Errors = {};
        if (!slot.meetingMode) e.meetingMode = 'Choose online or face to face.';
        else if (slot.meetingMode === 'face_to_face' && !slot.meetingPlace.trim()) e.meetingPlace = 'Tell us where to meet.';
        if (!slot.date) e.date = 'Pick a date.';
        else if (!slot.time) e.time = 'Pick a time.';
        return e;
    };

    const send = (method: 'post' | 'patch', url: string, data: Record<string, string>, done: string) => {
        setSaving(true);
        router[method](url, data, {
            preserveScroll: true,
            onSuccess: (page) => {
                // A rule broken on the server comes back as an error, not a success.
                const serverErrors = (page.props.errors ?? {}) as Errors;
                if (Object.keys(serverErrors).length > 0) {
                    setErrors(serverErrors);
                    return;
                }
                toast.success(done);
                setSlot(EMPTY_SLOT);
                setReason('');
                setDialog(null);
                setErrors({});
            },
            onError: (serverErrors) => setErrors(serverErrors as Errors),
            onFinish: () => setSaving(false),
        });
    };

    const book = () => {
        const e = checkSlot();
        setErrors(e);
        if (Object.keys(e).length === 0) send('post', base, slot, 'Your consultation is booked.');
    };

    const reschedule = () => {
        const e = checkSlot();
        if (!reason.trim()) e.reason = 'Please give a reason.';
        setErrors(e);
        if (Object.keys(e).length === 0) send('patch', `${base}/reschedule`, { ...slot, reason }, 'Your consultation has been moved.');
    };

    const cancel = () => {
        if (!reason.trim()) return setErrors({ reason: 'Please give a reason.' });
        send('patch', `${base}/cancel`, { reason }, 'Your consultation has been cancelled.');
    };

    return (
        <div className="grid gap-4">
            {errors.consultation && !dialog && <Notice tone="error">{errors.consultation}</Notice>}

            {current ? (
                <Block>
                    <BlockHeader title="Your consultation" description="Booked and confirmed" icon={<CalendarCheck className="size-5" />} />
                    <AppointmentCard schedule={current} />
                    {canChange ? (
                        <div className="mt-5 flex flex-wrap gap-3">
                            <OutlineButton onClick={() => openDialog('reschedule')}>
                                <CalendarClock className="size-4" /> Reschedule
                            </OutlineButton>
                            <DangerButton onClick={() => openDialog('cancel')}>
                                <X className="size-4" /> Cancel
                            </DangerButton>
                        </div>
                    ) : (
                        changeBlockedReason && <Notice className="mt-5">{changeBlockedReason}</Notice>
                    )}
                    {canChange && (
                        <p className="mt-3 text-xs text-ink-soft">
                            You can reschedule or cancel until {rules.changeCutoffDays} day before the appointment.
                        </p>
                    )}
                </Block>
            ) : canBook ? (
                <Block>
                    <BlockHeader
                        title="Book your consultation"
                        description="Meet with our Project Manager to discuss your requirements."
                        icon={<CalendarCheck className="size-5" />}
                    />
                    <SlotPicker
                        noun="consultation"
                        withMeetingMode
                        officeAddress={officeAddress}
                        placeMax={placeMax}
                        slot={slot}
                        setSlot={setSlot}
                        errors={errors}
                        availableSlots={availableSlots}
                        rules={rules}
                        footer={
                            <GoldButton onClick={book} disabled={saving}>
                                {saving ? 'Booking…' : 'Book Consultation'}
                            </GoldButton>
                        }
                    />
                </Block>
            ) : held ? (
                <Block>
                    <BlockHeader title="Consultation held" description="Thank you for meeting with us" icon={<CalendarCheck className="size-5" />} />
                    <AppointmentCard schedule={held} />
                    <Notice className="mt-5">{decision ? DECISION_TEXT[decision] : 'Our Project Manager is recording the outcome of your consultation.'}</Notice>
                </Block>
            ) : (
                bookingBlockedReason && (
                    <Block>
                        <BlockHeader title="Consultation" icon={<CalendarCheck className="size-5" />} />
                        <Notice>{bookingBlockedReason}</Notice>
                    </Block>
                )
            )}

            {earlier.length > 0 && (
                <Block>
                    <BlockHeader title="History" description="Earlier bookings for this project" icon={<History className="size-5" />} />
                    <ul className="grid gap-3">
                        {earlier.map((s) => (
                            <li key={s.id} className="rounded-xl border border-black/10 p-4">
                                <AppointmentCard schedule={s} compact />
                            </li>
                        ))}
                    </ul>
                </Block>
            )}

            <Dialog open={dialog === 'reschedule'} onOpenChange={(open) => !open && setDialog(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto p-4 sm:max-w-3xl sm:p-6">
                    <DialogHeader>
                        <DialogTitle>Reschedule consultation</DialogTitle>
                        <DialogDescription>
                            {current && `Currently ${formatLongDate(current.date)}, ${formatTime(current.startTime)}. `}
                            Pick a new date and time, and tell us why.
                        </DialogDescription>
                    </DialogHeader>
                    {errors.consultation && <Notice tone="error">{errors.consultation}</Notice>}
                    <SlotPicker
                        noun="consultation"
                        withMeetingMode
                        officeAddress={officeAddress}
                        placeMax={placeMax}
                        slot={slot}
                        setSlot={setSlot}
                        errors={errors}
                        availableSlots={availableSlots}
                        rules={rules}
                    />
                    <ReasonField id="consultation-reason" value={reason} onChange={setReason} error={errors.reason} max={rules.reasonMax} />
                    <DialogFooter>
                        <OutlineButton onClick={() => setDialog(null)}>Back</OutlineButton>
                        <GoldButton onClick={reschedule} disabled={saving}>
                            {saving ? 'Saving…' : 'Move Consultation'}
                        </GoldButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={dialog === 'cancel'} onOpenChange={(open) => !open && setDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel consultation</DialogTitle>
                        <DialogDescription>
                            {current && `${formatLongDate(current.date)}, ${formatTime(current.startTime)}. `}
                            You can book a new one afterwards.
                        </DialogDescription>
                    </DialogHeader>
                    {errors.consultation && <Notice tone="error">{errors.consultation}</Notice>}
                    <ReasonField id="consultation-reason" value={reason} onChange={setReason} error={errors.reason} max={rules.reasonMax} />
                    <DialogFooter>
                        <OutlineButton onClick={() => setDialog(null)}>Keep It</OutlineButton>
                        <DangerButton onClick={cancel} disabled={saving}>
                            {saving ? 'Cancelling…' : 'Cancel Consultation'}
                        </DangerButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
