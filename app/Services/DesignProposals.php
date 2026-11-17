<?php

namespace App\Services;

use App\Models\DesignProposal;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * The design proposal's review flow (Plan Project step 4).
 *
 *   Design Specialist submits a version
 *      -Project Manager reviews it (approve, or return with remarks)
 *      -Owner reviews it (approve, or return with remarks)
 *      -customer reviews it: approve → the project moves to Contract;
 *                            request revisions (comments required) → the
 *                            designer submits the next version
 *
 * The customer only sees versions approved by both the Project Manager and the
 * Owner. No limit on revision rounds for now.
 *
 * The customer side uses awaitingCustomer(), approve() and requestRevision().
 * The Project Manager / Owner side can use review().
 */
class DesignProposals
{
    public const REMARKS_MAX = 1000;

    /** The newest version the customer can see, or null. */
    public function latestForCustomer(Project $project): ?DesignProposal
    {
        return $this->visible($project)->last();
    }

    /** Versions the customer can see, oldest first. */
    public function visible(Project $project)
    {
        $proposals = $project->relationLoaded('designProposals')
            ? $project->designProposals
            : $project->designProposals()->get();

        return $proposals->filter->isVisibleToCustomer()->sortBy('version_number')->values();
    }

    /** The version waiting for the customer's decision, or null. */
    public function awaitingCustomer(Project $project): ?DesignProposal
    {
        $project->loadMissing('status');
        $latest = $this->latestForCustomer($project);

        return $latest
            && $latest->customer_decision === DesignProposal::PENDING
            && $project->status->status_name === ProjectStatus::DESIGNING
            && ! $project->isOnHold()
                ? $latest
                : null;
    }

    /** True when the customer asked for a revision and the next version isn't out to them yet. */
    public function revisionInProgress(Project $project): bool
    {
        return $this->latestForCustomer($project)?->customer_decision === DesignProposal::REVISION_REQUESTED;
    }

    /** Why the customer can't decide on this version, or null when they can. */
    public function decisionBlockedReason(Project $project, DesignProposal $proposal): ?string
    {
        if ((int) $proposal->project_id !== (int) $project->project_id || ! $proposal->isVisibleToCustomer()) {
            return 'This design proposal is not available.';
        }

        $waiting = $this->awaitingCustomer($project);

        if ($waiting === null || (int) $waiting->design_proposal_id !== (int) $proposal->design_proposal_id) {
            return 'This version has already been answered or replaced by a newer one.';
        }

        return null;
    }

    /** The customer approves the design and quotation: the project moves to Contract. */
    public function approve(DesignProposal $proposal): void
    {
        DB::transaction(function () use ($proposal) {
            $proposal->update([
                'customer_decision' => DesignProposal::APPROVED,
                'decision_date' => now(),
            ]);

            $proposal->project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::CONTRACT)]);
        });
    }

    /** The customer asks for changes; the designer prepares the next version. */
    public function requestRevision(DesignProposal $proposal, string $comments): void
    {
        $proposal->update([
            'customer_decision' => DesignProposal::REVISION_REQUESTED,
            'customer_remarks' => $comments,
            'decision_date' => now(),
        ]);
    }

    /**
     * For the Project Manager / Owner side: approve a submitted version, or return
     * it to the designer (remarks required). $reviewer: 'pm' or 'owner'.
     */
    public function review(DesignProposal $proposal, string $reviewer, bool $approve, ?string $remarks = null): void
    {
        $prefix = $reviewer === 'owner' ? 'owner' : 'pm';

        $proposal->update([
            "{$prefix}_review_decision" => $approve ? DesignProposal::APPROVED : DesignProposal::REVISION_REQUESTED,
            "{$prefix}_remarks" => $remarks,
            "{$prefix}_reviewed_at" => now(),
        ]);
    }
}
