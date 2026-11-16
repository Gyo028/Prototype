<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * The consultation booking rules (story 15, Plan Project), in one place.
 *
 *  - Monday to Saturday, 1-hour slots from 9:00 AM; the last one starts at 4:00 PM.
 *  - At least 7 days from today, and before the event date (custom: the first day).
 *  - A slot is taken when any active consultation or ocular visit (any project)
 *    overlaps it.
 *  - Booked = confirmed right away (no Project Manager approval).
 *  - One active consultation per project. The customer can reschedule or cancel,
 *    with a reason, until the day before the appointment.
 *
 * Dates are worked out in Manila time, whatever the app's timezone is.
 */
class ConsultationScheduler
{
    public const TIMEZONE = 'Asia/Manila';

    public const LEAD_DAYS = 7;

    public const FIRST_HOUR = 9;

    /** Slots end by this hour, so the last slot starts an hour earlier. */
    public const CLOSING_HOUR = 17;

    public const SLOT_MINUTES = 60;

    /** The customer can change the booking until this many days before it. */
    public const CHANGE_CUTOFF_DAYS = 1;

    /** How far ahead the calendar offers slots when the event is far away. */
    public const MAX_WINDOW_DAYS = 120;

    /** Schedule types that use the same slots (the Project Manager attends both). */
    private const SLOT_TYPES = [ProjectSchedule::TYPE_CONSULTATION, ProjectSchedule::TYPE_OCULAR_VISIT];

    public function today(): Carbon
    {
        return Carbon::now(self::TIMEZONE)->startOfDay();
    }

    public function earliestDate(): Carbon
    {
        return $this->today()->addDays(self::LEAD_DAYS);
    }

    /** The last day a consultation can be on: the day before the event starts. */
    public function latestDate(Project $project): Carbon
    {
        $eventStart = Carbon::parse($project->serviceRequest->start_date->toDateString(), self::TIMEZONE);
        $windowEnd = $this->earliestDate()->addDays(self::MAX_WINDOW_DAYS);

        return $eventStart->subDay()->min($windowEnd);
    }

    /** Start times offered each open day: ['09:00', '10:00', ... '16:00']. */
    public function slotTimes(): array
    {
        $times = [];

        for ($hour = self::FIRST_HOUR; $hour < self::CLOSING_HOUR; $hour++) {
            $times[] = sprintf('%02d:00', $hour);
        }

        return $times;
    }

    /** The project's active (booked, not yet held) consultation, if any. */
    public function current(Project $project): ?ProjectSchedule
    {
        return $project->schedules()
            ->where('schedule_type', ProjectSchedule::TYPE_CONSULTATION)
            ->whereIn('schedule_status', ProjectSchedule::ACTIVE_STATUSES)
            ->latest('start_datetime')
            ->first();
    }

    /** Why a new consultation can't be booked, or null when it can. */
    public function bookingBlockedReason(Project $project): ?string
    {
        if ((int) $project->current_status_id !== ProjectStatus::idFor(ProjectStatus::CONSULTATION)) {
            return 'The consultation stage of this project is finished.';
        }

        $held = $project->schedules()
            ->where('schedule_type', ProjectSchedule::TYPE_CONSULTATION)
            ->where('schedule_status', ProjectSchedule::STATUS_COMPLETED)
            ->exists();

        if ($held || $project->customer_proceed_decision !== null) {
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

    /** Why the booked consultation can't be rescheduled or cancelled, or null when it can. */
    public function changeBlockedReason(Project $project, ?ProjectSchedule $schedule): ?string
    {
        if ($schedule === null) {
            return 'There is no booked consultation to change.';
        }

        $deadline = Carbon::parse($schedule->start_datetime->toDateString(), self::TIMEZONE)->subDays(self::CHANGE_CUTOFF_DAYS);

        if ($this->today()->gt($deadline)) {
            return 'Changes close 1 day before the appointment. Please contact the Project Manager.';
        }

        return null;
    }

    /**
     * Why this date and time can't be booked, or null when it can.
     * $ignore: a schedule to leave out of the check (none for now).
     */
    public function slotProblem(Project $project, string $date, string $time, ?int $ignore = null): ?string
    {
        $day = Carbon::parse($date, self::TIMEZONE)->startOfDay();

        if ($day->isSunday()) {
            return 'Consultations are held Monday to Saturday.';
        }

        if ($day->lt($this->earliestDate())) {
            return 'Please book at least '.self::LEAD_DAYS.' days ahead.';
        }

        if ($day->gt($this->latestDate($project))) {
            return 'The consultation must be before your event date.';
        }

        if (! in_array($time, $this->slotTimes(), true)) {
            return 'Please pick a time between 9:00 AM and 5:00 PM.';
        }

        [$start, $end] = $this->slotBounds($date, $time);

        if ($this->overlapping($start, $end, $ignore)) {
            return 'This time slot was just taken. Please pick another one.';
        }

        return null;
    }

    /**
     * Open start times per day, from the earliest date to the latest:
     * ['2026-11-23' => ['09:00', '11:00', ...], ...]. Days with no open slot are left out.
     *
     * @return array<string, list<string>>
     */
    public function availableSlots(Project $project): array
    {
        $from = $this->earliestDate();
        $to = $this->latestDate($project);

        if ($from->gt($to)) {
            return [];
        }

        $busy = ProjectSchedule::query()
            ->whereIn('schedule_type', self::SLOT_TYPES)
            ->whereIn('schedule_status', ProjectSchedule::ACTIVE_STATUSES)
            ->where('start_datetime', '<', $to->copy()->addDay()->toDateString())
            ->where('end_datetime', '>', $from->toDateString())
            ->get(['start_datetime', 'end_datetime']);

        $slots = [];

        for ($day = $from->copy(); $day->lte($to); $day->addDay()) {
            if ($day->isSunday()) {
                continue;
            }

            $date = $day->toDateString();
            $open = array_values(array_filter($this->slotTimes(), function (string $time) use ($date, $busy) {
                [$start, $end] = $this->slotBounds($date, $time);

                return $busy->doesntContain(fn (ProjectSchedule $s) => $s->start_datetime->lt($end) && $s->end_datetime->gt($start));
            }));

            if ($open !== []) {
                $slots[$date] = $open;
            }
        }

        return $slots;
    }

    /** @return array{0: Carbon, 1: Carbon} the slot's start and end (wall-clock time, as stored) */
    public function slotBounds(string $date, string $time): array
    {
        $start = Carbon::parse("{$date} {$time}");

        return [$start, $start->copy()->addMinutes(self::SLOT_MINUTES)];
    }

    private function overlapping(CarbonInterface $start, CarbonInterface $end, ?int $ignore): bool
    {
        return ProjectSchedule::query()
            ->whereIn('schedule_type', self::SLOT_TYPES)
            ->whereIn('schedule_status', ProjectSchedule::ACTIVE_STATUSES)
            ->when($ignore !== null, fn ($q) => $q->where('schedule_id', '!=', $ignore))
            ->where('start_datetime', '<', $end->toDateTimeString())
            ->where('end_datetime', '>', $start->toDateTimeString())
            ->exists();
    }
}
