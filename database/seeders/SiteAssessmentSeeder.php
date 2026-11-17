<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\AppointmentOutcome;
use App\Models\AppointmentOutcomeFile;
use App\Models\ProjectSchedule;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Sample site assessments (Plan Project step 3), until the Project Manager
 * side records them.
 *
 * Every held ocular visit gets an outcome with findings, a sample report
 * (PDF) and three sample venue photos, copied from database/seeders/samples
 * into the app's storage:
 *   customers/{customer_id}/projects/{project_id}/site-assessment/
 *
 * Needs ProjectSeeder first. Skips if any appointment outcome already exists.
 */
class SiteAssessmentSeeder extends Seeder
{
    private const SAMPLES = __DIR__.'/samples/site-assessment';

    private const REPORT = 'site-assessment-report.pdf';

    private const PHOTOS = ['venue-main-area.jpg', 'venue-entrance.jpg', 'venue-stage-wall.jpg'];

    private const NOTES = 'Venue measured and checked. Main area is about 18 m x 12.5 m with a 4.2 m ceiling. '
        .'Free-standing structures only (no nails or tape on walls). Ingress 6 hours before the event; '
        .'freight elevator limit 1,500 kg. Full details are in the report.';

    public function run(): void
    {
        if (AppointmentOutcome::query()->exists()) {
            return;
        }

        $managerUserId = User::query()->where('email', Role::ProjectManager->value.'@example.com')->value('id');

        $visits = ProjectSchedule::query()
            ->with('project.serviceRequest')
            ->where('schedule_type', ProjectSchedule::TYPE_OCULAR_VISIT)
            ->where('schedule_status', ProjectSchedule::STATUS_COMPLETED)
            ->get();

        DB::transaction(function () use ($visits, $managerUserId) {
            foreach ($visits as $visit) {
                $outcome = AppointmentOutcome::create([
                    'schedule_id' => $visit->schedule_id,
                    'notes' => self::NOTES,
                    'recorded_by' => $managerUserId,
                    'recorded_at' => $visit->end_datetime->addDay()->setTime(10, 0),
                ]);

                $folder = sprintf(
                    'customers/%d/projects/%d/site-assessment',
                    $visit->project->serviceRequest->customer_id,
                    $visit->project_id,
                );

                $this->attach($outcome, $folder, self::REPORT, AppointmentOutcomeFile::TYPE_REPORT);

                foreach (self::PHOTOS as $photo) {
                    $this->attach($outcome, $folder, $photo, AppointmentOutcomeFile::TYPE_PHOTO);
                }
            }
        });
    }

    private function attach(AppointmentOutcome $outcome, string $folder, string $sample, string $type): void
    {
        $path = "{$folder}/{$sample}";
        Storage::put($path, file_get_contents(self::SAMPLES.'/'.$sample));

        $outcome->files()->create([
            'file_type' => $type,
            'file_name' => $sample,
            'file_path' => $path,
        ]);
    }
}
