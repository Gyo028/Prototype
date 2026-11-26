<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Models\AppointmentOutcomeFile;
use App\Models\Billing;
use App\Models\DesignProposal;
use App\Models\Employee;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Services\ConsultationScheduler;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Backlog #21: Assign a Design Specialist.
 *   1. The assignment is saved and the Design Specialist can see the project.
 *   2. It is not saved when no specialist is selected or the project information is incomplete.
 *
 * Saved in projects.design_specialist_id + design_assigned_at; the project moves to Designing.
 * Decided with the user (Nov 26): no "notes for the designer" (no column); a different
 * specialist can be assigned only until the designer submits a design proposal.
 */
class DesignAssignmentController extends Controller
{
    public function update(Request $request, Project $project): RedirectResponse
    {
        $data = $request->validate(
            ['specialistId' => ['required', 'integer']],
            ['specialistId.required' => 'Select a Design Specialist.'],
        );

        $project->loadMissing('status', 'billings.payments', 'schedules.outcome.files');

        $reassigning = $project->design_specialist_id !== null;
        if ($reassigning) {
            self::ensureCanReassign($project);
        } elseif ($missing = self::missingInformation($project)) {
            // Acceptance criterion 2: incomplete project information.
            throw ValidationException::withMessages(['project' => 'The project information is incomplete: '.$missing]);
        }

        $specialist = self::specialists()->whereKey($data['specialistId'])->first();
        if ($specialist === null) {
            throw ValidationException::withMessages(['specialistId' => 'Select an active Design Specialist.']);
        }

        if ((int) $project->design_specialist_id === (int) $specialist->employee_id) {
            throw ValidationException::withMessages(['specialistId' => $specialist->full_name.' is already assigned to this project.']);
        }

        // Acceptance criterion 1: saved; the project moves to Designing.
        $project->update([
            'design_specialist_id' => $specialist->employee_id,
            'design_assigned_at' => Carbon::now(ConsultationScheduler::TIMEZONE),
            'current_status_id' => ProjectStatus::idFor(ProjectStatus::DESIGNING),
        ]);

        return back();
    }

    /** Active employees whose position is Design Specialist. */
    public static function specialists(): Builder
    {
        return Employee::query()
            ->where('employee_status', Employee::STATUS_ACTIVE)
            ->whereHas('position', fn (Builder $q) => $q->where('position_name', 'Design Specialist'));
    }

    /** True once the designer has submitted a proposal (drafts do not count). */
    public static function proposalSubmitted(Project $project): bool
    {
        return $project->designProposals()->where('status', '!=', DesignProposal::STATUS_DRAFT)->exists();
    }

    /** What is still missing before a designer can be assigned, or null when complete. */
    public static function missingInformation(Project $project): ?string
    {
        $status = $project->status->status_name;

        if (! in_array($status, [ProjectStatus::BOOKED, ProjectStatus::SITE_ASSESSMENT], true)) {
            return $status === ProjectStatus::CONSULTATION
                ? 'the consultation and the reservation fee come first.'
                : 'the project is '.strtolower($status).'.';
        }

        if ($project->customer_proceed_decision !== Project::DECISION_PROCEED) {
            return 'the customer has not decided to proceed.';
        }

        $fee = $project->billings->firstWhere('billing_type', Billing::TYPE_RESERVATION_FEE);
        if ($fee === null || ($fee->status !== Billing::STATUS_PAID && ! $fee->payments->contains('status', Payment::STATUS_VERIFIED))) {
            return 'the reservation fee is not paid yet.';
        }

        if ($project->ocular_visit_required === true) {
            $held = $project->schedules->first(fn (ProjectSchedule $s) => $s->schedule_type === ProjectSchedule::TYPE_OCULAR_VISIT
                && $s->schedule_status === ProjectSchedule::STATUS_COMPLETED);
            $hasReport = $held?->outcome?->files->contains('file_type', AppointmentOutcomeFile::TYPE_REPORT) ?? false;

            if (! $hasReport) {
                return 'record the site assessment first.';
            }
        }

        return null;
    }

    private static function ensureCanReassign(Project $project): void
    {
        if ($project->status->status_name !== ProjectStatus::DESIGNING) {
            throw ValidationException::withMessages(['specialistId' => 'The Design Specialist can no longer be changed (the project is '.strtolower($project->status->status_name).').']);
        }

        if (self::proposalSubmitted($project)) {
            throw ValidationException::withMessages(['specialistId' => 'The Design Specialist has already submitted a design proposal, so they can no longer be changed.']);
        }
    }
}