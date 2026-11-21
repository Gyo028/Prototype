<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\BillingDisputeRequest;
use App\Http\Requests\Customer\PaymentRequest;
use App\Models\Billing;
use App\Models\Contract;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\Project;
use App\Services\Billings;
use App\Services\ReservationFees;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Customer > Billing & Payments.
 *
 * index():   one row per project that has bills: contract price, paid,
 *            remaining and the next bill due.
 * project(): one project's bills, with its totals.
 * show():    one bill: its details, the GCash payment form, payment history
 *            and the billing dispute.
 *
 * The project page links here ("Pay now") for the reservation fee and the
 * down payment.
 */
class BillingController extends Controller
{
    public function __construct(private Billings $billings, private ReservationFees $fees) {}

    public function index(Request $request): Response
    {
        $customer = Customer::query()->where('user_id', $request->user()->id)->first();

        if ($customer !== null) {
            $this->fees->cancelOverdue($customer->customer_id);
        }

        $projects = $customer === null ? collect() : Project::query()
            ->with(['serviceRequest.eventType', 'status', 'billings.payments', 'contracts'])
            ->whereHas('serviceRequest', fn ($q) => $q->where('customer_id', $customer->customer_id))
            ->whereHas('billings')
            ->latest('project_id')
            ->get();

        return Inertia::render('customer/billing', [
            'projects' => $projects->map(fn (Project $project) => $this->projectSummary($project))->values(),
        ]);
    }

    /** One project's bills: totals and a table of its bills. */
    public function project(Request $request, Project $project): Response
    {
        ProjectController::ensureOwned($request, $project);
        $this->fees->cancelOverdue($project->serviceRequest->customer_id);

        $project->load(['serviceRequest.eventType', 'status', 'billings.payments', 'contracts']);

        return Inertia::render('customer/billing-project', [
            'project' => $this->projectSummary($project),
        ]);
    }

    /**
     * A project's money summary and its bills (oldest first).
     *
     * Remaining: once the contract is verified, the contract price plus any
     * additional charges, minus what is paid. Before that, the unpaid bills
     * issued so far (the reservation fee).
     *
     * Fully paid: the contract is verified and nothing remains. Before the
     * contract, paying every bill so far is "nothing due", not fully paid,
     * since the down payment and balance are still to come.
     *
     * @return array<string, mixed>
     */
    private function projectSummary(Project $project): array
    {
        $bills = $project->billings->sortBy('billing_id')->values()->each->setRelation('project', $project);
        $paid = $bills->filter(fn (Billing $b) => $this->billings->isPaid($b))->sum(fn (Billing $b) => (float) $b->amount);
        $unpaidBilled = $bills
            ->reject(fn (Billing $b) => $this->billings->isPaid($b) || $b->status === Billing::STATUS_OVERDUE)
            ->sum(fn (Billing $b) => (float) $b->amount);

        $verified = $project->contracts->firstWhere('status', Contract::STATUS_VERIFIED);
        $extras = $bills->where('billing_type', Billing::TYPE_ADDITIONAL_CHARGE)->sum(fn (Billing $b) => (float) $b->amount);
        $remaining = $verified
            ? max(0, round((float) $verified->contract_data['quotation']['total'] + $extras - $paid, 2))
            : $unpaidBilled;

        $cards = $bills->map(fn (Billing $b) => $this->billings->card($b));

        // The next bill to deal with: the earliest due among those not paid (and not overdue).
        $next = $cards
            ->filter(fn (array $c) => in_array($c['state'], [Billings::STATE_UNPAID, Billings::STATE_UNDER_REVIEW, Billings::STATE_DISPUTED], true))
            ->sortBy('dueDate')
            ->first();

        return [
            'id' => $project->project_id,
            'code' => ProjectController::projectCode($project),
            'title' => ProjectController::titleOf($project->serviceRequest),
            'status' => ProjectController::statusOf($project),
            'url' => "/customer/billing/projects/{$project->project_id}",
            'contractPrice' => $this->billings->contractPrice($project),
            'paid' => $paid,
            'remaining' => $remaining,
            'fullyPaid' => $verified !== null && $remaining <= 0,
            'nextBill' => $next ? [
                'kind' => $next['kind'], // reservation_fee | down_payment | balance | additional_charge
                'title' => $next['title'],
                'dueDate' => $next['dueDate'],
                'state' => $next['state'],
                'pastDue' => $next['pastDue'],
            ] : null,
            'bills' => $cards->values(),
        ];
    }

    public function show(Request $request, Billing $billing): Response
    {
        $this->ensureOwned($request, $billing);
        $this->fees->cancelOverdue($billing->project->serviceRequest->customer_id);

        $billing->refresh()->load(['payments', 'project.serviceRequest.eventType', 'project.status', 'project.billings']);
        $project = $billing->project;
        $kind = $this->billings->kind($billing);
        $payBlocked = $this->billings->payBlockedReason($billing);
        $disputeBlocked = $this->billings->disputeBlockedReason($billing);

        return Inertia::render('customer/billing-show', [
            'project' => [
                'id' => $project->project_id,
                'code' => ProjectController::projectCode($project),
                'title' => ProjectController::titleOf($project->serviceRequest),
                'status' => ProjectController::statusOf($project),
                'billingUrl' => "/customer/billing/projects/{$project->project_id}",
            ],
            'bill' => $this->billings->card($billing) + [
                'issuedAt' => $billing->issued_at->toDateString(),
                'status' => $billing->status,
                'description' => $billing->description,
                'texts' => $this->texts($kind),
            ],
            // The payment form and history (same shape as before, for the payment panel).
            'payment' => [
                'billing' => [
                    'id' => $billing->billing_id,
                    'amount' => (float) $billing->amount,
                    'issuedAt' => $billing->issued_at->toDateString(),
                    'dueDate' => $billing->due_date->toDateString(),
                    'status' => $billing->status,
                    'pastDue' => ! $billing->hasOpenDispute() && $this->fees->isPastDue($billing),
                ],
                'payments' => $billing->payments->sortByDesc('payment_id')->map(fn (Payment $p) => [
                    'id' => $p->payment_id,
                    'amount' => (float) $p->amount_paid,
                    'reference' => $p->payment_reference,
                    'paymentDate' => $p->payment_date->toDateString(),
                    'submittedAt' => $p->submitted_at->format('Y-m-d H:i'),
                    'method' => $p->payment_method,
                    'status' => $p->status,
                    'remarks' => $p->remarks,
                    'verifiedAt' => $p->verified_at?->toDateString(),
                    'receiptName' => $p->receipt_file_name,
                    'receiptUrl' => $p->receipt_file_path ? "/customer/payments/{$p->payment_id}/receipt" : null,
                ])->values(),
                'canPay' => $payBlocked === null,
                'payBlockedReason' => $payBlocked,
                'expectedAmount' => (float) $billing->amount,
                'dueDays' => $this->fees->dueDays(),
                'gcash' => config('payments.gcash'),
                'receipt' => ['maxMb' => (int) config('payments.receipt.max_mb', 5), 'types' => config('payments.receipt.mimes')],
            ],
            'dispute' => [
                'status' => $billing->dispute_status,
                'details' => $billing->dispute_details,
                'submittedAt' => $billing->dispute_submitted_at?->toDateString(),
                'proof' => $billing->dispute_proof_file_path ? [
                    'name' => $billing->dispute_proof_file_name ?? 'Proof',
                    'url' => "/customer/billing/{$billing->billing_id}/dispute-proof",
                ] : null,
                'resolution' => $billing->dispute_resolution,
                'remarks' => $billing->dispute_remarks,
                'resolvedAt' => $billing->dispute_resolved_at?->toDateString(),
                'canDispute' => $disputeBlocked === null,
                'blockedReason' => $disputeBlocked,
                'rules' => [
                    'min' => Billings::DISPUTE_MIN,
                    'max' => Billings::DISPUTE_MAX,
                    'proofMaxMb' => Billings::PROOF_MAX_MB,
                    'proofTypes' => Billings::PROOF_MIMES,
                ],
            ],
        ]);
    }

    /** A GCash payment for the whole bill, with its receipt. */
    public function pay(PaymentRequest $request, Billing $billing): RedirectResponse
    {
        $this->ensureOwned($request, $billing);

        // An overdue reservation fee is cancelled before anything else happens.
        $this->fees->cancelOverdue($billing->project->serviceRequest->customer_id);
        $billing->refresh()->load('payments');

        if ($reason = $this->billings->payBlockedReason($billing)) {
            return back()->withErrors(['payment' => $reason]);
        }

        $data = $request->validated();

        if (round((float) $data['amount'], 2) !== round((float) $billing->amount, 2)) {
            return back()->withErrors(['amount' => 'Please pay the full amount of ₱'.number_format((float) $billing->amount, 2).'.']);
        }

        if ($data['paymentDate'] < $billing->issued_at->toDateString()) {
            return back()->withErrors(['paymentDate' => 'The payment date cannot be before the bill was issued.']);
        }

        $this->fees->submit($billing, $data, $request->file('receipt'), $request->user());

        return back();
    }

    public function dispute(BillingDisputeRequest $request, Billing $billing): RedirectResponse
    {
        $this->ensureOwned($request, $billing);

        if ($reason = $this->billings->disputeBlockedReason($billing)) {
            return back()->withErrors(['dispute' => $reason]);
        }

        $this->billings->dispute($billing, trim($request->validated('details')), $request->file('proof'));

        return back();
    }

    /** The customer's own dispute proof; add ?download=1 to download. */
    public function disputeProof(Request $request, Billing $billing): StreamedResponse
    {
        $this->ensureOwned($request, $billing);

        $path = $billing->dispute_proof_file_path;
        abort_unless($path && Storage::exists($path), 404);

        $name = $billing->dispute_proof_file_name ?? basename($path);

        return $request->boolean('download') ? Storage::download($path, $name) : Storage::response($path, $name);
    }

    private function ensureOwned(Request $request, Billing $billing): void
    {
        $billing->loadMissing('project.serviceRequest');
        ProjectController::ensureOwned($request, $billing->project);
    }

    /** Wording for the payment panel, per kind of bill. @return array<string, string> */
    private function texts(string $kind): array
    {
        $down = (int) config('contract.payment.down_payment_percent', 50);

        return match ($kind) {
            Billings::KIND_RESERVATION_FEE => [
                'heading' => 'Reservation fee · 10% of your budget',
                'dueNote' => 'Pay in full by the due date. If it is not paid by then, your project is cancelled and the date is released.',
                'pendingNote' => 'Our Project Manager will check your payment. Your event date is confirmed once it is verified.',
            ],
            Billings::KIND_DOWN_PAYMENT => [
                'heading' => "Down payment · {$down}% of the final billing",
                'dueNote' => 'Pay in full by the due date. Work on your project starts once your down payment is verified.',
                'pendingNote' => 'Our Project Manager will check your payment. Work on your project starts once it is verified.',
            ],
            Billings::KIND_BALANCE => [
                'heading' => 'Remaining balance · '.(100 - $down).'% of the final billing',
                'dueNote' => 'Pay in full by the due date, before your event.',
                'pendingNote' => 'Our Project Manager will check your payment.',
            ],
            default => [
                'heading' => 'Additional charge',
                'dueNote' => 'Pay in full by the due date.',
                'pendingNote' => 'Our Project Manager will check your payment.',
            ],
        };
    }
}
