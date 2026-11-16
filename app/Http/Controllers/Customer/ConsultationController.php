<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ConsultationRequest;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Services\ConsultationScheduler;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

/**
 * Customer > My Projects > Consultation.
 *
 * A booking is confirmed right away. Rescheduling keeps history: the old
 * row is cancelled with the reason and who changed it, and a new row is
 * added. The Project Manager side will use the same columns later.
 */
class ConsultationController extends Controller
{
    public function __construct(private ConsultationScheduler $scheduler) {}

    public function store(ConsultationRequest $request, Project $project): RedirectResponse
    {
        ProjectController::ensureOwned($request, $project);

        if ($reason = $this->scheduler->bookingBlockedReason($project)) {
            return back()->withErrors(['consultation' => $reason]);
        }

        $data = $request->validated();

        return DB::transaction(function () use ($project, $data) {
            if ($problem = $this->scheduler->slotProblem($project, $data['date'], $data['time'])) {
                return back()->withErrors(['time' => $problem]);
            }

            $this->createBooking($project, $data);

            return back();
        });
    }

    public function reschedule(ConsultationRequest $request, Project $project): RedirectResponse
    {
        ProjectController::ensureOwned($request, $project);

        $current = $this->scheduler->current($project);

        if ($reason = $this->scheduler->changeBlockedReason($project, $current)) {
            return back()->withErrors(['consultation' => $reason]);
        }

        $data = $request->validated();

        return DB::transaction(function () use ($request, $project, $current, $data) {
            if ($problem = $this->scheduler->slotProblem($project, $data['date'], $data['time'])) {
                return back()->withErrors(['time' => $problem]);
            }

            $current->update([
                'schedule_status' => ProjectSchedule::STATUS_CANCELLED,
                'remarks' => 'Rescheduled: '.$data['reason'],
                'changed_by' => $request->user()->id,
            ]);

            $this->createBooking($project, $data);

            return back();
        });
    }

    public function cancel(ConsultationRequest $request, Project $project): RedirectResponse
    {
        ProjectController::ensureOwned($request, $project);

        $current = $this->scheduler->current($project);

        if ($reason = $this->scheduler->changeBlockedReason($project, $current)) {
            return back()->withErrors(['consultation' => $reason]);
        }

        $current->update([
            'schedule_status' => ProjectSchedule::STATUS_CANCELLED,
            'remarks' => 'Cancelled: '.$request->validated('reason'),
            'changed_by' => $request->user()->id,
        ]);

        return back();
    }

    /** @param array{date: string, time: string, meetingMode: string} $data */
    private function createBooking(Project $project, array $data): void
    {
        [$start, $end] = $this->scheduler->slotBounds($data['date'], $data['time']);

        $project->schedules()->create([
            'schedule_type' => ProjectSchedule::TYPE_CONSULTATION,
            'start_datetime' => $start,
            'end_datetime' => $end,
            'schedule_status' => ProjectSchedule::STATUS_CONFIRMED,
            'meeting_mode' => $data['meetingMode'],
        ]);
    }
}
