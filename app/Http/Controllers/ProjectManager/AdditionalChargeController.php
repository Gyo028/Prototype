<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Models\Billing;
use App\Models\Contract;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Services\ConsultationScheduler;
use App\Services\Contracts;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Backlog #29: Add additional charges.
 * A cost outside the approved quotation is billed to the customer as an additional charge.
 *   1. The details, amount and reason are saved, an additional charge bill is issued and
 *      the customer's remaining balance is updated.
 *   2. Nothing is saved when the amount or the reason is missing.
 *
 * Decided with the user (Nov 26): the billings table has one text column, so the details and
 * the reason are saved together in `description` ("Extra lighting — Reason: …"); the bill is
 * due 7 days after it is issued (the down payment's rule in config/contract.php).
 */
class AdditionalChargeController extends Controller
{
    /** Separates the details from the reason inside billings.description. */
    public const REASON_MARKER = ' — Reason: ';

    public function store(Request $request, Project $project, Contracts $contracts): RedirectResponse
    {
        $data = $request->validate([
            'description' => ['nullable', 'string', 'max:100'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999999.99'],
            'reason' => ['required', 'string', 'max:140'],
        ], [
            'amount.required' => 'Enter the amount of the additional charge.',
            'amount.gt' => 'Enter the amount of the additional charge.',
            'reason.required' => 'Give the reason for the additional charge.',
            'description.max' => 'The charge details can be up to 100 characters.',
            'reason.max' => 'The reason can be up to 140 characters.',
        ]);

        // My addition: only after the contract is verified, and not on a cancelled project.
        // A completed project can still get one (Workflow: "during execution or after the event").
        $project->loadMissing('status');
        $status = $project->status->status_name;
        if ($status === ProjectStatus::CANCELLED) {
            throw ValidationException::withMessages(['amount' => 'This project is cancelled.']);
        }
        if ($project->contracts()->where('status', Contract::STATUS_VERIFIED)->doesntExist()) {
            throw ValidationException::withMessages(['amount' => 'Additional charges can be added once the contract is verified.']);
        }

        $details = trim((string) ($data['description'] ?? ''));
        $reason = trim($data['reason']);
        $now = Carbon::now(ConsultationScheduler::TIMEZONE);

        $project->billings()->create([
            'amount' => round((float) $data['amount'], 2),
            'billing_type' => Billing::TYPE_ADDITIONAL_CHARGE,
            'issued_at' => $now,
            'due_date' => $now->copy()->addDays($contracts->downDueDays())->toDateString(),
            'status' => Billing::STATUS_ISSUED,
            'description' => self::combine($details, $reason),
        ]);

        return back();
    }

    /** "Extra lighting — Reason: client added uplights", or "Reason: …" without details. */
    public static function combine(string $details, string $reason): string
    {
        return $details === '' ? 'Reason: '.$reason : $details.self::REASON_MARKER.$reason;
    }

    /**
     * Splits a saved description back into [details, reason]. A charge added elsewhere
     * (e.g. sample data) has no marker: it is all details and no reason.
     *
     * @return array{0: string|null, 1: string|null}
     */
    public static function split(?string $description): array
    {
        $description = (string) $description;

        if (str_starts_with($description, 'Reason: ')) {
            return [null, substr($description, strlen('Reason: '))];
        }

        if (str_contains($description, self::REASON_MARKER)) {
            [$details, $reason] = explode(self::REASON_MARKER, $description, 2);

            return [$details, $reason];
        }

        return [$description === '' ? null : $description, null];
    }
}