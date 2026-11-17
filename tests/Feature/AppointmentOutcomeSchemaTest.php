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

test('the design proposal tables have the agreed columns', function () {
    expect(Schema::getColumnListing('design_proposals'))->toEqualCanonicalizing([
        'design_proposal_id', 'project_id', 'design_specialist_id', 'version_number', 'quotation_amount', 'status',
        'submitted_at', 'external_link', 'pm_review_decision', 'pm_remarks', 'pm_reviewed_at', 'owner_review_decision',
        'owner_remarks', 'owner_reviewed_at', 'customer_decision', 'customer_remarks', 'decision_date', 'created_at', 'updated_at',
    ]);
    expect(Schema::getColumnListing('design_proposal_files'))->toEqualCanonicalizing([
        'proposal_file_id', 'design_proposal_id', 'file_category', 'file_name', 'file_path', 'uploaded_at', 'is_current',
    ]);
    expect(Schema::getColumnListing('design_proposal_items'))->toEqualCanonicalizing([
        'item_id', 'design_proposal_id', 'item_name', 'description', 'quantity', 'unit', 'unit_price', 'subtotal', 'sort_order',
    ]);
});

test('sample design proposals: a revision and a pending version for Designing, approved ones after', function () {
    $this->seed(DatabaseSeeder::class);

    $designing = \App\Models\Project::query()
        ->where('current_status_id', \App\Models\ProjectStatus::idFor(\App\Models\ProjectStatus::DESIGNING))
        ->first();
    $versions = \App\Models\DesignProposal::where('project_id', $designing->project_id)->orderBy('version_number')->get();

    expect($versions->pluck('customer_decision')->all())->toBe(['revision_requested', 'pending'])
        ->and((float) $versions[1]->quotation_amount)->toBe((float) $versions[1]->items()->sum('subtotal'));

    $contract = \App\Models\Project::query()
        ->where('current_status_id', \App\Models\ProjectStatus::idFor(\App\Models\ProjectStatus::CONTRACT))
        ->first();
    expect(\App\Models\DesignProposal::where('project_id', $contract->project_id)->value('customer_decision'))->toBe('approved');

    \App\Models\DesignProposalFile::all()->each(fn ($f) => Storage::assertExists($f->file_path));
});

test('the contracts table has the agreed columns', function () {
    expect(Schema::getColumnListing('contracts'))->toEqualCanonicalizing([
        'contract_id', 'project_id', 'design_proposal_id', 'version_number', 'status', 'issued_at', 'contract_file_path', 'contract_data',
        'signed_at', 'sign_method', 'signer_name', 'signed_file_name', 'signed_contract_path', 'executed_contract_path',
        'reviewed_by', 'reviewed_at', 'verified_at', 'rejection_reason', 'checklist', 'created_at', 'updated_at',
    ]);
});

test('sample contracts: one to sign, and signed, verified and paid ones after', function () {
    $this->seed(DatabaseSeeder::class);

    $inStatus = fn (string $status) => \App\Models\Project::query()
        ->where('current_status_id', \App\Models\ProjectStatus::idFor($status))
        ->firstOrFail();

    $toSign = \App\Models\Contract::where('project_id', $inStatus(\App\Models\ProjectStatus::CONTRACT)->project_id)->get();
    expect($toSign->pluck('status')->all())->toBe(['issued']);

    foreach ([\App\Models\ProjectStatus::FABRICATING => false, \App\Models\ProjectStatus::INSTALLING => true, \App\Models\ProjectStatus::COMPLETED => true] as $status => $balancePaid) {
        $project = $inStatus($status);
        $contract = \App\Models\Contract::where('project_id', $project->project_id)->sole();

        expect($contract->status)->toBe('verified')
            ->and($contract->sign_method)->toBe('electronic')
            ->and($project->downPayment->status)->toBe('paid')
            ->and($project->balanceBill->status)->toBe($balancePaid ? 'paid' : 'issued');

        Storage::assertExists($contract->contract_file_path);
        Storage::assertExists($contract->signed_contract_path);
        Storage::assertExists($contract->executed_contract_path);
    }

    // Seeding again adds nothing.
    $count = \App\Models\Contract::count();
    $this->seed(\Database\Seeders\ContractSeeder::class);
    expect(\App\Models\Contract::count())->toBe($count);
});
