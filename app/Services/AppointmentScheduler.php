<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectSchedule;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * Booking rules shared by the appointments the customer books themselves:
 * the consultation and the ocular visit.
 *
 *  - Monday to Saturday, from 9:00 AM; every slot ends by 5:00 PM.
 *  - At least 7 days from today, and before the event date (custom: the first day).
 *  - A slot is taken when any active consultation or ocular visit (any project)
 *    overlaps it, since the Project Manager attends both.
 *  - Booked = confirmed right away (no Project Manager approval).
 *  - The customer can change a booking, with a reason, until the day before it.
 *
 * Each subclass sets TYPE, NOUN and SLOT_MINUTES, and says when a booking is allowed.
 * Dates are worked out in Manila time, whatever the app's timezone is.
 */
abstract class AppointmentScheduler
{
    public const TIMEZONE = 'Asia/Manila';

    public const LEAD_DAYS = 7;

    public const FIRST_HOUR = 9;

    /** Every slot ends by this hour. */
    public const CLOSING_HOUR = 17;

    /** The customer can change the booking until this many days before it. */
    public const CHANGE_CUTOFF_DAYS = 1;

    /** How far ahead the calendar offers slots when the event is far away. */
    public const MAX_WINDOW_DAYS = 120;

    /** The project_schedules.schedule_type this scheduler books. */
    public const TYPE = '';

    /** How the appointment is named in messages, e.g. "consultation". */
    public const NOUN = '';

    public const SLOT_MINUTES = 60;

    /** Schedule types that use the same slots (the Project Manager attends both). */
    private const SLOT_TYPES = [ProjectSchedule::TYPE_CONSULTATION, ProjectSchedule::TYPE_OCULAR_VISIT];

    /** Why a new appointment can't be booked, or null when it can. */
    abstract public function bookingBlockedReason(Project $project): ?string;

    public function today(): Carbon
    {
        return Carbon::now(self::TIMEZONE)->startOfDay();
    }

    public function earliestDate(): Carbon
    {
        return $this->today()->addDays(static::LEAD_DAYS);
    }

    /** The last day the appointment can be on: the day before the event starts. */
    public function latestDate(Project $project): Carbon
    {
        $eventStart = Carbon::parse($project->serviceRequest->start_date->toDateString(), self::TIMEZONE);
        $windowEnd = $this->earliestDate()->addDays(self::MAX_WINDOW_DAYS);

        return $eventStart->subDay()->min($windowEnd);
    }

    /** Start times offered each open day, e.g. ['09:00', '10:00', ... '16:00'] for 1-hour slots. */
    public function slotTimes(): array
    {
        $times = [];

        for ($minute = self::FIRST_HOUR * 60; $minute + static::SLOT_MINUTES <= self::CLOSING_HOUR * 60; $minute += static::SLOT_MINUTES) {
            $times[] = sprintf('%02d:%02d', intdiv($minute, 60), $minute % 60);
        }

        return $times;
    }

    /** The project's active (booked, not yet held) appointment of this type, if any. */
    public function current(Project $project): ?ProjectSchedule
    {
        return $project->schedules()
            ->where('schedule_type', static::TYPE)
            ->whereIn('schedule_status', ProjectSchedule::ACTIVE_STATUSES)
            ->latest('start_datetime')
            ->first();
    }

    /** The appointment that took place, if any. */
    public function held(Project $project): ?ProjectSchedule
    {
        return $project->schedules()
            ->where('schedule_type', static::TYPE)
            ->where('schedule_status', ProjectSchedule::STATUS_COMPLETED)
            ->latest('start_datetime')
            ->first();
    }

    /** Why the booked appointment can't be changed, or null when it can. */
    public function changeBlockedReason(Project $project, ?ProjectSchedule $schedule): ?string
    {
        if ($schedule === null) {
            return 'There is no booked '.static::NOUN.' to change.';
        }

        $deadline = Carbon::parse($schedule->start_datetime->toDateString(), self::TIMEZONE)->subDays(self::CHANGE_CUTOFF_DAYS);

        if ($this->today()->gt($deadline)) {
            return 'Changes close 1 day before the appointment. Please contact the Project Manager.';
        }

        return null;
    }

    /** Why this date and time can't be booked, or null when it can. */
    public function slotProblem(Project $project, string $date, string $time, ?int $ignore = null): ?string
    {
        $day = Carbon::parse($date, self::TIMEZONE)->startOfDay();

        if ($day->isSunday()) {
            return ucfirst(static::NOUN).'s are held Monday to Saturday.';
        }

        if ($day->lt($this->earliestDate())) {
            return 'Please book at least '.static::LEAD_DAYS.' days ahead.';
        }

        if ($day->gt($this->latestDate($project))) {
            return 'The '.static::NOUN.' must be before your event date.';
        }

        if (! in_array($time, $this->slotTimes(), true)) {
            return 'Please pick one of the time slots shown.';
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

        return [$start, $start->copy()->addMinutes(static::SLOT_MINUTES)];
    }

    /** The rules the booking form shows. @return array<string, mixed> */
    public function rules(Project $project): array
    {
        return [
            'earliestDate' => $this->earliestDate()->toDateString(),
            'latestDate' => $this->latestDate($project)->toDateString(),
            'leadDays' => static::LEAD_DAYS,
            'changeCutoffDays' => self::CHANGE_CUTOFF_DAYS,
            'slotTimes' => $this->slotTimes(),
            'slotMinutes' => static::SLOT_MINUTES,
        ];
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
