<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;

/**
 * The ocular visit booking rules ( Plan Project step 3).
 *
 *  - Only when the consultation said a site visit is needed
 *    (projects.ocular_visit_required = true), after the reservation fee is
 *    verified (status Booked).
 *  - Always face to face, at the customer's venue; 2-hour slots
 *    (9:00, 11:00, 1:00 and 3:00), for travel and measuring.
 *  - The same lead time, days and taken-slot check as the consultation.
 *  - Reschedule only, with a reason, until the day before. There is no
 *    cancel: the visit is needed to continue.
 *
 * Booking moves the project from Booked to Site Assessment.
 */
class OcularVisitScheduler extends AppointmentScheduler
{
    public const TYPE = ProjectSchedule::TYPE_OCULAR_VISIT;

    public const NOUN = 'ocular visit';

    public const SLOT_MINUTES = 120;

    /** Statuses in which the customer may book (Site Assessment: e.g. after the PM cancelled the visit). */
    private const BOOKABLE_STATUSES = [ProjectStatus::BOOKED, ProjectStatus::SITE_ASSESSMENT];

    public function bookingBlockedReason(Project $project): ?string
    {
        $project->loadMissing('status');

        if ($project->ocular_visit_required !== true) {
            return 'No ocular visit is needed for this project.';
        }

        if (! in_array($project->status->status_name, self::BOOKABLE_STATUSES, true)) {
            return in_array($project->status->status_name, [ProjectStatus::CONSULTATION], true)
                ? 'You can book the ocular visit once your reservation fee is verified.'
                : 'The ocular visit stage of this project is finished.';
        }

        if ($this->held($project) !== null) {
            return 'Your ocular visit has already been held.';
        }

        if ($this->current($project) !== null) {
            return 'You already have an ocular visit booked. Reschedule it instead.';
        }

        if ($this->earliestDate()->gt($this->latestDate($project))) {
            return 'Your event is too close for an ocular visit to be booked online. Please contact us.';
        }

        return null;
    }
}
