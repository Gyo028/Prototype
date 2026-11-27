<?php

namespace App\Services;

use App\Mail\NoticeMail;
use App\Models\Billing;
use App\Models\Project;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Sends the Project Manager side's email notices (fix list, Nov 27).
 * A notice is sent AFTER the action is saved, and a failed email never undoes the action:
 * it is logged in storage/logs/laravel.log instead (Claude's addition — the work order email,
 * #33, is different: there the email IS the action, so it must succeed first).
 */
class ProjectNotices
{
    /** The customer of the project, by email. Returns false when nothing was sent. */
    public static function toCustomer(Project $project, NoticeMail $mail): bool
    {
        $project->loadMissing('serviceRequest.customer.user');

        return self::send($project->serviceRequest?->customer?->user?->email, $mail);
    }

    public static function send(?string $email, NoticeMail $mail): bool
    {
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return false;
        }

        try {
            Mail::to($email)->send($mail);

            return true;
        } catch (Throwable $e) {
            report($e);

            return false;
        }
    }

    /** "₱12,500.00" */
    public static function peso(float $amount): string
    {
        return '₱'.number_format($amount, 2);
    }
    /* ---------- Workflow notices (fix list, Nov 27) ---------- */

    /** #16: the consultation outcome was recorded; when proceeding, the reservation bill was issued. */
    public static function consultationRecorded(Project $project): void
    {
        $project->loadMissing('serviceRequest.customer');
        $decision = (string) $project->customer_proceed_decision;
        $lines = ['Thank you for meeting with us. The outcome of your consultation has been recorded.'];
        $details = ['Project' => (string) $project->project_code, 'Decision' => match ($decision) {
            Project::DECISION_PROCEED => 'Proceed',
            Project::DECISION_HOLD => 'On hold',
            default => 'Do not proceed',
        }];

        $fee = $project->billings()->where('billing_type', Billing::TYPE_RESERVATION_FEE)->latest('billing_id')->first();
        if ($decision === Project::DECISION_PROCEED && $fee) {
            $lines[] = 'Your reservation fee bill has been issued. Please log in and pay it to reserve your event date.';
            $details['Reservation fee'] = self::peso((float) $fee->amount);
            $details['Due date'] = $fee->due_date->format('M j, Y');
        }

        self::toCustomer($project, new NoticeMail(
            subjectLine: "Consultation outcome recorded · {$project->project_code}",
            heading: 'Your consultation outcome',
            greeting: 'Hi '.($project->serviceRequest?->customer?->full_name ?? 'there').',',
            lines: $lines,
            details: $details,
        ));
    }

    /** #18: the signed contract was verified (execution starts) or rejected (resubmit with the remarks). */
    public static function contractReviewed(Project $project, bool $verified, ?string $remarks = null): void
    {
        $project->loadMissing('serviceRequest.customer');
        $details = ['Project' => (string) $project->project_code, 'Result' => $verified ? 'Verified' : 'Returned for correction'];
        if (! $verified && $remarks) {
            $details['Remarks'] = $remarks;
        }

        self::toCustomer($project, new NoticeMail(
            subjectLine: 'Your contract was '.($verified ? 'verified' : 'returned')." · {$project->project_code}",
            heading: $verified ? 'Your contract was verified' : 'Please resubmit your contract',
            greeting: 'Hi '.($project->serviceRequest?->customer?->full_name ?? 'there').',',
            lines: [$verified
                ? 'Your signed contract was verified. Project execution and scheduling are now underway; please log in to pay your bill.'
                : 'Your signed contract could not be verified. Please see the remarks, then sign and submit it again.'],
            details: $details,
        ));
    }

    /** #21: the Design Specialist was assigned to the project. */
    public static function designerAssigned(Project $project): void
    {
        $project->loadMissing(['designSpecialist.user', 'serviceRequest']);
        $designer = $project->designSpecialist;

        self::send($designer?->email ?: $designer?->user?->email, new NoticeMail(
            subjectLine: "New project assigned · {$project->project_code}",
            heading: 'You have a new project',
            greeting: 'Hi '.($designer?->full_name ?? 'Design Specialist').',',
            lines: ['You were assigned to design this project. Please log in to review it and prepare the design proposal.'],
            details: [
                'Project' => (string) $project->project_code,
                'Event date' => $project->serviceRequest?->start_date?->format('M j, Y') ?? '—',
                'Venue' => (string) $project->serviceRequest?->venue,
            ],
        ));
    }

    /** #24: the Project Manager returned the design proposal for revision (a new revision cycle). */
    public static function revisionRequested(Project $project, string $remarks): void
    {
        $project->loadMissing('designSpecialist.user');
        $designer = $project->designSpecialist;

        self::send($designer?->email ?: $designer?->user?->email, new NoticeMail(
            subjectLine: "Design revision requested · {$project->project_code}",
            heading: 'A new revision cycle has begun',
            greeting: 'Hi '.($designer?->full_name ?? 'Design Specialist').',',
            lines: ['The Project Manager returned your design proposal for revision. Please revise and resubmit it.'],
            details: ['Project' => (string) $project->project_code, 'Revision remarks' => $remarks],
        ));
    }
    }