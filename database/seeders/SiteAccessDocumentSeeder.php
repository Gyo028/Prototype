<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\ProjectSchedule;
use App\Models\SiteAccessDocument;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Sample site access documents for ocular visits, until the Project Manager side reviews them.
 *
 *  - Every ocular visit becomes a third-party venue visit (the samples are hotels, malls and event places).
 *  - Held visits: both documents approved.
 *  - The booked (not yet held) visit: the authorization letter approved, the venue permit waiting for review, so the visit is 'pending'.
 *
 * Files are copied from database/seeders/samples/site-access into
 *   customers/{customer_id}/projects/{project_id}/site-access/
 *
 * Needs ProjectSeeder first. Skips if any site access document already exists.
 */
class SiteAccessDocumentSeeder extends Seeder
{
    private const SAMPLES = __DIR__.'/samples/site-access';

    private const FILES = [
        SiteAccessDocument::TYPE_AUTHORIZATION_LETTER => 'authorization-letter.pdf',
        SiteAccessDocument::TYPE_VENUE_PERMIT => 'venue-permit.pdf',
    ];

    public function run(): void
    {
        if (SiteAccessDocument::query()->exists()) {
            return;
        }

        $customerUserId = User::query()->where('email', Role::Customer->value.'@example.com')->value('id');
        $managerUserId = User::query()->where('email', Role::ProjectManager->value.'@example.com')->value('id');

        $visits = ProjectSchedule::query()
            ->with('project.serviceRequest')
            ->where('schedule_type', ProjectSchedule::TYPE_OCULAR_VISIT)
            ->whereIn('schedule_status', [...ProjectSchedule::ACTIVE_STATUSES, ProjectSchedule::STATUS_COMPLETED])
            ->get();

        DB::transaction(function () use ($visits, $customerUserId, $managerUserId) {
            foreach ($visits as $visit) {
                $held = $visit->schedule_status === ProjectSchedule::STATUS_COMPLETED;
                $uploadedAt = $visit->start_datetime->subDays(5)->setTime(9, 0);

                foreach (self::FILES as $type => $sample) {
                    // The booked visit: the permit is still waiting for review.
                    $approved = $held || $type === SiteAccessDocument::TYPE_AUTHORIZATION_LETTER;

                    $path = sprintf('customers/%d/projects/%d/site-access/%s', $visit->project->serviceRequest->customer_id, $visit->project_id, $sample);
                    Storage::put($path, file_get_contents(self::SAMPLES.'/'.$sample));

                    SiteAccessDocument::create([
                        'project_id' => $visit->project_id,
                        'document_type' => $type,
                        'file_name' => $sample,
                        'file_path' => $path,
                        'status' => $approved ? SiteAccessDocument::STATUS_APPROVED : SiteAccessDocument::STATUS_SUBMITTED,
                        'uploaded_by' => $customerUserId,
                        'uploaded_at' => $uploadedAt,
                        'reviewed_by' => $approved ? $managerUserId : null,
                        'reviewed_at' => $approved ? $uploadedAt->addDay() : null,
                    ]);
                }

                $visit->update([
                    'venue_ownership' => ProjectSchedule::VENUE_THIRD_PARTY,
                    'schedule_status' => $held ? ProjectSchedule::STATUS_COMPLETED : ProjectSchedule::STATUS_PENDING,
                ]);
            }
        });
    }
}
