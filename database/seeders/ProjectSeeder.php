<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\EventType;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\Service;
use App\Models\ServiceRequest;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Sample projects for the Project Manager's projects table and project
 * folder (Plan Project, Slice 0). Until the "approve request" action is
 * built, approved requests and their projects come from here.
 *
 * Ten projects: one per status, plus a second Consultation project that is
 * on hold. Both request types, all owned by
 * customer@example.com. Dates are relative to today, so the sample stays
 * current. Plus one pending request (no project yet) for the review screen.
 *
 * Needs CustomerSeeder, StaffEmployeeSeeder and ServiceAssetSeeder first.
 * Skips if any project already exists.
 */
class ProjectSeeder extends Seeder
{
    private Carbon $today;

    private Customer $customer;

    private Employee $projectManager;

    private Employee $designSpecialist;

    public function run(): void
    {
        if (Project::query()->exists()) {
            return;
        }

        $customerUser = User::query()->where('email', Role::Customer->value.'@example.com')->first();
        $customer = $customerUser ? Customer::query()->where('user_id', $customerUser->id)->first() : null;
        $projectManager = $this->employeeFor(Role::ProjectManager);
        $designSpecialist = $this->employeeFor(Role::DesignSpecialist);

        if ($customer === null || $projectManager === null || $designSpecialist === null) {
            return;
        }

        $this->today = Carbon::today();
        $this->customer = $customer;
        $this->projectManager = $projectManager;
        $this->designSpecialist = $designSpecialist;

        DB::transaction(function () {
            $this->seedProjects();
            $this->seedPendingRequest();
        });
    }

    private function seedProjects(): void
    {
        // 1. Consultation — just approved; the customer hasn't booked the consultation yet.
        $this->project(
            $this->standard('Wedding', 60, '14:00', '22:00', 150, 250000, 500000, 'Garden Pavilion, Tagaytay'),
            ProjectStatus::CONSULTATION,
            eventStatus: ProjectSchedule::STATUS_TENTATIVE,
        );

        // 2. Consultation · On Hold — consultation done, the customer is still deciding.
        $project = $this->project(
            $this->standard('Birthday', 45, '17:00', '23:00', 80, 50000, 100000, 'Function Room B, Pasig'),
            ProjectStatus::CONSULTATION,
            decision: Project::DECISION_HOLD,
            ocular: false,
            eventStatus: ProjectSchedule::STATUS_TENTATIVE,
        );
        $this->schedule($project, ProjectSchedule::TYPE_CONSULTATION, -3, '10:00', '11:00', ProjectSchedule::STATUS_COMPLETED);

        // 3. Booked — reservation fee verified, date confirmed; ocular visit not booked yet.
        $project = $this->project(
            $this->standard('Corporate', 75, '08:00', '17:00', 200, 100000, 250000, 'SMX Convention Center, Pasay'),
            ProjectStatus::BOOKED,
            decision: Project::DECISION_PROCEED,
            ocular: true,
        );
        $this->schedule($project, ProjectSchedule::TYPE_CONSULTATION, -6, '13:00', '14:00', ProjectSchedule::STATUS_COMPLETED);

        // 4. Site Assessment — custom project; the customer booked the ocular visit.
        $project = $this->project(
            $this->custom('Christmas mall center display', 70, 99, 250000, 500000, 'SM Megamall Atrium, Mandaluyong'),
            ProjectStatus::SITE_ASSESSMENT,
            decision: Project::DECISION_PROCEED,
            ocular: true,
        );
        $this->schedule($project, ProjectSchedule::TYPE_CONSULTATION, -10, '10:00', '11:00', ProjectSchedule::STATUS_COMPLETED);
        $this->schedule($project, ProjectSchedule::TYPE_OCULAR_VISIT, 5, '09:00', '11:00', ProjectSchedule::STATUS_CONFIRMED);

        // 5. Designing — no ocular visit needed; a Design Specialist is assigned.
        $project = $this->project(
            $this->standard('Debut', 90, '18:00', '23:59', 120, 100000, 250000, 'The Blue Leaf Pavilion, Taguig'),
            ProjectStatus::DESIGNING,
            decision: Project::DECISION_PROCEED,
            ocular: false,
            assigned: -2,
        );
        $this->schedule($project, ProjectSchedule::TYPE_CONSULTATION, -9, '15:00', '16:00', ProjectSchedule::STATUS_COMPLETED);

        // 6. Contract — custom project; design approved, contract out for signing.
        $project = $this->project(
            $this->custom("Valentine's mall atrium set-up", 110, 113, 100000, 250000, 'Glorietta Activity Center, Makati'),
            ProjectStatus::CONTRACT,
            decision: Project::DECISION_PROCEED,
            ocular: true,
            assigned: -15,
        );
        $this->schedule($project, ProjectSchedule::TYPE_CONSULTATION, -25, '10:00', '11:00', ProjectSchedule::STATUS_COMPLETED);
        $this->schedule($project, ProjectSchedule::TYPE_OCULAR_VISIT, -20, '08:00', '10:00', ProjectSchedule::STATUS_COMPLETED);

        // 7. Fabricating — contract verified; fabrication under way.
        $project = $this->project(
            $this->standard('Wedding', 20, '15:00', '23:00', 180, 250000, 500000, 'Manila Cathedral and Bayleaf Hotel, Intramuros', requestedDaysAgo: 50),
            ProjectStatus::FABRICATING,
            decision: Project::DECISION_PROCEED,
            ocular: true,
            assigned: -35,
        );
        $this->schedule($project, ProjectSchedule::TYPE_CONSULTATION, -45, '10:00', '11:00', ProjectSchedule::STATUS_COMPLETED);
        $this->schedule($project, ProjectSchedule::TYPE_OCULAR_VISIT, -40, '09:00', '11:00', ProjectSchedule::STATUS_COMPLETED);
        $this->schedule($project, ProjectSchedule::TYPE_FABRICATION, -2, '08:00', '17:00', ProjectSchedule::STATUS_CONFIRMED, endDay: 15);
        $this->schedule($project, ProjectSchedule::TYPE_INSTALLATION, 19, '08:00', '18:00', ProjectSchedule::STATUS_PENDING, endDay: 20);

        // 8. Installing — fabrication done; the set-up is going in for the event in two days.
        $project = $this->project(
            $this->standard('Debut', 2, '18:00', '23:30', 150, 100000, 250000, 'Crowne Plaza Galleria Ballroom, Quezon City', requestedDaysAgo: 70),
            ProjectStatus::INSTALLING,
            decision: Project::DECISION_PROCEED,
            ocular: true,
            assigned: -55,
        );
        $this->schedule($project, ProjectSchedule::TYPE_CONSULTATION, -65, '10:00', '11:00', ProjectSchedule::STATUS_COMPLETED);
        $this->schedule($project, ProjectSchedule::TYPE_OCULAR_VISIT, -60, '09:00', '11:00', ProjectSchedule::STATUS_COMPLETED);
        $this->schedule($project, ProjectSchedule::TYPE_FABRICATION, -20, '08:00', '17:00', ProjectSchedule::STATUS_COMPLETED, endDay: -3);
        $this->schedule($project, ProjectSchedule::TYPE_INSTALLATION, 1, '08:00', '18:00', ProjectSchedule::STATUS_CONFIRMED, endDay: 2);

        // 9. Completed — the event is over.
        $project = $this->project(
            $this->standard('Corporate', -10, '09:00', '18:00', 300, 250000, 500000, 'Marriott Grand Ballroom, Pasay', requestedDaysAgo: 80),
            ProjectStatus::COMPLETED,
            decision: Project::DECISION_PROCEED,
            ocular: false,
            assigned: -60,
            eventStatus: ProjectSchedule::STATUS_COMPLETED,
        );
        $this->schedule($project, ProjectSchedule::TYPE_CONSULTATION, -72, '10:00', '11:00', ProjectSchedule::STATUS_COMPLETED);
        $this->schedule($project, ProjectSchedule::TYPE_FABRICATION, -30, '08:00', '17:00', ProjectSchedule::STATUS_COMPLETED, endDay: -14);
        $this->schedule($project, ProjectSchedule::TYPE_INSTALLATION, -11, '08:00', '18:00', ProjectSchedule::STATUS_COMPLETED);

        // 10. Cancelled — the customer chose not to proceed after the consultation.
        $project = $this->project(
            $this->standard('Birthday', 50, '16:00', '22:00', 60, 0, 50000, 'Clubhouse, Antipolo'),
            ProjectStatus::CANCELLED,
            decision: Project::DECISION_CANCELLED,
            ocular: false,
            eventStatus: ProjectSchedule::STATUS_CANCELLED,
        );
        $this->schedule($project, ProjectSchedule::TYPE_CONSULTATION, -4, '14:00', '15:00', ProjectSchedule::STATUS_COMPLETED);
    }

    /** A request still waiting for the Project Manager's decision (no project yet). */
    private function seedPendingRequest(): void
    {
        $this->standard('Debut', 65, '18:00', '23:30', 100, 100000, 250000, 'Okada Manila Grand Ballroom, Parañaque', approved: false, requestedDaysAgo: 1);
    }

    private function standard(
        string $eventType,
        int $inDays,
        string $from,
        string $to,
        int $guests,
        int $budgetMin,
        ?int $budgetMax,
        string $venue,
        bool $approved = true,
        int $requestedDaysAgo = 7,
    ): ServiceRequest {
        $date = $this->today->copy()->addDays($inDays)->toDateString();

        $request = ServiceRequest::create([
            'customer_id' => $this->customer->customer_id,
            'request_type' => ServiceRequest::TYPE_STANDARD,
            'event_type_id' => EventType::query()->where('event_type_name', $eventType)->value('event_type_id'),
            'request_date' => $this->today->copy()->subDays($requestedDaysAgo)->toDateString(),
            'start_date' => $date,
            'end_date' => $date,
            'event_start_time' => $from,
            'event_end_time' => $to,
            'venue' => $venue,
            'guest_count' => $guests,
            'budget_min' => $budgetMin,
            'budget_max' => $budgetMax,
            'project_description' => "Sample {$eventType} request.",
        ] + $this->decided($approved, $requestedDaysAgo));

        // The Event Styling base fee, saved with its price as on a real request.
        $baseFee = Service::query()->where('service_name', Service::BASE_FEE_NAME)->first();

        if ($baseFee !== null) {
            $request->services()->create([
                'service_id' => $baseFee->service_id,
                'quantity' => 1,
                'unit_price' => $baseFee->price,
                'subtotal' => $baseFee->price,
            ]);
        }

        return $request;
    }

    private function custom(string $title, int $startInDays, int $endInDays, int $budgetMin, ?int $budgetMax, string $venue): ServiceRequest
    {
        return ServiceRequest::create([
            'customer_id' => $this->customer->customer_id,
            'request_type' => ServiceRequest::TYPE_CUSTOM,
            'project_title' => $title,
            'request_date' => $this->today->copy()->subDays(12)->toDateString(),
            'start_date' => $this->today->copy()->addDays($startInDays)->toDateString(),
            'end_date' => $this->today->copy()->addDays($endInDays)->toDateString(),
            'venue' => $venue,
            'budget_min' => $budgetMin,
            'budget_max' => $budgetMax,
            'project_description' => "Sample custom project: {$title}.",
        ] + $this->decided(true, 12));
    }

    /** @return array<string, mixed> */
    private function decided(bool $approved, int $requestedDaysAgo): array
    {
        return $approved
            ? ['request_status' => ServiceRequest::STATUS_APPROVED, 'reviewed_at' => $this->today->copy()->subDays(max($requestedDaysAgo - 1, 0))->setTime(10, 0)]
            : ['request_status' => ServiceRequest::STATUS_PENDING];
    }

    /**
     * Creates the project and its event schedule. The event is 'confirmed' from
     * Booked onward (reservation fee verified), 'tentative' before that.
     */
    private function project(
        ServiceRequest $request,
        string $status,
        ?string $decision = null,
        ?bool $ocular = null,
        ?int $assigned = null,
        string $eventStatus = ProjectSchedule::STATUS_CONFIRMED,
    ): Project {
        $project = Project::create([
            'service_request_id' => $request->service_request_id,
            'project_manager_id' => $this->projectManager->employee_id,
            'design_specialist_id' => $assigned === null ? null : $this->designSpecialist->employee_id,
            'design_assigned_at' => $assigned === null ? null : $this->today->copy()->addDays($assigned)->setTime(9, 0),
            'current_status_id' => ProjectStatus::idFor($status),
            'customer_proceed_decision' => $decision,
            'ocular_visit_required' => $ocular,
        ]);

        // Standard: the event date and times. Custom: the whole date range, no times.
        $project->schedules()->create($request->isCustom()
            ? [
                'schedule_type' => ProjectSchedule::TYPE_EVENT,
                'start_datetime' => $request->start_date->copy()->startOfDay(),
                'end_datetime' => $request->end_date->copy()->endOfDay(),
                'schedule_status' => $eventStatus,
            ]
            : [
                'schedule_type' => ProjectSchedule::TYPE_EVENT,
                'start_datetime' => $request->start_date->toDateString().' '.$request->event_start_time,
                'end_datetime' => $request->end_date->toDateString().' '.$request->event_end_time,
                'schedule_status' => $eventStatus,
            ]);

        return $project;
    }

    private function schedule(Project $project, string $type, int $inDays, string $from, string $to, string $status, ?int $endDay = null): void
    {
        $project->schedules()->create([
            'schedule_type' => $type,
            'start_datetime' => $this->today->copy()->addDays($inDays)->toDateString().' '.$from,
            'end_datetime' => $this->today->copy()->addDays($endDay ?? $inDays)->toDateString().' '.$to,
            'schedule_status' => $status,
        ]);
    }

    private function employeeFor(Role $role): ?Employee
    {
        $user = User::query()->where('email', $role->value.'@example.com')->first();

        return $user ? Employee::query()->where('user_id', $user->id)->first() : null;
    }
}
