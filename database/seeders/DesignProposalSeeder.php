<?php

namespace Database\Seeders;

use App\Models\DesignProposal;
use App\Models\DesignProposalFile;
use App\Models\Project;
use App\Models\ProjectStatus;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Sample design proposals (Plan Project step 4), until the Design Specialist,
 * Project Manager and Owner screens create and review them.
 *
 *  - Designing sample: version 1 was approved by the Project Manager and the
 *    Owner, and the customer asked for a revision; version 2 (with a 3D render)
 *    is waiting for the customer's review.
 *  - Contract, Fabricating, Installing and Completed samples: version 1,
 *    approved by the customer (the custom ones also have a 3D file link).
 *
 * Files are copied from database/seeders/samples/design-proposal into
 *   customers/{customer_id}/projects/{project_id}/design/v{n}/
 *
 * Needs ProjectSeeder first. Skips if any design proposal already exists.
 */
class DesignProposalSeeder extends Seeder
{
    private const SAMPLES = __DIR__.'/samples/design-proposal';

    private const APPROVED_STATUSES = [
        ProjectStatus::CONTRACT,
        ProjectStatus::FABRICATING,
        ProjectStatus::INSTALLING,
        ProjectStatus::COMPLETED,
    ];

    public function run(): void
    {
        if (DesignProposal::query()->exists()) {
            return;
        }

        $projects = Project::query()
            ->with(['status', 'serviceRequest'])
            ->whereNotNull('design_specialist_id')
            ->get();

        DB::transaction(function () use ($projects) {
            foreach ($projects as $project) {
                $status = $project->status->status_name;
                $assigned = $project->design_assigned_at ?? now()->subDays(10);

                if ($status === ProjectStatus::DESIGNING) {
                    $this->version($project, 1, $assigned->addDays(3), [
                        'customer_decision' => DesignProposal::REVISION_REQUESTED,
                        'customer_remarks' => 'Please change the backdrop to sage green and add more flowers at the entrance arch.',
                        'decision_date' => $assigned->addDays(5),
                    ]);
                    $this->version($project, 2, $assigned->addDays(8), ['customer_decision' => DesignProposal::PENDING], render: true);
                } elseif (in_array($status, self::APPROVED_STATUSES, true)) {
                    $this->version($project, 1, $assigned->addDays(4), [
                        'customer_decision' => DesignProposal::APPROVED,
                        'decision_date' => $assigned->addDays(6),
                        'external_link' => $project->serviceRequest->isCustom() ? 'https://drive.google.com/drive/folders/sample-3d-files' : null,
                    ]);
                }
            }
        });
    }

    /** @param array<string, mixed> $attributes */
    private function version(Project $project, int $version, $submittedAt, array $attributes, bool $render = false): DesignProposal
    {
        $items = $this->items($project, $version);

        $proposal = DesignProposal::create([
            'project_id' => $project->project_id,
            'design_specialist_id' => $project->design_specialist_id,
            'version_number' => $version,
            'quotation_amount' => collect($items)->sum('subtotal'),
            'status' => DesignProposal::STATUS_SUBMITTED,
            'submitted_at' => $submittedAt,
            'pm_review_decision' => DesignProposal::APPROVED,
            'pm_reviewed_at' => $submittedAt->addHours(20),
            'owner_review_decision' => DesignProposal::APPROVED,
            'owner_reviewed_at' => $submittedAt->addDay(),
        ] + $attributes);

        foreach ($items as $i => $item) {
            $proposal->items()->create($item + ['sort_order' => $i + 1]);
        }

        $folder = sprintf('customers/%d/projects/%d/design/v%d', $project->serviceRequest->customer_id, $project->project_id, $version);
        $this->file($proposal, $folder, "design-proposal-v{$version}.pdf", DesignProposalFile::CATEGORY_2D, $version === 1 ? 'design-proposal-v1.pdf' : 'design-proposal-v2.pdf');

        if ($render) {
            $this->file($proposal, $folder, '3d-render-v2.jpg', DesignProposalFile::CATEGORY_3D, '3d-render-v2.jpg');
        }

        return $proposal;
    }

    private function file(DesignProposal $proposal, string $folder, string $name, string $category, string $sample): void
    {
        $path = "{$folder}/{$name}";
        Storage::put($path, file_get_contents(self::SAMPLES.'/'.$sample));

        $proposal->files()->create([
            'file_category' => $category,
            'file_name' => $name,
            'file_path' => $path,
            'is_current' => true,
        ]);
    }

    /**
     * Sample quotation lines, sized to the customer's budget (about 80% of the
     * top of the range). Version 2 adds the extra flowers asked for in the revision.
     *
     * @return list<array{item_name: string, description: string, quantity: int, unit: string, unit_price: float, subtotal: float}>
     */
    private function items(Project $project, int $version): array
    {
        $budget = (float) ($project->serviceRequest->budget_max ?? $project->serviceRequest->budget_min * 1.5);
        $target = max($budget * 0.8, 40000);

        $lines = [
            ['Stage backdrop', 'Custom-built backdrop with fabric draping', 1, 'set', 0.30],
            ['Floral arrangements', 'Table centerpieces and stage florals', 12, 'pc', 0.25],
            ['Entrance arch', 'Floral arch at the main entrance', 1, 'set', 0.15],
            ['Lighting', 'Warm uplights and fairy lights', 1, 'lot', 0.15],
            ['Ingress and egress', 'Set-up, styling and tear-down crew', 1, 'lot', 0.15],
        ];

        if ($version === 2) {
            $lines[] = ['Additional entrance florals', 'Added per your revision request', 4, 'pc', 0.05];
        }

        return array_map(function (array $l) use ($target) {
            [$name, $description, $quantity, $unit, $share] = $l;
            $unitPrice = round($target * $share / $quantity / 100) * 100;

            return [
                'item_name' => $name,
                'description' => $description,
                'quantity' => $quantity,
                'unit' => $unit,
                'unit_price' => $unitPrice,
                'subtotal' => $unitPrice * $quantity,
            ];
        }, $lines);
    }
}
