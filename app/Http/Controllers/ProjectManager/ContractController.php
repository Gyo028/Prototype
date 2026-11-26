<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Services\Contracts;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Backlog #18: Verify the project contract.
 * The customer signs the contract (electronically or by uploading a signed copy). The
 * Project Manager ticks the checklist and verifies it, or rejects it with remarks.
 *   1. The decision is saved.
 *   2. A rejection needs remarks.
 *
 * Uses the group's Contracts::review(): verifying makes the fully signed PDF and issues the
 * down payment and balance bills; rejecting issues the next version for the customer to sign.
 * The project moves to Fabricating once the down payment is also verified.
 */
class ContractController extends Controller
{
    public function approve(Request $request, Project $project, Contracts $contracts): RedirectResponse
    {
        $data = $request->validate([
            'remarks' => ['nullable', 'string', 'max:'.Contracts::REMARKS_MAX],
            'checklist' => ['array'],
            'checklist.*' => ['string', Rule::in(Contracts::CHECKLIST)],
        ]);

        // The checklist must be complete before a contract is verified.
        if (count(array_unique($data['checklist'] ?? [])) !== count(Contracts::CHECKLIST)) {
            throw ValidationException::withMessages(['checklist' => 'Tick every checklist item before approving the contract.']);
        }

        $contracts->review(self::waitingForReview($project, $contracts), true, $request->user(), null, $data['checklist']);

        return back();
    }

    public function reject(Request $request, Project $project, Contracts $contracts): RedirectResponse
    {
        // Acceptance criterion 2: no rejection without remarks.
        $data = $request->validate([
            'remarks' => ['required', 'string', 'max:'.Contracts::REMARKS_MAX],
            'checklist' => ['array'],
            'checklist.*' => ['string', Rule::in(Contracts::CHECKLIST)],
        ], [
            'remarks.required' => 'Remarks are required when rejecting a contract. Tell the customer what to fix.',
        ]);

        $contracts->review(self::waitingForReview($project, $contracts), false, $request->user(), trim($data['remarks']), $data['checklist'] ?? []);

        return back();
    }

    /** Opens the customer's signed contract (add ?download=1 to download it). */
    public function file(Request $request, Project $project, Contract $contract): StreamedResponse
    {
        abort_unless((int) $contract->project_id === (int) $project->project_id, 404);
        $path = $contract->signed_contract_path;
        abort_unless($path && Storage::exists($path), 404);

        $name = $contract->downloadName('signed');
        $viewable = in_array($contract->signedExtension(), ['pdf', 'jpg', 'jpeg', 'png'], true);

        return $request->boolean('download') || ! $viewable
            ? Storage::download($path, $name)
            : Storage::response($path, $name);
    }

    /** The signed version the Project Manager can decide on now, or a message why not. */
    private static function waitingForReview(Project $project, Contracts $contracts): Contract
    {
        $project->loadMissing('status');
        $fail = fn (string $message) => throw ValidationException::withMessages(['remarks' => $message]);

        if ($project->status->status_name !== ProjectStatus::CONTRACT) {
            $fail('The contract can no longer be reviewed (the project is '.strtolower($project->status->status_name).').');
        }

        $contract = $contracts->current($project);

        if ($contract === null || $contract->status === Contract::STATUS_ISSUED) {
            $fail('The customer has not signed the contract yet.');
        }

        if ($contract->status !== Contract::STATUS_SIGNED) {
            $fail('This contract has already been reviewed.');
        }

        return $contract;
    }
}