<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ContractSignRequest;
use App\Http\Requests\Customer\ContractUploadRequest;
use App\Models\Contract;
use App\Models\Project;
use App\Services\Contracts;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Customer > My Projects > Contract.
 *
 * The customer reads the contract PDF, then signs it electronically or uploads
 * a signed copy. After the Project Manager verifies it, the down payment is
 * paid on Billing & Payments.
 */
class ContractController extends Controller
{
    public function __construct(private Contracts $contracts) {}

    public function sign(ContractSignRequest $request, Project $project): RedirectResponse
    {
        ProjectController::ensureOwned($request, $project);

        $contract = $this->contracts->current($project);

        if ($reason = $this->contracts->signBlockedReason($project, $contract)) {
            return back()->withErrors(['contract' => $reason]);
        }

        // The name under the signature is the customer's name on their account.
        $this->contracts->signElectronically($contract, $request->strokes(), $project->serviceRequest->customer->full_name);

        return back();
    }

    public function upload(ContractUploadRequest $request, Project $project): RedirectResponse
    {
        ProjectController::ensureOwned($request, $project);

        $contract = $this->contracts->current($project);

        if ($reason = $this->contracts->signBlockedReason($project, $contract)) {
            return back()->withErrors(['contract' => $reason]);
        }

        $this->contracts->upload($contract, $request->file('file'));

        return back();
    }

    /**
     * Opens a contract version's PDF; ?signed=1 opens the customer's signed copy
     * and ?executed=1 the fully signed contract (with the Owner's signature).
     * Add &download=1 to download.
     */
    public function file(Request $request, Project $project, Contract $contract): StreamedResponse
    {
        ProjectController::ensureOwned($request, $project);
        abort_unless((int) $contract->project_id === (int) $project->project_id, 404);

        $which = $request->boolean('executed') ? 'executed' : ($request->boolean('signed') ? 'signed' : 'contract');
        $path = match ($which) {
            'executed' => $contract->executed_contract_path,
            'signed' => $contract->signed_contract_path,
            default => $contract->contract_file_path,
        };

        abort_unless($path && Storage::exists($path), 404);

        $name = $contract->downloadName($which);

        return $request->boolean('download') ? Storage::download($path, $name) : Storage::response($path, $name);
    }
}
