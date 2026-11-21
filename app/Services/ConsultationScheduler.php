<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;

/**
 * The consultation booking rules (Plan Project step 1).
 * 1-hour slots, 9:00 AM to 4:00 PM starts. The shared rules are in AppointmentScheduler.
 *
 * One active consultation per project. The customer can reschedule or cancel,
 * with a reason, until the day before the appointment.
 */
class ConsultationScheduler extends AppointmentScheduler
{
    public const TYPE = ProjectSchedule::TYPE_CONSULTATION;

    public const NOUN = 'consultation';

    public const SLOT_MINUTES = 60;

    public function bookingBlockedReason(Project $project): ?string
    {
        if ((int) $project->current_status_id !== ProjectStatus::idFor(ProjectStatus::CONSULTATION)) {
            return 'The consultation stage of this project is finished.';
        }

        if ($this->held($project) !== null || $project->customer_proceed_decision !== null) {
            return 'Your consultation has already been held.';
        }

        if ($this->current($project) !== null) {
            return 'You already have a consultation booked. Reschedule it instead.';
        }

        if ($this->earliestDate()->gt($this->latestDate($project))) {
            return 'Your event is too close for a consultation to be booked online. Please contact us.';
        }

        return null;
    }
}
