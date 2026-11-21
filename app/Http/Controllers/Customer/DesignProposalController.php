<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\DesignRevisionRequest;
use App\Models\DesignProposal;
use App\Models\DesignProposalFile;
use App\Models\Project;
use App\Services\DesignProposals;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Customer > My Projects > Design (Plan Project step 4).
 *
 * The customer reviews the version approved by the Project Manager and the
 * Owner, then approves it (the project moves to Contract) or requests
 * revisions with comments.
 */
class DesignProposalController extends Controller
{
    public function __construct(private DesignProposals $proposals) {}

    public function approve(Request $request, Project $project, DesignProposal $proposal): RedirectResponse
    {
        ProjectController::ensureOwned($request, $project);

        if ($reason = $this->proposals->decisionBlockedReason($project, $proposal)) {
            return back()->withErrors(['design' => $reason]);
        }

        $this->proposals->approve($proposal);

        return back();
    }

    public function requestRevision(DesignRevisionRequest $request, Project $project, DesignProposal $proposal): RedirectResponse
    {
        ProjectController::ensureOwned($request, $project);

        if ($reason = $this->proposals->decisionBlockedReason($project, $proposal)) {
            return back()->withErrors(['design' => $reason]);
        }

        $this->proposals->requestRevision($proposal, $request->validated('comments'));

        return back();
    }

    /** Shows a design file in the browser, or downloads it with ?download=1. */
    public function file(Request $request, Project $project, DesignProposalFile $file): StreamedResponse
    {
        ProjectController::ensureOwned($request, $project);

        $proposal = $file->proposal;
        abort_unless((int) $proposal->project_id === (int) $project->project_id && $proposal->isVisibleToCustomer(), 404);
        abort_unless(Storage::exists($file->file_path), 404);

        return $request->boolean('download') || ! $file->isViewable()
            ? Storage::download($file->file_path, $file->file_name)
            : Storage::response($file->file_path, $file->file_name);
    }
}
