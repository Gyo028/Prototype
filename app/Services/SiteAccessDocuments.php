<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\SiteAccessDocument;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Site access documents for an ocular visit at a third-party venue:
 * the customer's authorization letter and the venue permit.
 *
 *  - Own property: none needed; the visit is confirmed right away.
 *  - Third-party venue: optional when booking. The visit stays 'pending' until
 *    the Project Manager approves both current files, then becomes 'confirmed'.
 *  - The customer can upload or replace a file until the day before the visit.
 *    The old file is kept (replaced_at set). A new file always needs review, so a
 *    confirmed visit goes back to pending.
 *  - Missing or rejected near the date: the visit stays pending and the Project
 *    Manager reschedules it (no automatic cancel for now).
 *
 * The Project Manager side calls review() and then confirmIfReady().
 */
class SiteAccessDocuments
{
    public function __construct(private OcularVisitScheduler $scheduler) {}

    /** The current file of each type: ['authorization_letter' => doc|null, 'venue_permit' => doc|null]. @return array<string, SiteAccessDocument|null> */
    public function current(Project $project): array
    {
        $docs = $project->relationLoaded('siteAccessDocuments')
            ? $project->siteAccessDocuments
            : $project->siteAccessDocuments()->get();

        $current = $docs->whereNull('replaced_at');

        return collect(SiteAccessDocument::TYPES)
            ->map(fn ($label, string $type) => $current->firstWhere('document_type', $type))
            ->all();
    }

    /** Replaced files of a type, newest first. */
    public function history(Project $project, string $type): Collection
    {
        $docs = $project->relationLoaded('siteAccessDocuments')
            ? $project->siteAccessDocuments
            : $project->siteAccessDocuments()->get();

        return $docs->where('document_type', $type)->whereNotNull('replaced_at')->values();
    }

    public function allApproved(Project $project): bool
    {
        return collect($this->current($project))->every(fn (?SiteAccessDocument $d) => $d?->status === SiteAccessDocument::STATUS_APPROVED);
    }

    /** True when a file is missing or was rejected (the customer has something to do). */
    public function needsUpload(Project $project): bool
    {
        return collect($this->current($project))->contains(fn (?SiteAccessDocument $d) => $d === null || $d->status === SiteAccessDocument::STATUS_REJECTED);
    }

    /** The status a new or moved ocular visit starts with. */
    public function visitStatusFor(Project $project, string $venueOwnership): string
    {
        return $venueOwnership === ProjectSchedule::VENUE_OWN_PROPERTY || $this->allApproved($project)
            ? ProjectSchedule::STATUS_CONFIRMED
            : ProjectSchedule::STATUS_PENDING;
    }

    /** Why the customer can't upload a document now, or null when they can. */
    public function uploadBlockedReason(Project $project): ?string
    {
        $visit = $this->scheduler->current($project);

        if ($visit === null) {
            return 'Book your ocular visit first.';
        }

        if ($visit->venue_ownership !== ProjectSchedule::VENUE_THIRD_PARTY) {
            return 'No site access documents are needed for a visit at your own property.';
        }

        return $this->scheduler->changeBlockedReason($project, $visit);
    }

    /** Saves a new file of a type, replacing the current one, and puts the visit back to pending. */
    public function store(Project $project, string $type, UploadedFile $file, User $user): SiteAccessDocument
    {
        $project->loadMissing('serviceRequest');
        $folder = sprintf('customers/%d/projects/%d/site-access', $project->serviceRequest->customer_id, $project->project_id);
        $path = $file->store($folder);

        try {
            return DB::transaction(function () use ($project, $type, $file, $user, $path) {
                $project->siteAccessDocuments()
                    ->where('document_type', $type)
                    ->whereNull('replaced_at')
                    ->update(['replaced_at' => now()]);

                $document = $project->siteAccessDocuments()->create([
                    'document_type' => $type,
                    'file_name' => $file->getClientOriginalName(),
                    'file_path' => $path,
                    'status' => SiteAccessDocument::STATUS_SUBMITTED,
                    'uploaded_by' => $user->id,
                    'uploaded_at' => now(),
                ]);

                // A new file needs the Project Manager's review again.
                $visit = $this->scheduler->current($project);

                if ($visit?->venue_ownership === ProjectSchedule::VENUE_THIRD_PARTY && $visit->schedule_status === ProjectSchedule::STATUS_CONFIRMED) {
                    $visit->update(['schedule_status' => ProjectSchedule::STATUS_PENDING]);
                }

                $project->unsetRelation('siteAccessDocuments');

                return $document;
            });
        } catch (\Throwable $e) {
            Storage::delete($path);

            throw $e;
        }
    }

    /**
     * For the Project Manager side: approve or reject a file (a reason is
     * required when rejecting), then confirm the visit when both are approved.
     */
    public function review(SiteAccessDocument $document, bool $approve, User $reviewer, ?string $remarks = null): void
    {
        $document->update([
            'status' => $approve ? SiteAccessDocument::STATUS_APPROVED : SiteAccessDocument::STATUS_REJECTED,
            'remarks' => $approve ? null : $remarks,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);

        $this->confirmIfReady($document->project);
    }

    /** A pending third-party visit becomes confirmed once both current files are approved. */
    public function confirmIfReady(Project $project): bool
    {
        $project->unsetRelation('siteAccessDocuments');
        $visit = $this->scheduler->current($project);

        if ($visit === null
            || $visit->venue_ownership !== ProjectSchedule::VENUE_THIRD_PARTY
            || $visit->schedule_status !== ProjectSchedule::STATUS_PENDING
            || ! $this->allApproved($project)) {
            return false;
        }

        $visit->update(['schedule_status' => ProjectSchedule::STATUS_CONFIRMED]);

        return true;
    }
}
