<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Services\ConsultationScheduler;
use App\Services\ReservationFees;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Backlog #16: Record consultation outcomes (step 1 of a project).
 *
 * The customer books the consultation; afterwards the Project Manager records it:
 *  - Completed: the notes, the agreed event details (saved on the service request),
 *    whether an ocular visit is needed, and the customer's decision:
 *      Proceed         → the reservation fee bill is issued (ReservationFees)
 *      On hold         → the customer is still deciding; the PM can update it later
 *      Do not proceed  → the project is cancelled (a reason is required)
 *  - Rescheduled / Customer did not attend: that booking is cancelled with the PM's
 *    summary as its remarks, so the customer can book a new consultation.
 *
 * Acceptance criterion 2: a consultation is never saved without the outcome,
 * the ocular visit requirement and the decision.
 */
class ConsultationController extends Controller
{
    public const OUTCOMES = ['Completed', 'Rescheduled', 'Customer did not attend'];

    public function __construct(
        private readonly ConsultationScheduler $scheduler,
        private readonly ReservationFees $reservationFees,
    ) {}

    public function update(Request $request, Project $project): RedirectResponse
    {
        $project->load(['serviceRequest', 'status', 'schedules']);
        $serviceRequest = $project->serviceRequest;

        $data = $request->validate(self::rules($request, $serviceRequest), self::messages());

        if ($project->status->status_name !== ProjectStatus::CONSULTATION) {
            throw ValidationException::withMessages(['outcome' => 'The consultation stage of this project is finished.']);
        }

        $booked = $this->scheduler->current($project);
        $held = $this->scheduler->held($project);

        // A held consultation can only be updated while the customer is still deciding (on hold).
        if ($held !== null && $project->customer_proceed_decision !== Project::DECISION_HOLD) {
            throw ValidationException::withMessages(['outcome' => 'This consultation was already recorded.']);
        }

        if ($held === null && $booked === null) {
            throw ValidationException::withMessages(['outcome' => 'The customer has not booked a consultation yet.']);
        }

        $summary = trim($data['summary']);

        // Rescheduled / did not attend: close the booking so the customer can book again.
        if ($data['outcome'] !== 'Completed') {
            if ($booked === null) {
                throw ValidationException::withMessages(['outcome' => 'There is no booked consultation to reschedule.']);
            }

            $booked->update([
                'schedule_status' => ProjectSchedule::STATUS_CANCELLED,
                'remarks' => Str::limit(($data['outcome'] === 'Rescheduled' ? 'Rescheduled: ' : 'Customer did not attend: ').$summary, 255, ''),
                'changed_by' => $request->user()->id,
            ]);

            return back();
        }

                $decision = ProjectController::DECISIONS[$data['decision']];
        $schedule = $held ?? $booked;

        DB::transaction(function () use ($data, $project, $serviceRequest, $schedule, $summary, $decision, $request) {
            // The consultation was held, and its notes are kept.
            $schedule->update(['schedule_status' => ProjectSchedule::STATUS_COMPLETED]);
            $schedule->outcome()->updateOrCreate([], [
                'notes' => self::joinNotes($summary, $data['additionalNotes'] ?? null, $data['decisionReason'] ?? null, $decision),
                'recorded_by' => $request->user()->id,
                'recorded_at' => now(),
            ]);

            // The event details agreed in the consultation update the service request.
            $this->updateEventDetails($project, $serviceRequest, $data);

            $project->update([
                'customer_proceed_decision' => $decision,
                'ocular_visit_required' => (bool) $data['ocularVisitRequired'],
            ]);

            if ($decision === Project::DECISION_PROCEED) {
                $this->reservationFees->issue($project->fresh('serviceRequest'));
            }

            if ($decision === Project::DECISION_CANCELLED) {
                $project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::CANCELLED)]);
                $project->schedules()
                    ->where('schedule_type', ProjectSchedule::TYPE_EVENT)
                    ->update(['schedule_status' => ProjectSchedule::STATUS_CANCELLED]);
            }
        });

        return back();
    }

    /** @return array<string, mixed> */
    private static function rules(Request $request, ServiceRequest $serviceRequest): array
    {
        $completed = $request->input('outcome') === 'Completed';
        $custom = $serviceRequest->isCustom();

        $rules = [
            'outcome' => ['required', Rule::in(self::OUTCOMES)],
            'summary' => ['required', 'string', 'max:2000'],
        ];

        if (! $completed) {
            return $rules;
        }

        return $rules + [
            'additionalNotes' => ['nullable', 'string', 'max:2000'],
            'ocularVisitRequired' => ['required', 'boolean'],
            'decision' => ['required', Rule::in(array_keys(ProjectController::DECISIONS))],
            'decisionReason' => ['nullable', 'required_if:decision,Do not proceed', 'string', 'max:1000'],
            'eventDate' => ['required', 'date_format:Y-m-d'],
            'endDate' => $custom ? ['required', 'date_format:Y-m-d', 'after_or_equal:eventDate'] : ['nullable'],
            'startTime' => $custom ? ['nullable'] : ['required', 'date_format:H:i'],
            'endTime' => $custom ? ['nullable'] : ['required', 'date_format:H:i', 'after:startTime'],
            'venue' => ['required', 'string', 'max:255'],
            'guests' => $serviceRequest->guest_count === null ? ['nullable', 'integer', 'min:1'] : ['required', 'integer', 'min:1'],
            'budget' => ['required', Rule::in(ServiceRequest::budgetChoices($serviceRequest->request_type))],
        ];
    }

        /** @return array<string, string> */
    private static function messages(): array
    {
        return [
            'outcome.required' => 'Select the consultation outcome.',
            'summary.required' => 'Summarize what was discussed in the consultation.',
            'ocularVisitRequired.required' => 'Specify whether an ocular visit is required.',
            'decision.required' => 'Select whether the project can proceed.',
            'decisionReason.required_if' => 'Give the reason the project will not proceed.',
            'endTime.after' => 'End time must be after the start time.',
            'endDate.after_or_equal' => 'The end date cannot be before the start date.',
        ];
    }

    /** Saves the agreed event details on the service request and moves the event date to match. */
    private function updateEventDetails(Project $project, ServiceRequest $serviceRequest, array $data): void
    {
        [$min, $max] = ServiceRequest::BUDGET_RANGES[$data['budget']];
        $custom = $serviceRequest->isCustom();
        $endDate = $custom ? $data['endDate'] : $data['eventDate'];

        $serviceRequest->update([
            'start_date' => $data['eventDate'],
            'end_date' => $endDate,
            'event_start_time' => $custom ? null : $data['startTime'].':00',
            'event_end_time' => $custom ? null : $data['endTime'].':00',
            'venue' => trim($data['venue']),
            'guest_count' => $serviceRequest->guest_count === null ? null : (int) $data['guests'],
            'budget_min' => $min,
            'budget_max' => $max,
        ]);

        $project->schedules()
            ->where('schedule_type', ProjectSchedule::TYPE_EVENT)
            ->update($custom
                ? ['start_datetime' => $data['eventDate'].' 00:00:00', 'end_datetime' => $endDate.' 23:59:59']
                : ['start_datetime' => $data['eventDate'].' '.$data['startTime'].':00', 'end_datetime' => $endDate.' '.$data['endTime'].':00']);
    }

    /** Summary, additional details and the reason, in one notes text (see ProjectController::splitNotes). */
    private static function joinNotes(string $summary, ?string $additional, ?string $reason, string $decision): string
    {
        $notes = $summary;

        if (trim((string) $additional) !== '') {
            $notes .= ProjectController::NOTE_ADDITIONAL.trim($additional);
        }

        if ($decision === Project::DECISION_CANCELLED && trim((string) $reason) !== '') {
            $notes .= ProjectController::NOTE_REASON.trim($reason);
        }

        return $notes;
    }
}