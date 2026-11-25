<?php

use App\Enums\Role;
use App\Models\AppointmentOutcomeFile;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\EventType;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Models\SiteAccessDocument;
use App\Models\User;
use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Backlog #20: Record site assessment details (and the site access documents).
 *   1. The report and venue photos are saved and attached to the project.
 *   2. Nothing is saved without a report.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);
    Storage::fake();

    $this->pm = User::factory()->create(['role' => Role::ProjectManager, 'name' => 'Paolo Reyes']);
    $manager = Employee::create([
        'user_id' => $this->pm->id,
        'position_id' => EmployeePosition::where('position_name', 'Project Manager')->value('position_id'),
        'first_name' => 'Paolo',
        'last_name' => 'Reyes',
        'contact_number' => '09181112222',
        'email' => 'pm@example.com',
    ]);

    $this->customerUser = User::factory()->create(['role' => Role::Customer]);
    $customer = Customer::create([
        'user_id' => $this->customerUser->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => '09171234567',
    ]);

    $this->project = saProject($customer, $manager);
    // The ocular visit was yesterday, 9:00 to 11:00, at the customer's own property.
    $this->visit = $this->project->schedules()->create([
        'schedule_type' => ProjectSchedule::TYPE_OCULAR_VISIT,
        'start_datetime' => now()->subDay()->toDateString().' 09:00:00',
        'end_datetime' => now()->subDay()->toDateString().' 11:00:00',
        'schedule_status' => ProjectSchedule::STATUS_CONFIRMED,
        'meeting_mode' => ProjectSchedule::MODE_FACE_TO_FACE,
        'venue_ownership' => ProjectSchedule::VENUE_OWN_PROPERTY,
    ]);
});

/** A Wedding project whose reservation fee is paid and whose ocular visit is booked (status Site Assessment). */
function saProject(Customer $customer, Employee $manager): Project
{
    $request = ServiceRequest::create([
        'customer_id' => $customer->customer_id,
        'request_type' => ServiceRequest::TYPE_STANDARD,
        'event_type_id' => EventType::where('event_type_name', 'Wedding')->value('event_type_id'),
        'request_date' => now()->toDateString(),
        'start_date' => now()->addMonths(3)->toDateString(),
        'end_date' => now()->addMonths(3)->toDateString(),
        'event_start_time' => '14:00:00',
        'event_end_time' => '22:00:00',
        'venue' => 'Grand Palace Events Hall, Quezon City',
        'guest_count' => 150,
        'budget_min' => 100000,
        'budget_max' => 250000,
        'project_description' => 'Rustic garden wedding.',
        'request_status' => ServiceRequest::STATUS_APPROVED,
        'reviewed_at' => now(),
    ]);

    return Project::create([
        'service_request_id' => $request->service_request_id,
        'project_manager_id' => $manager->employee_id,
        'current_status_id' => ProjectStatus::idFor(ProjectStatus::SITE_ASSESSMENT),
        'customer_proceed_decision' => Project::DECISION_PROCEED,
        'ocular_visit_required' => true,
    ]);
}

function saSave($test, array $data)
{
    return $test->actingAs($test->pm)->post(route('project-manager.projects.site-assessment', $test->project), $data);
}

function saReport(string $name = 'site-report.pdf', string $mime = 'application/pdf'): UploadedFile
{
    return UploadedFile::fake()->create($name, 200, $mime);
}

function saPhoto(string $name): UploadedFile
{
    return UploadedFile::fake()->create($name, 100, 'image/jpeg');
}

function saPageProject($test): array
{
    $project = null;
    $test->actingAs($test->pm)
        ->get(route('project-manager.projects.show', $test->project))
        ->assertOk()
        ->assertInertia(function (Assert $page) use (&$project) {
            $all = $page->toArray();
            $project = ($all['props'] ?? $all)['project'];
        });

    return $project;
}

test('the project page shows the booked ocular visit and no assessment yet', function () {
    $project = saPageProject($this);

    expect($project['ocularVisitAt'])->toBe(now()->subDay()->toDateString().'T09:00')
        ->and($project['ocularVisitStatus'])->toBe('confirmed')
        ->and($project['siteAssessment'])->toBeNull()
        ->and($project['siteAccessDocuments'])->toBe([]);
});

test('saving the report and photos records the site assessment and marks the visit held', function () {
    saSave($this, [
        'findings' => 'Ceiling is 4.2 m. Free-standing structures only.',
        'report' => saReport(),
        'photos' => [saPhoto('stage.jpg'), saPhoto('entrance.jpg')],
    ])->assertSessionHasNoErrors();

    $visit = $this->visit->refresh()->load('outcome.files');
    expect($visit->schedule_status)->toBe(ProjectSchedule::STATUS_COMPLETED)
        ->and($visit->completed_at)->not->toBeNull()
        ->and($visit->outcome->notes)->toBe('Ceiling is 4.2 m. Free-standing structures only.')
        ->and($visit->outcome->recorded_by)->toBe($this->pm->id)
        ->and($visit->outcome->files)->toHaveCount(3);

    foreach ($visit->outcome->files as $file) {
        Storage::assertExists($file->file_path);
    }

    $saved = saPageProject($this)['siteAssessment'];
    expect($saved['assessedOn'])->toBe(now()->subDay()->toDateString())
        ->and($saved['report']['name'])->toBe('site-report.pdf')
        ->and($saved['report']['type'])->toBe('pdf')
        ->and($saved['photos'])->toHaveCount(2)
        ->and($saved['recordedBy'])->toBe('Paolo Reyes');
});

test('nothing is saved without a report', function () {
    saSave($this, ['findings' => 'Measured the hall.', 'photos' => [saPhoto('stage.jpg')]])
        ->assertSessionHasErrors('report');

    expect($this->visit->refresh()->schedule_status)->toBe(ProjectSchedule::STATUS_CONFIRMED)
        ->and($this->visit->outcome)->toBeNull();
});

test('the report must be a PDF or DOCX file', function () {
    saSave($this, ['report' => saPhoto('report.jpg')])->assertSessionHasErrors('report');

    expect($this->visit->refresh()->outcome)->toBeNull();
});

test('the assessment cannot be recorded before the visit', function () {
    $this->visit->update([
        'start_datetime' => now()->addDays(3)->toDateString().' 09:00:00',
        'end_datetime' => now()->addDays(3)->toDateString().' 11:00:00',
    ]);

    saSave($this, ['report' => saReport()])->assertSessionHasErrors('visit');

    expect($this->visit->refresh()->outcome)->toBeNull();
});

test('updating keeps the report, removes an unticked photo and adds a new one', function () {
    saSave($this, ['report' => saReport(), 'photos' => [saPhoto('stage.jpg'), saPhoto('entrance.jpg')]]);
    $photos = $this->visit->refresh()->outcome->files->where('file_type', AppointmentOutcomeFile::TYPE_PHOTO)->values();
    $removed = $photos[1];

    saSave($this, [
        'findings' => 'Added the ceiling photo.',
        'keepPhotoIds' => [$photos[0]->outcome_file_id],
        'photos' => [saPhoto('ceiling.jpg')],
    ])->assertSessionHasNoErrors();

    $files = $this->visit->refresh()->outcome->files;
    expect($files->where('file_type', AppointmentOutcomeFile::TYPE_REPORT))->toHaveCount(1)
        ->and($files->where('file_type', AppointmentOutcomeFile::TYPE_PHOTO)->pluck('file_name')->sort()->values()->all())->toBe(['ceiling.jpg', 'stage.jpg']);

    Storage::assertMissing($removed->file_path);
});

test('a visit waiting for its site access documents cannot be recorded; approving both confirms it', function () {
    $this->visit->update(['schedule_status' => ProjectSchedule::STATUS_PENDING, 'venue_ownership' => ProjectSchedule::VENUE_THIRD_PARTY]);
    $docs = collect(SiteAccessDocument::TYPES)->keys()->map(fn (string $type) => SiteAccessDocument::create([
        'project_id' => $this->project->project_id,
        'document_type' => $type,
        'file_name' => "{$type}.pdf",
        'file_path' => "customers/1/projects/{$this->project->project_id}/site-access/{$type}.pdf",
        'status' => SiteAccessDocument::STATUS_SUBMITTED,
        'uploaded_by' => $this->customerUser->id,
        'uploaded_at' => now()->subDays(3),
    ]));

    saSave($this, ['report' => saReport()])->assertSessionHasErrors('visit');
    expect(saPageProject($this)['siteAccessDocuments'])->toHaveCount(2);

    $review = fn (SiteAccessDocument $doc, array $data) => $this->actingAs($this->pm)
        ->patch(route('project-manager.projects.site-access-documents.review', [$this->project, $doc]), $data);

    // A rejection needs a reason.
    $review($docs[0], ['decision' => 'reject'])->assertSessionHasErrors('remarks');
    expect($docs[0]->refresh()->status)->toBe(SiteAccessDocument::STATUS_SUBMITTED);

    $review($docs[0], ['decision' => 'approve'])->assertSessionHasNoErrors();
    expect($this->visit->refresh()->schedule_status)->toBe(ProjectSchedule::STATUS_PENDING); // one still waiting

    $review($docs[1], ['decision' => 'approve'])->assertSessionHasNoErrors();
    expect($docs[1]->refresh()->status)->toBe(SiteAccessDocument::STATUS_APPROVED)
        ->and($docs[1]->reviewed_by)->toBe($this->pm->id)
        ->and($this->visit->refresh()->schedule_status)->toBe(ProjectSchedule::STATUS_CONFIRMED);

    // Reviewed already: cannot be reviewed again.
    $review($docs[1], ['decision' => 'reject', 'remarks' => 'Blurry.'])->assertSessionHasErrors('remarks');
});

test('rejecting a document saves the reason for the customer', function () {
    $doc = SiteAccessDocument::create([
        'project_id' => $this->project->project_id,
        'document_type' => SiteAccessDocument::TYPE_VENUE_PERMIT,
        'file_name' => 'permit.pdf',
        'file_path' => 'permit.pdf',
        'status' => SiteAccessDocument::STATUS_SUBMITTED,
        'uploaded_by' => $this->customerUser->id,
        'uploaded_at' => now(),
    ]);

    $this->actingAs($this->pm)
        ->patch(route('project-manager.projects.site-access-documents.review', [$this->project, $doc]), ['decision' => 'reject', 'remarks' => 'The permit has expired.'])
        ->assertSessionHasNoErrors();

    expect($doc->refresh()->status)->toBe(SiteAccessDocument::STATUS_REJECTED)
        ->and($doc->remarks)->toBe('The permit has expired.');
});

test('the project manager can open a site assessment file; other roles cannot', function () {
    saSave($this, ['report' => saReport()]);
    $report = $this->visit->refresh()->outcome->files->first();

    $this->actingAs($this->pm)
        ->get(route('project-manager.projects.site-assessment.file', [$this->project, $report]))
        ->assertOk();

    $this->actingAs($this->customerUser)
        ->get(route('project-manager.projects.site-assessment.file', [$this->project, $report]))
        ->assertForbidden();
});