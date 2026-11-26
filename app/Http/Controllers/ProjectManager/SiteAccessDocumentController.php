<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\SiteAccessDocument;
use App\Services\SiteAccessDocuments;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Part of backlog #20 (decided with the user, Nov 25): the site access documents.
 * For an ocular visit at a third-party venue, the customer uploads an authorization
 * letter and a venue permit. The Project Manager approves or rejects each one (a reason
 * is required when rejecting). When both are approved, the group's
 * SiteAccessDocuments service confirms the pending visit.
 */
class SiteAccessDocumentController extends Controller
{
    public function review(Request $request, Project $project, SiteAccessDocument $document, SiteAccessDocuments $documents): RedirectResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'remarks' => ['nullable', 'string', 'max:255', 'required_if:decision,reject'],
        ], [
            'remarks.required_if' => 'Give the reason for rejecting this document. The customer will see it.',
        ]);

        abort_unless((int) $document->project_id === (int) $project->project_id, 404);

        // Only the current file can be reviewed, and only once (e.g. two tabs, or a double click).
        if ($document->replaced_at !== null || $document->status !== SiteAccessDocument::STATUS_SUBMITTED) {
            throw ValidationException::withMessages(['remarks' => 'This document has already been reviewed or replaced.']);
        }

        $documents->review($document, $data['decision'] === 'approve', $request->user(), trim((string) ($data['remarks'] ?? '')) ?: null);

        return back();
    }

    /** Opens the document (add ?download=1 to download it). */
    public function show(Request $request, Project $project, SiteAccessDocument $document): StreamedResponse
    {
        abort_unless((int) $document->project_id === (int) $project->project_id, 404);
        abort_unless(Storage::exists($document->file_path), 404);

        return $request->boolean('download') || ! $document->isViewable()
            ? Storage::download($document->file_path, $document->file_name)
            : Storage::response($document->file_path, $document->file_name);
    }
}