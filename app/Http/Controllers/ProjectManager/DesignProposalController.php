<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Models\DesignProposal;
use App\Models\DesignProposalFile;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Services\DesignProposals;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Backlog #24: Review the design proposal.
 * The Design Specialist submits a version with its quotation lines. The Project Manager
 * finalizes the quotation and approves it, or returns it for revision.
 *   1. The proposal, the finalized quotation and the decision are saved.
 *   2. Returning for revision needs remarks.
 *   3. It cannot be approved while the quotation is incomplete or has missing prices.
 *
 * Uses the group's DesignProposals::review(): after the Project Manager approves, the
 * Owner reviews it, then the customer (the customer only sees versions both approved).
 * Decided with the user (Nov 26): the PM edits the designer's quotation lines; no discount.
 */
class DesignProposalController extends Controller
{
    /** decimal(10,2) columns: quotation_amount, unit_price, subtotal */
    public const MAX_AMOUNT = 99999999.99;

    public function approve(Request $request, Project $project, DesignProposals $proposals): RedirectResponse
    {
        $proposal = self::waitingForReview($project);

        $remarks = $request->validate(['remarks' => ['nullable', 'string', 'max:'.DesignProposals::REMARKS_MAX]])['remarks'] ?? null;
        $lines = self::quotationLines($request);

        DB::transaction(function () use ($proposal, $lines, $remarks, $proposals) {
            $proposal->load('items');
            $existing = $proposal->items->keyBy('item_id');
            $kept = [];

            foreach ($lines as $i => $line) {
                $values = [
                    'item_name' => $line['name'],
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['unitPrice'],
                    'subtotal' => $line['subtotal'],
                    'sort_order' => $i + 1,
                ];

                // A line the designer wrote keeps its description and unit; a new line has none.
                if ($line['itemId'] !== null && $existing->has($line['itemId'])) {
                    $existing[$line['itemId']]->update($values);
                    $kept[] = $line['itemId'];
                } else {
                    $proposal->items()->create($values + ['description' => null, 'unit' => null]);
                }
            }

            $proposal->items()->whereNotIn('item_id', $kept)->whereIn('item_id', $existing->keys())->delete();
            $proposal->update(['quotation_amount' => round(collect($lines)->sum('subtotal'), 2)]);

            $proposals->review($proposal, 'pm', true, self::clean($remarks));
        });

        return back();
    }

    public function returnForRevision(Request $request, Project $project, DesignProposals $proposals): RedirectResponse
    {
        // Acceptance criterion 2: no return for revision without remarks.
        $data = $request->validate(
            ['remarks' => ['required', 'string', 'max:'.DesignProposals::REMARKS_MAX]],
            ['remarks.required' => 'Revision remarks are required. Tell the Design Specialist what to change.'],
        );

        $proposal = self::waitingForReview($project);
        $proposals->review($proposal, 'pm', false, self::clean($data['remarks']));

        // Workflow: notify the Design Specialist that a new revision cycle has begun (fix list, Nov 27).
        \App\Services\ProjectNotices::revisionRequested($project, trim($data['remarks']));
        return back();
    }
        /** Opens a design proposal file (add ?download=1 to download it). */
    public function file(Request $request, Project $project, DesignProposalFile $file): StreamedResponse
    {
        $file->loadMissing('proposal');
        abort_unless((int) $file->proposal->project_id === (int) $project->project_id, 404);
        abort_unless(Storage::exists($file->file_path), 404);

        return $request->boolean('download') || ! $file->isViewable()
            ? Storage::download($file->file_path, $file->file_name)
            : Storage::response($file->file_path, $file->file_name);
    }

    /** The newest submitted version, or null (drafts are the designer's own). */
    public static function latest(Project $project): ?DesignProposal
    {
        $proposals = $project->relationLoaded('designProposals') ? $project->designProposals : $project->designProposals()->get();

        return $proposals->where('status', DesignProposal::STATUS_SUBMITTED)->sortBy('version_number')->last();
    }

    /** The version the Project Manager can decide on now, or a message why not. */
    private static function waitingForReview(Project $project): DesignProposal
    {
        $project->loadMissing('status');
        $fail = fn (string $message) => throw ValidationException::withMessages(['remarks' => $message]);

        if ($project->status->status_name !== ProjectStatus::DESIGNING) {
            $fail('The design proposal can no longer be reviewed (the project is '.strtolower($project->status->status_name).').');
        }

        $proposal = self::latest($project);

        if ($proposal === null) {
            $fail('The Design Specialist has not submitted a design proposal yet.');
        }

        if ($proposal->pm_review_decision !== DesignProposal::PENDING) {
            $fail('This version has already been reviewed.');
        }

        return $proposal;
    }

    /**
     * Acceptance criterion 3: every line needs a name, a quantity and a price.
     *
     * @return list<array{itemId: int|null, name: string, quantity: int, unitPrice: float, subtotal: float}>
     */
    private static function quotationLines(Request $request): array
    {
        $validator = Validator::make($request->all(), [
            'quotation.items' => ['required', 'array', 'min:1', 'max:100'],
            'quotation.items.*.id' => ['nullable', 'string', 'max:60'],
            'quotation.items.*.description' => ['required', 'string', 'max:150'],
            'quotation.items.*.quantity' => ['required', 'integer', 'min:1', 'max:100000'],
            'quotation.items.*.unitPrice' => ['required', 'numeric', 'gt:0', 'max:'.self::MAX_AMOUNT],
        ], [
            'quotation.items.required' => 'Add at least one line to the quotation.',
            'quotation.items.min' => 'Add at least one line to the quotation.',
            'quotation.items.*.description.required' => 'Every line needs a description.',
            'quotation.items.*.description.max' => 'A line description can be up to 150 characters.',
            'quotation.items.*.quantity.*' => 'Every line needs a quantity of at least 1.',
            'quotation.items.*.unitPrice.*' => 'Every line needs a price.',
        ]);

        if ($validator->fails()) {
            throw ValidationException::withMessages(['quotation' => 'The quotation is incomplete: '.$validator->errors()->first()]);
        }

        $lines = collect($request->input('quotation.items'))->map(function (array $item) {
            $quantity = (int) $item['quantity'];
            $price = round((float) $item['unitPrice'], 2);
            $id = preg_match('/^item-(\d+)$/', (string) ($item['id'] ?? ''), $m) ? (int) $m[1] : null;

            return [
                'itemId' => $id,
                'name' => trim((string) $item['description']),
                'quantity' => $quantity,
                'unitPrice' => $price,
                'subtotal' => round($quantity * $price, 2),
            ];
        });

        if ($lines->contains(fn ($l) => $l['name'] === '')) {
            throw ValidationException::withMessages(['quotation' => 'The quotation is incomplete: Every line needs a description.']);
        }

        if ($lines->contains(fn ($l) => $l['subtotal'] > self::MAX_AMOUNT) || $lines->sum('subtotal') > self::MAX_AMOUNT) {
            throw ValidationException::withMessages(['quotation' => 'The quotation total is too large.']);
        }

        return $lines->values()->all();
    }

    private static function clean(?string $text): ?string
    {
        $text = trim((string) $text);

        return $text === '' ? null : $text;
    }
}