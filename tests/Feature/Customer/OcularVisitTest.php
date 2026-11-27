<?php

use App\Enums\Role;
use App\Models\AppointmentOutcome;
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
use App\Services\ProjectProgress;
use App\Services\SiteAccessDocuments;
use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Support\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * The customer books (and reschedules) the ocular visit, and sees the site assessment once it is recorded.
 * "Today" is fixed at Monday, Nov 16, 2026 (Manila), so the earliest
 * bookable day is Monday, Nov 23. Nov 29 is a Sunday.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);
    Carbon::setTestNow(Carbon::parse('2026-11-16 10:00', 'Asia/Manila'));

    [$this->user, $this->customer] = ovCustomer();
    $this->project = ovProject($this->customer);
});

afterEach(fn () => Carbon::setTestNow());

/** @return array{0: User, 1: Customer} */
function ovCustomer(): array
{
    $user = User::factory()->create(['role' => Role::Customer]);

    return [$user, Customer::create([
        'user_id' => $user->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => uniqueMobile(),
    ])];
}

/** A paid project (Booked) whose consultation said a site visit is needed; event on Jan 16, 2027. */
function ovProject(Customer $customer, string $status = ProjectStatus::BOOKED, ?bool $ocular = true): Project
{
    $request = ServiceRequest::create([
        'customer_id' => $customer->customer_id,
        'request_type' => ServiceRequest::TYPE_STANDARD,
        'event_type_id' => EventType::where('event_type_name', 'Wedding')->value('event_type_id'),
        'request_date' => '2026-11-01',
        'start_date' => '2027-01-16',
        'end_date' => '2027-01-16',
        'event_start_time' => '14:00',
        'event_end_time' => '22:00',
        'venue' => 'Garden Pavilion, Tagaytay',
        'guest_count' => 150,
        'budget_min' => 250000,
        'budget_max' => 500000,
        'request_status' => ServiceRequest::STATUS_APPROVED,
    ]);

    $manager = Employee::query()->first() ?? Employee::create([
        'position_id' => EmployeePosition::where('position_name', 'Project Manager')->value('position_id'),
        'first_name' => 'Paolo',
        'last_name' => 'Reyes',
        'contact_number' => '09181112222',
        'email' => 'pm@example.com',
    ]);

    $project = Project::create([
        'service_request_id' => $request->service_request_id,
        'project_manager_id' => $manager->employee_id,
        'current_status_id' => ProjectStatus::idFor($status),
        'customer_proceed_decision' => Project::DECISION_PROCEED,
        'ocular_visit_required' => $ocular,
    ]);

    $project->schedules()->create([
        'schedule_type' => ProjectSchedule::TYPE_EVENT,
        'start_datetime' => '2027-01-16 14:00',
        'end_datetime' => '2027-01-16 22:00',
        'schedule_status' => ProjectSchedule::STATUS_CONFIRMED,
    ]);

    return $project;
}

function ovUrl(Project $project, string $action = ''): string
{
    return "/customer/projects/{$project->project_id}/ocular-visit".($action ? "/{$action}" : '');
}

/** A booking at the customer's own property on Nov 24, 9:00, unless overridden. */
function ovBook(array $overrides = []): array
{
    return array_merge(['date' => '2026-11-24', 'time' => '09:00', 'venueOwnership' => 'own_property'], $overrides);
}

function ovVisits(Project $project)
{
    return $project->schedules()->where('schedule_type', ProjectSchedule::TYPE_OCULAR_VISIT)->orderBy('schedule_id')->get();
}

function ovVisit(Project $project, string $date, string $from, string $to, string $status = ProjectSchedule::STATUS_CONFIRMED): ProjectSchedule
{
    return $project->schedules()->create([
        'schedule_type' => ProjectSchedule::TYPE_OCULAR_VISIT,
        'start_datetime' => "{$date} {$from}",
        'end_datetime' => "{$date} {$to}",
        'schedule_status' => $status,
        'meeting_mode' => ProjectSchedule::MODE_FACE_TO_FACE,
    ]);
}

/* ---------------- The page ---------------- */

test('the folder offers 2-hour ocular visit slots, without taken ones', function () {
    // Another project's consultation at Nov 23, 10:00–11:00 blocks the 9:00–11:00 visit.
    $other = ovProject(ovCustomer()[1]);
    $other->schedules()->create([
        'schedule_type' => ProjectSchedule::TYPE_CONSULTATION,
        'start_datetime' => '2026-11-23 10:00',
        'end_datetime' => '2026-11-23 11:00',
        'schedule_status' => ProjectSchedule::STATUS_CONFIRMED,
    ]);

    customerProjectPage($this->actingAs($this->user), $this->project)
        ->assertInertia(fn (Assert $page) => $page
            ->component('customer/project-show')
            ->where('currentStep', 'ocular_visit')
            ->where('nextAction.title', 'Book your ocular visit')
            ->where('nextAction.actionNeeded', true)
            ->where('ocularVisit.canBook', true)
            ->where('ocularVisit.rules.slotTimes', ['09:00', '11:00', '13:00', '15:00'])
            ->where('ocularVisit.rules.slotMinutes', 120)
            ->where('ocularVisit.rules.earliestDate', '2026-11-23')
            ->where('ocularVisit.rules.latestDate', '2027-01-15')
            ->where('ocularVisit.availableSlots.2026-11-23', ['11:00', '13:00', '15:00'])
            ->missing('ocularVisit.availableSlots.2026-11-29') // Sunday
            ->where('ocularVisit.assessment', null));
});

/* ---------------- Booking ---------------- */

test('booking saves a confirmed 2-hour face-to-face visit and moves the project to Site Assessment', function () {
    $this->actingAs($this->user)
        ->post(ovUrl($this->project), ovBook(['date' => '2026-11-24', 'time' => '13:00']))
        ->assertSessionHasNoErrors();

    $visit = ovVisits($this->project)->sole();

    expect($visit->schedule_status)->toBe(ProjectSchedule::STATUS_CONFIRMED)
        ->and($visit->meeting_mode)->toBe(ProjectSchedule::MODE_FACE_TO_FACE)
        ->and($visit->venue_ownership)->toBe(ProjectSchedule::VENUE_OWN_PROPERTY)
        ->and($visit->start_datetime->format('Y-m-d H:i'))->toBe('2026-11-24 13:00')
        ->and($visit->end_datetime->format('Y-m-d H:i'))->toBe('2026-11-24 15:00')
        ->and($this->project->refresh()->status->status_name)->toBe(ProjectStatus::SITE_ASSESSMENT);

    $progress = app(ProjectProgress::class)->for($this->project->refresh());
    expect($progress['currentStep'])->toBe('ocular_visit')
        ->and($progress['nextAction']['title'])->toBe('Attend your ocular visit')
        ->and($progress['nextAction']['actionNeeded'])->toBeFalse();
});

test('a booking must follow the slot rules', function (array $data, string $field) {
    $this->actingAs($this->user)
        ->post(ovUrl($this->project), ovBook($data))
        ->assertSessionHasErrors($field);

    expect(ovVisits($this->project))->toHaveCount(0)
        ->and($this->project->refresh()->status->status_name)->toBe(ProjectStatus::BOOKED);
})->with([
    'less than 7 days ahead' => [['date' => '2026-11-20'], 'time'],
    'a Sunday' => [['date' => '2026-11-29'], 'time'],
    'not a 2-hour slot start' => [['time' => '10:00'], 'time'],
    'ending after 5 PM' => [['time' => '16:00'], 'time'],
    'on the event date' => [['date' => '2027-01-16'], 'time'],
    'no date' => [['date' => ''], 'date'],
    'no time' => [['time' => ''], 'time'],
    'no venue ownership' => [['venueOwnership' => ''], 'venueOwnership'],
    'an unknown venue ownership' => [['venueOwnership' => 'borrowed'], 'venueOwnership'],
]);

test('a slot overlapping another appointment cannot be booked', function () {
    ovVisit(ovProject(ovCustomer()[1]), '2026-11-24', '10:00', '12:00');

    $this->actingAs($this->user)
        ->post(ovUrl($this->project), ovBook(['date' => '2026-11-24', 'time' => '11:00']))
        ->assertSessionHasErrors('time');

    expect(ovVisits($this->project))->toHaveCount(0);
});

test('an ocular visit also blocks the consultation slots it covers', function () {
    ovVisit($this->project, '2026-11-24', '09:00', '11:00');
    $consulting = ovProject(ovCustomer()[1], ProjectStatus::CONSULTATION, null);
    $consulting->update(['customer_proceed_decision' => null]);

    customerProjectPage($this->actingAs(User::find($consulting->serviceRequest->customer->user_id)), $consulting)
        ->assertInertia(fn (Assert $page) => $page
            ->where('availableSlots.2026-11-24', ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00']));
});

test('booking is only possible when the visit is needed and the fee is paid', function (string $status, ?bool $ocular) {
    $project = ovProject($this->customer, $status, $ocular);

    $this->actingAs($this->user)
        ->post(ovUrl($project), ovBook(['date' => '2026-11-24', 'time' => '09:00']))
        ->assertSessionHasErrors('ocularVisit');

    expect(ovVisits($project))->toHaveCount(0);
})->with([
    'not needed' => [ProjectStatus::BOOKED, false],
    'not decided yet' => [ProjectStatus::BOOKED, null],
    'fee not paid yet' => [ProjectStatus::CONSULTATION, true],
    'already designing' => [ProjectStatus::DESIGNING, true],
]);

test('only one visit can be booked; the second must be a reschedule', function () {
    ovVisit($this->project, '2026-11-24', '09:00', '11:00');

    $this->actingAs($this->user)
        ->post(ovUrl($this->project), ovBook(['date' => '2026-11-25', 'time' => '09:00']))
        ->assertSessionHasErrors('ocularVisit');

    expect(ovVisits($this->project))->toHaveCount(1);
});

test('a customer cannot book a visit on someone else\'s project', function () {
    [$otherUser] = ovCustomer();

    $this->actingAs($otherUser)
        ->post(ovUrl($this->project), ovBook(['date' => '2026-11-24', 'time' => '09:00']))
        ->assertNotFound();
});

/* ---------------- Rescheduling ---------------- */

test('rescheduling keeps the old visit in history with the reason', function () {
    $old = ovVisit($this->project, '2026-11-24', '09:00', '11:00');
    $this->project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::SITE_ASSESSMENT)]);

    $this->actingAs($this->user)
        ->patch(ovUrl($this->project, 'reschedule'), ['date' => '2026-11-26', 'time' => '15:00', 'reason' => 'The venue is closed that day.'])
        ->assertSessionHasNoErrors();

    $visits = ovVisits($this->project);

    expect($visits)->toHaveCount(2)
        ->and($visits[0]->schedule_id)->toBe($old->schedule_id)
        ->and($visits[0]->schedule_status)->toBe(ProjectSchedule::STATUS_CANCELLED)
        ->and($visits[0]->remarks)->toBe('Rescheduled: The venue is closed that day.')
        ->and($visits[0]->changed_by)->toBe($this->user->id)
        ->and($visits[1]->schedule_status)->toBe(ProjectSchedule::STATUS_CONFIRMED)
        ->and($visits[1]->start_datetime->format('Y-m-d H:i'))->toBe('2026-11-26 15:00')
        ->and($visits[1]->end_datetime->format('Y-m-d H:i'))->toBe('2026-11-26 17:00');
});

test('rescheduling needs a reason', function () {
    ovVisit($this->project, '2026-11-24', '09:00', '11:00');

    $this->actingAs($this->user)
        ->patch(ovUrl($this->project, 'reschedule'), ['date' => '2026-11-26', 'time' => '09:00', 'reason' => '  '])
        ->assertSessionHasErrors('reason');

    expect(ovVisits($this->project))->toHaveCount(1);
});

test('changes are allowed until the day before the visit, not on the day itself', function () {
    ovVisit($this->project, '2026-11-17', '13:00', '15:00'); // tomorrow

    customerProjectPage($this->actingAs($this->user), $this->project)
        ->assertInertia(fn (Assert $page) => $page->where('ocularVisit.canChange', true));

    Carbon::setTestNow(Carbon::parse('2026-11-17 07:00', 'Asia/Manila'));

    $this->actingAs($this->user)
        ->patch(ovUrl($this->project, 'reschedule'), ['date' => '2026-11-26', 'time' => '09:00', 'reason' => 'Conflict'])
        ->assertSessionHasErrors('ocularVisit');
});

test('there is no cancel for the ocular visit', function () {
    ovVisit($this->project, '2026-11-24', '09:00', '11:00');

    $this->actingAs($this->user)
        ->patch(ovUrl($this->project, 'cancel'), ['reason' => 'Changed my mind'])
        ->assertNotFound();
});

/* ---------------- Site assessment ---------------- */

function ovAssessment(Project $project): AppointmentOutcome
{
    $visit = ovVisit($project, '2026-11-10', '09:00', '11:00', ProjectSchedule::STATUS_COMPLETED);
    $project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::SITE_ASSESSMENT)]);

    $outcome = AppointmentOutcome::create([
        'schedule_id' => $visit->schedule_id,
        'notes' => 'Main hall is 18 m x 12 m.',
        'recorded_at' => '2026-11-11 10:00',
    ]);

    foreach ([['report', 'report.pdf'], ['photo', 'hall.jpg'], ['photo', 'door.png']] as [$type, $name]) {
        Storage::put("assessments/{$name}", 'sample');
        $outcome->files()->create(['file_type' => $type, 'file_name' => $name, 'file_path' => "assessments/{$name}"]);
    }

    return $outcome;
}

test('before the report, the held visit shows that the assessment is being written', function () {
    ovVisit($this->project, '2026-11-10', '09:00', '11:00', ProjectSchedule::STATUS_COMPLETED);
    $this->project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::SITE_ASSESSMENT)]);

    customerProjectPage($this->actingAs($this->user), $this->project)
        ->assertInertia(fn (Assert $page) => $page
            ->where('nextAction.title', 'Waiting for the site assessment')
            ->where('ocularVisit.canBook', false)
            ->where('ocularVisit.assessment', null)
            ->has('ocularVisit.history', 1));
});

test('the customer sees the site assessment report and photos', function () {
    ovAssessment($this->project);

    customerProjectPage($this->actingAs($this->user), $this->project)
        ->assertInertia(fn (Assert $page) => $page
            ->where('nextAction.title', 'Your site assessment is ready')
            ->where('ocularVisit.assessment.notes', 'Main hall is 18 m x 12 m.')
            ->where('ocularVisit.assessment.visitDate', '2026-11-10')
            ->where('ocularVisit.assessment.report.name', 'report.pdf')
            ->where('ocularVisit.assessment.report.viewable', true)
            ->has('ocularVisit.assessment.photos', 2)
            ->has('ocularVisit.assessment.attachments', 0));
});

test('site assessment files open for the owner only', function () {
    $outcome = ovAssessment($this->project);
    $report = $outcome->files->firstWhere('file_type', AppointmentOutcomeFile::TYPE_REPORT)
        ?? $outcome->files()->where('file_type', 'report')->first();
    $url = "/customer/projects/{$this->project->project_id}/site-assessment/files/{$report->outcome_file_id}";

    $this->actingAs($this->user)->get($url)->assertOk();
    $this->actingAs($this->user)->get($url.'?download=1')->assertDownload('report.pdf');

    [$otherUser] = ovCustomer();
    $this->actingAs($otherUser)->get($url)->assertNotFound();

    // A file from another project can't be reached through this project.
    $otherProject = ovProject($this->customer);
    $this->actingAs($this->user)
        ->get("/customer/projects/{$otherProject->project_id}/site-assessment/files/{$report->outcome_file_id}")
        ->assertNotFound();
});

/* ---------------- Site access documents (third-party venue) ---------------- */

function ovPdf(string $name = 'letter.pdf', int $kb = 100): UploadedFile
{
    return UploadedFile::fake()->create($name, $kb, 'application/pdf');
}

function ovDocs(Project $project)
{
    return SiteAccessDocument::query()->where('project_id', $project->project_id)->orderBy('document_id')->get();
}

function ovUpload(Project $project): string
{
    return "/customer/projects/{$project->project_id}/site-access-documents";
}

test('a visit at the customer\'s own property is confirmed right away and needs no documents', function () {
    $this->actingAs($this->user)
        ->post(ovUrl($this->project), ovBook(['authorizationLetter' => ovPdf()]))
        ->assertSessionHasNoErrors();

    expect(ovVisits($this->project)->sole()->schedule_status)->toBe(ProjectSchedule::STATUS_CONFIRMED)
        ->and(ovDocs($this->project))->toHaveCount(0); // ignored for own property
});

test('a third-party venue visit without documents is pending, and uploading is the action needed', function () {
    $this->actingAs($this->user)
        ->post(ovUrl($this->project), ovBook(['venueOwnership' => 'third_party']))
        ->assertSessionHasNoErrors();

    $visit = ovVisits($this->project)->sole();
    expect($visit->schedule_status)->toBe(ProjectSchedule::STATUS_PENDING)
        ->and($visit->venue_ownership)->toBe(ProjectSchedule::VENUE_THIRD_PARTY)
        ->and($this->project->refresh()->status->status_name)->toBe(ProjectStatus::SITE_ASSESSMENT);

    customerProjectPage($this->actingAs($this->user), $this->project)
        ->assertInertia(fn (Assert $page) => $page
            ->where('nextAction.title', 'Upload your site access documents')
            ->where('nextAction.actionNeeded', true)
            ->where('ocularVisit.current.venueOwnership', 'third_party')
            ->where('ocularVisit.canUploadDocuments', true)
            ->has('ocularVisit.documents', 2)
            ->where('ocularVisit.documents.0.type', 'authorization_letter')
            ->where('ocularVisit.documents.0.current', null));
});

test('documents uploaded when booking are saved for review; the visit waits for the Project Manager', function () {
    $this->actingAs($this->user)
        ->post(ovUrl($this->project), ovBook([
            'venueOwnership' => 'third_party',
            'authorizationLetter' => ovPdf('letter.pdf'),
            'venuePermit' => UploadedFile::fake()->create('permit.jpg', 200, 'image/jpeg'),
        ]))
        ->assertSessionHasNoErrors();

    $docs = ovDocs($this->project);
    expect($docs)->toHaveCount(2)
        ->and($docs->pluck('document_type')->all())->toBe(['authorization_letter', 'venue_permit'])
        ->and($docs->pluck('status')->unique()->all())->toBe(['submitted'])
        ->and(ovVisits($this->project)->sole()->schedule_status)->toBe(ProjectSchedule::STATUS_PENDING);

    $docs->each(fn (SiteAccessDocument $d) => Storage::assertExists($d->file_path));

    $progress = app(ProjectProgress::class)->for($this->project->refresh());
    expect($progress['nextAction']['title'])->toBe('Waiting for document review')
        ->and($progress['nextAction']['actionNeeded'])->toBeFalse();
});

test('booking documents must be PDF, JPG or PNG up to 5 MB', function (string $field, UploadedFile $file) {
    $this->actingAs($this->user)
        ->post(ovUrl($this->project), ovBook(['venueOwnership' => 'third_party', $field => $file]))
        ->assertSessionHasErrors($field);

    expect(ovVisits($this->project))->toHaveCount(0)
        ->and(ovDocs($this->project))->toHaveCount(0);
})->with([
    'a Word file' => ['authorizationLetter', fn () => UploadedFile::fake()->create('letter.docx', 100)],
    'a 6 MB permit' => ['venuePermit', fn () => UploadedFile::fake()->create('permit.pdf', 6 * 1024, 'application/pdf')],
]);

test('the visit is confirmed once the Project Manager approves both documents', function () {
    $this->actingAs($this->user)->post(ovUrl($this->project), ovBook([
        'venueOwnership' => 'third_party',
        'authorizationLetter' => ovPdf('letter.pdf'),
        'venuePermit' => ovPdf('permit.pdf'),
    ]));
    $docs = ovDocs($this->project);
    $manager = User::factory()->create(['role' => Role::ProjectManager]);
    $service = app(SiteAccessDocuments::class);

    $service->review($docs[0], true, $manager);
    expect(ovVisits($this->project)->sole()->schedule_status)->toBe(ProjectSchedule::STATUS_PENDING);

    $service->review($docs[1]->refresh(), true, $manager);
    expect(ovVisits($this->project)->sole()->schedule_status)->toBe(ProjectSchedule::STATUS_CONFIRMED);
});

test('a rejected document shows its reason, and replacing it keeps the old file in history', function () {
    $this->actingAs($this->user)->post(ovUrl($this->project), ovBook([
        'venueOwnership' => 'third_party',
        'authorizationLetter' => ovPdf('letter.pdf'),
        'venuePermit' => ovPdf('permit.pdf'),
    ]));
    $permit = ovDocs($this->project)->firstWhere('document_type', 'venue_permit');
    app(SiteAccessDocuments::class)->review($permit, false, User::factory()->create(['role' => Role::ProjectManager]), 'The permit has expired');

    customerProjectPage($this->actingAs($this->user), $this->project)
        ->assertInertia(fn (Assert $page) => $page
            ->where('nextAction.title', 'Upload your site access documents')
            ->where('nextAction.detail', fn ($d) => str_contains($d, 'The permit has expired'))
            ->where('ocularVisit.documents.1.current.status', 'rejected')
            ->where('ocularVisit.documents.1.current.remarks', 'The permit has expired'));

    $this->actingAs($this->user)
        ->post(ovUpload($this->project), ['type' => 'venue_permit', 'file' => ovPdf('permit-2027.pdf')])
        ->assertSessionHasNoErrors();

    $permits = ovDocs($this->project)->where('document_type', 'venue_permit')->values();
    expect($permits)->toHaveCount(2)
        ->and($permits[0]->replaced_at)->not->toBeNull()
        ->and($permits[0]->status)->toBe('rejected')
        ->and($permits[1]->replaced_at)->toBeNull()
        ->and($permits[1]->status)->toBe('submitted')
        ->and($permits[1]->file_name)->toBe('permit-2027.pdf');

    customerProjectPage($this->actingAs($this->user), $this->project)
        ->assertInertia(fn (Assert $page) => $page
            ->where('ocularVisit.documents.1.current.name', 'permit-2027.pdf')
            ->has('ocularVisit.documents.1.history', 1));
});

test('replacing an approved document puts a confirmed visit back to pending', function () {
    $this->actingAs($this->user)->post(ovUrl($this->project), ovBook([
        'venueOwnership' => 'third_party',
        'authorizationLetter' => ovPdf('letter.pdf'),
        'venuePermit' => ovPdf('permit.pdf'),
    ]));
    $manager = User::factory()->create(['role' => Role::ProjectManager]);
    ovDocs($this->project)->each(fn ($d) => app(SiteAccessDocuments::class)->review($d->refresh(), true, $manager));
    expect(ovVisits($this->project)->sole()->schedule_status)->toBe(ProjectSchedule::STATUS_CONFIRMED);

    $this->actingAs($this->user)->post(ovUpload($this->project), ['type' => 'authorization_letter', 'file' => ovPdf('new-letter.pdf')]);

    expect(ovVisits($this->project)->sole()->schedule_status)->toBe(ProjectSchedule::STATUS_PENDING);
});

test('documents can be uploaded until the day before the visit, and only for a third-party venue', function () {
    // Own property: nothing to upload.
    $this->actingAs($this->user)->post(ovUrl($this->project), ovBook());
    $this->actingAs($this->user)
        ->post(ovUpload($this->project), ['type' => 'venue_permit', 'file' => ovPdf()])
        ->assertSessionHasErrors('documents');

    // Third-party venue tomorrow: allowed today, not on the day itself.
    $project = ovProject($this->customer);
    $this->actingAs($this->user)->post(ovUrl($project), ovBook(['venueOwnership' => 'third_party', 'date' => '2026-11-23']));
    ovVisits($project)->sole()->update(['start_datetime' => '2026-11-17 09:00', 'end_datetime' => '2026-11-17 11:00']);

    $this->actingAs($this->user)
        ->post(ovUpload($project), ['type' => 'venue_permit', 'file' => ovPdf()])
        ->assertSessionHasNoErrors();

    Carbon::setTestNow(Carbon::parse('2026-11-17 07:00', 'Asia/Manila'));
    $this->actingAs($this->user)
        ->post(ovUpload($project), ['type' => 'authorization_letter', 'file' => ovPdf()])
        ->assertSessionHasErrors('documents');

    expect(ovDocs($project))->toHaveCount(1);
});

test('a document upload must be one of the two types and an accepted file', function (array $data, string $field) {
    $this->actingAs($this->user)->post(ovUrl($this->project), ovBook(['venueOwnership' => 'third_party']));

    $this->actingAs($this->user)->post(ovUpload($this->project), $data)->assertSessionHasErrors($field);

    expect(ovDocs($this->project))->toHaveCount(0);
})->with([
    'unknown type' => [fn () => ['type' => 'contract', 'file' => UploadedFile::fake()->create('a.pdf', 10, 'application/pdf')], 'type'],
    'no file' => [['type' => 'venue_permit'], 'file'],
    'a spreadsheet' => [fn () => ['type' => 'venue_permit', 'file' => UploadedFile::fake()->create('a.xlsx', 10)], 'file'],
]);

test('rescheduling keeps the venue and the documents', function () {
    $this->actingAs($this->user)->post(ovUrl($this->project), ovBook(['venueOwnership' => 'third_party', 'venuePermit' => ovPdf('permit.pdf')]));

    $this->actingAs($this->user)
        ->patch(ovUrl($this->project, 'reschedule'), ['date' => '2026-11-26', 'time' => '09:00', 'reason' => 'Venue asked for another day.'])
        ->assertSessionHasNoErrors();

    $visits = ovVisits($this->project);
    expect($visits[1]->venue_ownership)->toBe(ProjectSchedule::VENUE_THIRD_PARTY)
        ->and($visits[1]->schedule_status)->toBe(ProjectSchedule::STATUS_PENDING)
        ->and(ovDocs($this->project))->toHaveCount(1);
});

test('site access documents open for the owner only', function () {
    $this->actingAs($this->user)->post(ovUrl($this->project), ovBook(['venueOwnership' => 'third_party', 'venuePermit' => ovPdf('permit.pdf')]));
    $doc = ovDocs($this->project)->sole();
    $url = ovUpload($this->project)."/{$doc->document_id}";

    $this->actingAs($this->user)->get($url)->assertOk();
    $this->actingAs($this->user)->get($url.'?download=1')->assertDownload('permit.pdf');

    [$otherUser] = ovCustomer();
    $this->actingAs($otherUser)->get($url)->assertNotFound();
    $this->actingAs($otherUser)->post(ovUpload($this->project), ['type' => 'venue_permit', 'file' => ovPdf()])->assertNotFound();

    $otherProject = ovProject($this->customer);
    $this->actingAs($this->user)->get(ovUpload($otherProject)."/{$doc->document_id}")->assertNotFound();
});

