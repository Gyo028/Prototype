import { router } from '@inertiajs/react';
import { MapPin, Send, Video } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field, GoldButton, cx, inputClass } from '@/components/dashboard/ui';
import { PROJECTS_URL } from '@/components/project-manager/steps/step-ui';
import type { ConsultationMeeting } from '@/data/project-manager/projects';

/*
 * Adviser revision G3 (Nov 27): the online meeting link of an online consultation.
 * Online: the Project Manager pastes the meeting link (e.g. Google Meet) and sends it; it is
 * saved and emailed to the customer, can be sent again, and is not required before recording
 * the outcome. Face to face: shows where it is held (the groupmate's meeting_place).
 */
export default function MeetingLinkForm({ projectId, meeting }: { projectId: number; meeting: ConsultationMeeting }) {
    const [link, setLink] = useState(meeting.link ?? '');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    if (meeting.mode === 'Face to face') {
        return (
            <p className="mb-4 flex items-center gap-2 text-sm text-ink">
                <MapPin className="size-4 text-gold-dark" />
                Face-to-face consultation{meeting.place ? <> at <b>{meeting.place}</b></> : ''}.
            </p>
        );
    }

    const send = () => {
        const text = link.trim();
        if (!text) return setError('Paste the meeting link.');
        if (!/^https:\/\/\S+$/i.test(text)) return setError('Enter a valid meeting link that starts with https://.');
        setError('');

        router.patch(
            `${PROJECTS_URL}/${projectId}/consultation/meeting-link`,
            { link: text },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => toast.success('The meeting link was emailed to the customer.'),
                onError: (err) => setError(String(err.link ?? 'The meeting link was not sent.')),
            },
        );
    };

    return (
        <div className="mb-4 grid gap-3 rounded-xl border border-gold/40 bg-gold/5 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <Video className="size-4 text-gold-dark" /> Online consultation
            </p>

            {meeting.link && (
                <p className="text-sm break-all text-ink">
                    Link sent to the customer:{' '}
                    <a href={meeting.link} target="_blank" rel="noreferrer" className="font-semibold text-gold underline-offset-2 hover:underline">
                        {meeting.link}
                    </a>
                </p>
            )}

            <Field label={meeting.link ? 'Change the meeting link' : 'Meeting link (e.g. Google Meet)'} htmlFor="meeting-link" error={error}>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                        id="meeting-link"
                        type="url"
                        maxLength={500}
                        value={link}
                        onChange={(e) => {
                            setLink(e.target.value);
                            if (error) setError('');
                        }}
                        placeholder="https://meet.google.com/abc-defg-hij"
                        className={cx(inputClass, 'flex-1', error && 'border-red-500')}
                    />
                    <GoldButton onClick={send} disabled={saving}>
                        <Send className="size-4" /> {saving ? 'Sending...' : meeting.link ? 'Send Again' : 'Send Link'}
                    </GoldButton>
                </div>
            </Field>
        </div>
    );
}