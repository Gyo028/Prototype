<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Billing;
use App\Models\Contract;
use App\Models\DesignProposal;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\User;
use App\Services\Contracts;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Sample contracts (Plan Project step 5), until the Project Manager screens
 * verify them.
 *
 *  - Contract sample: version 1 issued, waiting for the customer to sign.
 *  - Fabricating, Installing and Completed samples: version 1 e-signed and
 *    verified (fully signed copy with the Owner's signature), with the down
 *    payment paid. The balance is paid for Installing
 *    and Completed, and still due for Fabricating.
 *
 * The PDFs are made from resources/views/pdf/contract.blade.php (dompdf).
 * Needs DesignProposalSeeder first. Skips if any contract already exists.
 */
class ContractSeeder extends Seeder
{
    private const SIGNED_STATUSES = [
        ProjectStatus::FABRICATING,
        ProjectStatus::INSTALLING,
        ProjectStatus::COMPLETED,
    ];

    public function run(Contracts $contracts): void
    {
        if (Contract::query()->exists()) {
            return;
        }

        $manager = User::query()->where('email', Role::ProjectManager->value.'@example.com')->first();

        $projects = Project::query()
            ->with(['status', 'serviceRequest.customer.user', 'designProposals'])
            ->whereHas('designProposals', fn ($q) => $q->where('customer_decision', DesignProposal::APPROVED))
            ->get();

        DB::transaction(function () use ($projects, $contracts, $manager) {
            foreach ($projects as $project) {
                $status = $project->status->status_name;
                $proposal = $project->designProposals->firstWhere('customer_decision', DesignProposal::APPROVED);
                $issuedAt = Carbon::parse($proposal->decision_date ?? now()->subDays(10))->addHour();

                if ($status === ProjectStatus::CONTRACT) {
                    $contracts->issue($project, $proposal, $issuedAt);
                } elseif (in_array($status, self::SIGNED_STATUSES, true)) {
                    $this->signedAndPaid($contracts, $project, $proposal, $issuedAt, $manager, $status !== ProjectStatus::FABRICATING);
                }
            }
        });
    }

    private function signedAndPaid(Contracts $contracts, Project $project, DesignProposal $proposal, Carbon $issuedAt, ?User $manager, bool $balancePaid): void
    {
        $contract = $contracts->issue($project, $proposal, $issuedAt);
        $customer = $project->serviceRequest->customer;

        $contracts->signElectronically($contract, $this->sampleSignature(), $customer->full_name);

        $signedAt = $issuedAt->copy()->addDay();
        $verifiedAt = $signedAt->copy()->addDay();

        $contract->update([
            'signed_at' => $signedAt,
            'status' => Contract::STATUS_VERIFIED,
            'reviewed_by' => $manager?->id,
            'reviewed_at' => $verifiedAt,
            'verified_at' => $verifiedAt,
            'checklist' => Contracts::CHECKLIST,
        ]);

        $contracts->execute($contract->refresh(), $verifiedAt);
        [$down, $balance] = $contracts->issueFinalBills($project, $contract, $verifiedAt);

        $this->pay($down, $verifiedAt->copy()->addDays(2), $customer->user_id, $manager);

        if ($balancePaid) {
            $this->pay($balance, Carbon::parse($balance->due_date)->subDays(2)->setTime(11, 0), $customer->user_id, $manager);
        }
    }

    /** A verified GCash payment for the whole bill, and the bill marked paid. */
    private function pay(Billing $bill, Carbon $paidAt, ?int $customerUserId, ?User $manager): void
    {
        $bill->payments()->create([
            'amount_paid' => $bill->amount,
            'payment_reference' => (string) random_int(1000000000000, 9999999999999),
            'payment_date' => $paidAt,
            'submitted_at' => $paidAt->copy()->addMinutes(10),
            'payment_method' => Payment::METHOD_GCASH,
            'status' => Payment::STATUS_VERIFIED,
            'recorded_by' => $customerUserId ?? $manager?->id,
            'verified_at' => $paidAt->copy()->addDay(),
        ]);

        $bill->update(['status' => Billing::STATUS_PAID]);
    }

    /**
     * A made-up handwritten-looking signature on the 600×200 pad: a looping
     * stroke and an underline.
     *
     * @return list<list<array{0: float, 1: float}>>
     */
    private function sampleSignature(): array
    {
        $loop = [];

        for ($i = 0; $i <= 120; $i++) {
            $t = $i / 120;
            $x = 60 + $t * 420;
            $y = 105 - 38 * sin($t * 14) * (1 - $t * 0.5) - 10 * cos($t * 5);
            $loop[] = [round($x, 1), round(max(5, min(195, $y)), 1)];
        }

        return [
            $loop,
            [[90.0, 160.0], [200.0, 152.0], [320.0, 150.0], [450.0, 146.0], [520.0, 140.0]],
        ];
    }
}
