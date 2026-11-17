<?php

use App\Models\AppointmentOutcome;
use App\Models\AppointmentOutcomeFile;
use App\Models\ProjectSchedule;
use App\Models\SiteAccessDocument;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/*
 * Plan Project, Slice 3: appointment_outcomes and appointment_outcome_files,
 * site_access_documents, and the sample data seeded until the Project Manager
 * side records and reviews them.
 */

test('the outcome tables have the agreed columns', function () {
    expect(Schema::getColumnListing('appointment_outcomes'))->toEqualCanonicalizing([
        'outcome_id', 'schedule_id', 'notes', 'recorded_by', 'recorded_at', 'created_at', 'updated_at',
    ]);
    expect(Schema::getColumnListing('appointment_outcome_files'))->toEqualCanonicalizing([
        'outcome_file_id', 'outcome_id', 'file_type', 'file_name', 'file_path', 'uploaded_at',
    ]);
    expect(Schema::getColumnListing('site_access_documents'))->toEqualCanonicalizing([
        'document_id', 'project_id', 'document_type', 'file_name', 'file_path', 'status', 'remarks',
        'uploaded_by', 'uploaded_at', 'reviewed_by', 'reviewed_at', 'replaced_at',
    ]);
});

test('sample ocular visits are at third-party venues with their documents', function () {
    $this->seed(DatabaseSeeder::class);

    $visits = ProjectSchedule::query()->where('schedule_type', ProjectSchedule::TYPE_OCULAR_VISIT)->get();
    expect($visits)->not->toBeEmpty()
        ->and($visits->pluck('venue_ownership')->unique()->all())->toBe([ProjectSchedule::VENUE_THIRD_PARTY]);

    // Held visits: both approved. The booked visit: pending, with the permit waiting for review.
    $booked = $visits->firstWhere('schedule_status', ProjectSchedule::STATUS_PENDING);
    expect($booked)->not->toBeNull();

    $bookedDocs = SiteAccessDocument::where('project_id', $booked->project_id)->pluck('status', 'document_type')->all();
    expect($bookedDocs)->toBe(['authorization_letter' => 'approved', 'venue_permit' => 'submitted']);

    $held = $visits->where('schedule_status', ProjectSchedule::STATUS_COMPLETED);
    foreach ($held as $visit) {
        expect(SiteAccessDocument::where('project_id', $visit->project_id)->pluck('status')->unique()->all())->toBe(['approved']);
    }

    SiteAccessDocument::all()->each(fn (SiteAccessDocument $d) => Storage::assertExists($d->file_path));
});

test('every held ocular visit gets a sample site assessment with a report and photos', function () {
    $this->seed(DatabaseSeeder::class);

    $held = ProjectSchedule::query()
        ->where('schedule_type', ProjectSchedule::TYPE_OCULAR_VISIT)
        ->where('schedule_status', ProjectSchedule::STATUS_COMPLETED)
        ->get();

    expect($held)->not->toBeEmpty()
        ->and(AppointmentOutcome::count())->toBe($held->count());

    foreach (AppointmentOutcome::with('files')->get() as $outcome) {
        expect($outcome->files->where('file_type', AppointmentOutcomeFile::TYPE_REPORT))->toHaveCount(1)
            ->and($outcome->files->where('file_type', AppointmentOutcomeFile::TYPE_PHOTO))->toHaveCount(3);

        $outcome->files->each(fn (AppointmentOutcomeFile $f) => Storage::assertExists($f->file_path));
    }
});

test('the outcome seeder runs only once', function () {
    $this->seed(DatabaseSeeder::class);
    $count = AppointmentOutcome::count();

    $this->seed(DatabaseSeeder::class);

    expect(AppointmentOutcome::count())->toBe($count);
});
