<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Mail\MeetingLinkMail;
use App\Models\Project;
use App\Models\ProjectSchedule;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Adviser revision G3 (Nov 27): the online meeting link of an online consultation.
 * When the customer booked an online consultation, the Project Manager pastes the meeting
 * link (e.g. Google Meet) and sends it. The rest of the consultation step is unchanged.
 *
 * Decided with the user (Nov 27): the link is saved on the booking
 * (project_schedules.meeting_link) and emailed to the customer; it is not required before
 * recording the outcome, and it can be sent again or changed.
 */
class MeetingLinkController extends Controller
{
    public const LINK_MAX = 500;

    public function send(Request $request, Project $project): RedirectResponse
    {
        $data = $request->validate([
            'link' => ['required', 'url:https', 'max:'.self::LINK_MAX],
        ], [
            'link.required' => 'Paste the meeting link.',
            'link.url' => 'Enter a valid meeting link that starts with https://.',
            'link.max' => 'The link can be up to '.self::LINK_MAX.' characters.',
        ]);

        $booking = $project->schedules()
            ->where('schedule_type', ProjectSchedule::TYPE_CONSULTATION)
            ->whereIn('schedule_status', ProjectSchedule::ACTIVE_STATUSES)
            ->first();

        if ($booking === null) {
            throw ValidationException::withMessages(['link' => 'There is no booked consultation.']);
        }
        if ($booking->meeting_mode !== ProjectSchedule::MODE_ONLINE) {
            throw ValidationException::withMessages(['link' => 'The customer booked a face-to-face consultation.']);
        }

        $email = $project->serviceRequest?->customer?->user?->email;
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw ValidationException::withMessages(['link' => 'The customer has no email address.']);
        }

        $link = trim($data['link']);

        // Emailed first; saved only once the email went out.
        try {
            Mail::to($email)->send(new MeetingLinkMail([
                'customer' => $project->serviceRequest->customer->full_name,
                'project' => (string) $project->project_code,
                'when' => $booking->start_datetime->format('l, M j, Y g:i A'),
                'link' => $link,
                'manager' => $project->projectManager?->full_name ?? 'Project Manager',
            ]));
        } catch (Throwable $e) {
            report($e);
            throw ValidationException::withMessages(['link' => 'The email could not be sent. Check the mail settings and try again.']);
        }

        $booking->update(['meeting_link' => $link]);

        return back();
    }

    /**
     * How and where the booked consultation is held, for the consultation step.
     *
     * @return array{mode: string, place: string|null, link: string|null}
     */
    public static function page(ProjectSchedule $booking): array
    {
        return [
            'mode' => $booking->meeting_mode === ProjectSchedule::MODE_ONLINE ? 'Online' : 'Face to face',
            'place' => $booking->meeting_place ?: null, // the groupmate's column (face to face only)
            'link' => $booking->meeting_link ?: null,
        ];
    }
}