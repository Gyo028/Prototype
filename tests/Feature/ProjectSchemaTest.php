<?php

use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\ProjectSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

/*
 * Plan Project, Slice 0: project_statuses, projects and project_schedules,
 * and the sample projects seeded until the "approve request" action exists.
 */

test('the project tables follow the ERD column names', function () {
    expect(Schema::getColumnListing('project_statuses'))->toEqualCanonicalizing([
        'status_id', 'status_name', 'description', 'phase', 'sequence_order', 'is_terminal',
    ]);
    expect(Schema::getColumnListing('projects'))->toEqualCanonicalizing([
        'project_id', 'service_request_id', 'project_manager_id', 'design_specialist_id', 'current_status_id',
        'design_assigned_at', 'customer_proceed_decision', 'ocular_visit_required', 'customer_rating',
        'customer_review_text', 'customer_reviewed_at', 'featured_on_website', 'created_at', 'updated_at',
    ]);
    expect(Schema::getColumnListing('project_schedules'))->toEqualCanonicalizing([
        'schedule_id', 'project_id', 'schedule_type', 'start_datetime', 'end_datetime', 'schedule_status', 'remarks',
    ]);
});

test('the migration inserts the nine statuses in workflow order', function () {
    $statuses = ProjectStatus::query()->orderBy('sequence_order')->get();

    expect($statuses->pluck('status_name')->all())->toBe([
        'Consultation', 'Booked', 'Site Assessment', 'Designing', 'Contract',
        'Fabricating', 'Installing', 'Completed', 'Cancelled',
    ]);
    expect($statuses->where('phase', ProjectStatus::PHASE_PLANNING)->count())->toBe(5);
    expect($statuses->where('phase', ProjectStatus::PHASE_EXECUTION)->count())->toBe(2);
    expect($statuses->where('is_terminal', true)->pluck('status_name')->all())->toBe(['Completed', 'Cancelled']);
});

test('the seeder creates a sample project for every status, both request types', function () {
    $this->seed(DatabaseSeeder::class);

    $projects = Project::with(['status', 'serviceRequest', 'eventSchedule'])->get();

    // One per status, plus a second Consultation project that is on hold.
    expect($projects)->toHaveCount(10);
    expect($projects->pluck('status.status_name')->unique()->sort()->values()->all())
        ->toEqualCanonicalizing(ProjectStatus::query()->pluck('status_name')->all());
    expect($projects->pluck('serviceRequest.request_type')->unique()->sort()->values()->all())
        ->toBe([ServiceRequest::TYPE_CUSTOM, ServiceRequest::TYPE_STANDARD]);
    expect($projects->filter->isOnHold())->toHaveCount(1);

    // Every project comes from an approved request; one request is still pending.
    expect($projects->every(fn (Project $p) => $p->serviceRequest->request_status === ServiceRequest::STATUS_APPROVED))->toBeTrue();
    expect(ServiceRequest::query()->where('request_status', ServiceRequest::STATUS_PENDING)->doesntHave('project')->count())->toBe(1);
});

test('the event date is tentative before Booked and confirmed from Booked on', function () {
    $this->seed(DatabaseSeeder::class);

    $eventStatus = fn (string $status) => Project::query()
        ->where('current_status_id', ProjectStatus::idFor($status))
        ->with('eventSchedule')->get()->pluck('eventSchedule.schedule_status')->unique()->values()->all();

    expect($eventStatus(ProjectStatus::CONSULTATION))->toBe([ProjectSchedule::STATUS_TENTATIVE]);
    expect($eventStatus(ProjectStatus::BOOKED))->toBe([ProjectSchedule::STATUS_CONFIRMED]);
    expect($eventStatus(ProjectStatus::DESIGNING))->toBe([ProjectSchedule::STATUS_CONFIRMED]);
});

test('a custom project event covers its whole date range', function () {
    $this->seed(DatabaseSeeder::class);

    $project = Project::query()
        ->whereHas('serviceRequest', fn ($q) => $q->where('request_type', ServiceRequest::TYPE_CUSTOM))
        ->with(['serviceRequest', 'eventSchedule'])->firstOrFail();

    expect($project->eventSchedule->start_datetime->toDateString())->toBe($project->serviceRequest->start_date->toDateString());
    expect($project->eventSchedule->start_datetime->format('H:i'))->toBe('00:00');
    expect($project->eventSchedule->end_datetime->toDateString())->toBe($project->serviceRequest->end_date->toDateString());
    expect($project->eventSchedule->end_datetime->format('H:i'))->toBe('23:59');
});

test('a service request can have only one project', function () {
    $this->seed(DatabaseSeeder::class);

    $existing = Project::query()->firstOrFail();

    expect(fn () => Project::create([
        'service_request_id' => $existing->service_request_id,
        'project_manager_id' => $existing->project_manager_id,
        'current_status_id' => ProjectStatus::idFor(ProjectStatus::CONSULTATION),
    ]))->toThrow(QueryException::class);
});

test('running the seeders again adds no duplicates', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(ProjectSeeder::class);

    expect(Project::query()->count())->toBe(10);
});
