<?php

namespace App\Services;

use App\Models\Billing;
use App\Models\Contract;
use App\Models\DesignProposal;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * The project contract (Plan Project step 5), in one place.
 *
 *  - Issued automatically when the customer approves the design: the PDF is
 *    made from resources/views/pdf/contract.blade.php and config/contract.php,
 *    and the values it was made from are saved with it (contract_data).
 *  - The customer signs it electronically (drawn signature, with their name
 *    from the customers table and the date, stamped onto a new PDF) or uploads a physically signed copy
 *    (PDF, JPG or PNG, up to 10 MB).
 *  - The Project Manager verifies it, or rejects it with remarks; a rejection
 *    issues the next version for the customer to sign again. Verifying makes
 *    the fully signed PDF, with the Owner's signature from config/contract.php.
 *  - Verifying creates the final billing in two parts: the down payment
 *    (50%, due 7 days later) and the balance (50%, due 14 days before the
 *    event). The amounts and days come from config/contract.php.
 *  - Once the contract and the down payment are both verified, the project
 *    moves to Fabricating.
 *
 * The customer side uses signElectronically(), upload() and the down payment.
 * The Project Manager side can use review() and, after verifying a down
 * payment, startFabricationIfReady().
 */
class Contracts
{
    public const REMARKS_MAX = 1000;

    /** What the Project Manager confirms before approving (matches the PM contract review screen). */
    public const CHECKLIST = ['signed', 'details', 'amount', 'complete'];

    /** The signature pad's size; the drawn points use these coordinates. */
    public const PAD_WIDTH = 600;

    public const PAD_HEIGHT = 200;

    public function __construct(private ReservationFees $fees) {}

    public function today(): Carbon
    {
        return Carbon::now(ConsultationScheduler::TIMEZONE)->startOfDay();
    }

    /* ------------------------------------------------------------------ */
    /*  Reading                                                            */
    /* ------------------------------------------------------------------ */

    /** The newest version, or null before the contract is issued. */
    public function current(Project $project): ?Contract
    {
        $contracts = $project->relationLoaded('contracts') ? $project->contracts : $project->contracts()->get();

        return $contracts->sortBy('version_number')->last();
    }

    /** Earlier versions, newest first. @return Collection<int, Contract> */
    public function history(Project $project): Collection
    {
        $contracts = $project->relationLoaded('contracts') ? $project->contracts : $project->contracts()->get();

        return $contracts->sortByDesc('version_number')->slice(1)->values();
    }

    /** The contract version that was verified, if any. */
    public function verified(Project $project): ?Contract
    {
        $contracts = $project->relationLoaded('contracts') ? $project->contracts : $project->contracts()->get();

        return $contracts->firstWhere('status', Contract::STATUS_VERIFIED);
    }

    /* ------------------------------------------------------------------ */
    /*  Issuing                                                            */
    /* ------------------------------------------------------------------ */

    /** Issues the first contract for a project in Contract that has none (e.g. sample data). */
    public function ensureIssued(Project $project): ?Contract
    {
        $project->loadMissing('status');

        if ($project->status->status_name !== ProjectStatus::CONTRACT || $project->contracts()->exists()) {
            return null;
        }

        $approved = $project->designProposals()->where('customer_decision', DesignProposal::APPROVED)->latest('version_number')->first();

        return $approved ? $this->issue($project, $approved) : null;
    }

    /** Creates the next contract version, with its PDF, from the approved design. */
    public function issue(Project $project, DesignProposal $proposal, ?CarbonInterface $issuedAt = null): Contract
    {
        $issuedAt ??= Carbon::now(ConsultationScheduler::TIMEZONE);
        $version = (int) $project->contracts()->max('version_number') + 1;
        $data = $this->buildData($project, $proposal, $version, $issuedAt);

        $path = $this->folder($project, $version).'/'.sprintf('%s_v%d_Contract.pdf', Contract::codeFor($project), $version);
        Storage::put($path, $this->render($data));

        try {
            $contract = $project->contracts()->create([
                'design_proposal_id' => $proposal->design_proposal_id,
                'version_number' => $version,
                'status' => Contract::STATUS_ISSUED,
                'issued_at' => $issuedAt,
                'contract_file_path' => $path,
                'contract_data' => $data,
            ]);
        } catch (\Throwable $e) {
            Storage::delete($path);

            throw $e;
        }

        $project->unsetRelation('contracts');

        return $contract;
    }

    /**
     * Rebuilds the PDF of every contract nobody has signed yet, from the current
     * template and config (for developers: `php artisan contracts:regenerate`).
     */
    public function regenerateUnsigned(): int
    {
        $contracts = Contract::query()
            ->with(['project.serviceRequest.customer', 'project.reservationFee.payments', 'designProposal.items'])
            ->where('status', Contract::STATUS_ISSUED)
            ->get();

        foreach ($contracts as $contract) {
            if ($contract->designProposal === null) {
                continue;
            }

            $data = $this->buildData($contract->project, $contract->designProposal, $contract->version_number, $contract->issued_at);
            $path = $this->folder($contract->project, $contract->version_number).'/'.sprintf('%s_v%d_Contract.pdf', $contract->code(), $contract->version_number);

            Storage::put($path, $this->render($data));
            $contract->update(['contract_data' => $data, 'contract_file_path' => $path]);
        }

        return $contracts->count();
    }

    /**
     * Everything the PDF shows, worked out once and saved with the contract.
     *
     * @return array<string, mixed>
     */
    public function buildData(Project $project, DesignProposal $proposal, int $version, CarbonInterface $issuedAt): array
    {
        $project->loadMissing(['serviceRequest.customer', 'serviceRequest.eventType', 'reservationFee.payments']);
        $proposal->loadMissing('items');
        $request = $project->serviceRequest;
        $customer = $request->customer;

        $quotation = round((float) $proposal->quotation_amount, 2);
        $feePaid = $this->reservationFeePaid($project);
        [$total, $down, $balance] = $this->split($quotation - $feePaid);

        $percent = $this->downPercent();
        $replace = [
            ':down_percent' => $this->number($percent),
            ':balance_percent' => $this->number(100 - $percent),
            ':down_due_days' => (string) $this->downDueDays(),
            ':balance_due_days' => (string) $this->balanceDaysBeforeEvent(),
        ];

        $time = fn (?string $t) => $t ? Carbon::createFromFormat('H:i', substr($t, 0, 5))->format('g:i A') : null;
        $start = $request->start_date;
        $end = $request->end_date;

        return [
            'code' => Contract::codeFor($project),
            'version' => $version,
            'issuedAt' => $issuedAt->toDateString(),
            'business' => config('contract.business'),
            'customer' => [
                'name' => $customer->full_name,
                'contact' => $customer->contact_number,
                'email' => $customer->user?->email,
                'address' => $customer->address,
            ],
            'project' => [
                'code' => (string) $project->project_code,
                'title' => $request->isCustom() ? (string) $request->project_title : ($request->eventType?->event_type_name ?? 'Event'),
                'type' => $request->isCustom() ? 'Custom Project' : 'Standard Event Styling',
                'dates' => $start->isSameDay($end)
                    ? $start->format('F j, Y')
                    : $start->format('F j, Y').' – '.$end->format('F j, Y'),
                'time' => $time($request->event_start_time) ? $time($request->event_start_time).' – '.$time($request->event_end_time) : null,
                'venue' => $request->venue,
                'guests' => $request->guest_count,
            ],
            'quotation' => [
                'version' => $proposal->version_number,
                'items' => $proposal->items->sortBy('sort_order')->map(fn ($i) => [
                    'name' => $i->item_name,
                    'description' => $i->description,
                    'quantity' => (int) $i->quantity,
                    'unit' => $i->unit,
                    'unitPrice' => (float) $i->unit_price,
                    'subtotal' => (float) $i->subtotal,
                ])->values()->all(),
                'total' => $quotation,
            ],
            'payment' => [
                'reservationFeePaid' => $feePaid,
                'finalBilling' => $total,
                'downPercent' => $percent,
                'downPayment' => $down,
                'balance' => $balance,
                'downDueDays' => $this->downDueDays(),
                'balanceDaysBeforeEvent' => $this->balanceDaysBeforeEvent(),
            ],
            'terms' => collect(config('contract.terms', []))
                ->map(fn (string $text, string $heading) => ['heading' => $heading, 'text' => strtr($text, $replace)])
                ->values()
                ->all(),
        ];
    }

    /**
     * The PDF's bytes.
     *
     * $customer: the customer's signature block once signed:
     *   ['method' => 'electronic', 'svg' => ..., 'name' => ..., 'date' => 'Y-m-d'], or
     *   ['method' => 'upload', 'name' => ..., 'date' => 'Y-m-d'] (signed on paper).
     * $owner: the Owner's signature, added when the contract is verified:
     *   ['name' => ..., 'date' => 'Y-m-d'] (the image comes from config/contract.php).
     *
     * @param  array<string, mixed>  $data
     * @param  array<string, string>|null  $customer
     * @param  array<string, string>|null  $owner
     */
    public function render(array $data, ?array $customer = null, ?array $owner = null): string
    {
        if ($customer && isset($customer['svg'])) {
            $customer['src'] = 'data:image/svg+xml;base64,'.base64_encode($customer['svg']);
        }

        if ($owner) {
            $owner['src'] = $this->imageDataUri(config('contract.owner_signature'));
        }

        $view = [
            'c' => $data,
            'signature' => $customer,
            'owner' => $owner,
            'logo' => $this->imageDataUri(config('contract.logo')),
        ];

        if (config('contract.fake_pdf')) {
            // Tests: render the template (so its errors still show) but skip dompdf, which is slow.
            $html = view('pdf.contract', $view)->render();

            return "%PDF-1.4\n% test placeholder\n".'% '.md5($html)."\n%%EOF\n";
        }

        return Pdf::loadView('pdf.contract', $view)->setPaper('a4')->output();
    }

    /** An SVG, JPG or PNG file as a data URI for the PDF, or null if it is missing. */
    private function imageDataUri(?string $file): ?string
    {
        if (! $file || ! is_file($file)) {
            return null;
        }

        $mime = match (strtolower(pathinfo($file, PATHINFO_EXTENSION))) {
            'svg' => 'image/svg+xml',
            'png' => 'image/png',
            default => 'image/jpeg',
        };

        return "data:{$mime};base64,".base64_encode((string) file_get_contents($file));
    }

    /**
     * The fully signed contract, made when the Project Manager verifies it: the
     * customer's signature (or a note that a paper copy was signed) and the
     * Owner's signature, dated the day it was verified.
     */
    public function execute(Contract $contract, CarbonInterface $verifiedAt): void
    {
        $customer = $contract->sign_method === Contract::METHOD_ELECTRONIC && isset($contract->contract_data['signature'])
            ? ['method' => Contract::METHOD_ELECTRONIC] + $contract->contract_data['signature']
            : [
                'method' => Contract::METHOD_UPLOAD,
                'name' => $contract->contract_data['customer']['name'],
                'date' => ($contract->signed_at ?? $verifiedAt)->toDateString(),
            ];

        $pdf = $this->render($contract->contract_data, $customer, [
            'name' => $contract->contract_data['business']['representative'],
            'date' => $verifiedAt->toDateString(),
        ]);

        $path = $this->folder($contract->project, $contract->version_number).'/'.$contract->downloadName('executed');
        Storage::put($path, $pdf);

        $contract->update(['executed_contract_path' => $path]);
    }

    /* ------------------------------------------------------------------ */
    /*  Signing                                                            */
    /* ------------------------------------------------------------------ */

    /** Why the customer can't sign now, or null when they can. */
    public function signBlockedReason(Project $project, ?Contract $contract): ?string
    {
        $project->loadMissing('status');

        return match (true) {
            $contract === null => 'Your contract is being prepared.',
            $contract->status === Contract::STATUS_SIGNED => 'Your signed contract is waiting for verification.',
            $contract->status === Contract::STATUS_VERIFIED => 'Your contract is already signed and verified.',
            $contract->status !== Contract::STATUS_ISSUED => 'This contract version can no longer be signed.',
            $project->status->status_name !== ProjectStatus::CONTRACT => 'This contract can no longer be signed.',
            $project->isOnHold() => 'Your project is on hold.',
            default => null,
        };
    }

    /**
     * E-sign: the drawn signature, the customer's name and the date are stamped onto a new PDF.
     *
     * @param  list<list<array{0: float|int, 1: float|int}>>  $strokes  points on the 600×200 pad
     */
    public function signElectronically(Contract $contract, array $strokes, string $name): void
    {
        $signedAt = Carbon::now(ConsultationScheduler::TIMEZONE);
        $name = trim((string) preg_replace('/\s+/u', ' ', $name));

        // Kept with the contract, so the fully signed copy can show it too.
        $signature = ['svg' => $this->signatureSvg($strokes), 'name' => $name, 'date' => $signedAt->toDateString()];
        $pdf = $this->render($contract->contract_data, ['method' => Contract::METHOD_ELECTRONIC] + $signature);

        $fileName = $contract->downloadName('signed');
        $path = $this->folder($contract->project, $contract->version_number).'/'.$fileName;
        Storage::put($path, $pdf);

        $contract->update([
            'status' => Contract::STATUS_SIGNED,
            'signed_at' => $signedAt,
            'sign_method' => Contract::METHOD_ELECTRONIC,
            'signer_name' => mb_substr($name, 0, 150),
            'signed_file_name' => $fileName,
            'signed_contract_path' => $path,
            'contract_data' => ['signature' => $signature] + $contract->contract_data,
        ]);
    }

    /** Upload: a physically signed copy (PDF, JPG or PNG). */
    public function upload(Contract $contract, UploadedFile $file): void
    {
        $extension = strtolower($file->getClientOriginalExtension() ?: 'pdf');
        $stored = sprintf('%s_v%d_Signed-Contract.%s', $contract->code(), $contract->version_number, $extension);
        $path = $file->storeAs($this->folder($contract->project, $contract->version_number), $stored);

        try {
            $contract->update([
                'status' => Contract::STATUS_SIGNED,
                'signed_at' => Carbon::now(ConsultationScheduler::TIMEZONE),
                'sign_method' => Contract::METHOD_UPLOAD,
                'signer_name' => null,
                'signed_file_name' => mb_substr($file->getClientOriginalName(), 0, 150),
                'signed_contract_path' => $path,
            ]);
        } catch (\Throwable $e) {
            Storage::delete($path);

            throw $e;
        }
    }

    /**
     * The drawn strokes as an SVG (built here, never taken from the browser).
     *
     * @param  list<list<array{0: float|int, 1: float|int}>>  $strokes
     */
    public function signatureSvg(array $strokes): string
    {
        $paths = [];

        foreach ($strokes as $stroke) {
            $points = array_map(fn ($p) => sprintf('%.1f %.1f', (float) $p[0], (float) $p[1]), $stroke);

            if (count($points) === 1) {
                // A dot: a very short line so it still shows.
                [$x, $y] = $stroke[0];
                $points[] = sprintf('%.1f %.1f', (float) $x + 0.5, (float) $y);
            }

            $paths[] = 'M'.implode(' L', $points);
        }

        return sprintf(
            '<svg xmlns="http://www.w3.org/2000/svg" width="%1$d" height="%2$d" viewBox="0 0 %1$d %2$d">'
            .'<path d="%3$s" fill="none" stroke="#111111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            self::PAD_WIDTH,
            self::PAD_HEIGHT,
            implode(' ', $paths),
        );
    }

    /* ------------------------------------------------------------------ */
    /*  Project Manager review                                            */
    /* ------------------------------------------------------------------ */

    /**
     * For the Project Manager side: verify a signed contract, or reject it with
     * remarks (required). A rejection issues the next version to sign; the new
     * version is returned.
     *
     * @param  list<string>  $checklist  ticked items from self::CHECKLIST
     */
    public function review(Contract $contract, bool $approve, User $reviewer, ?string $remarks = null, array $checklist = []): ?Contract
    {
        if ($contract->status !== Contract::STATUS_SIGNED) {
            throw new \LogicException('Only a signed contract can be reviewed.');
        }

        if (! $approve && trim((string) $remarks) === '') {
            throw new \InvalidArgumentException('Remarks are required when rejecting a contract.');
        }

        return DB::transaction(function () use ($contract, $approve, $reviewer, $remarks, $checklist) {
            $now = Carbon::now(ConsultationScheduler::TIMEZONE);

            $contract->update([
                'status' => $approve ? Contract::STATUS_VERIFIED : Contract::STATUS_REJECTED,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => $now,
                'verified_at' => $approve ? $now : null,
                'rejection_reason' => $approve ? null : trim((string) $remarks),
                'checklist' => array_values(array_intersect(self::CHECKLIST, $checklist)),
            ]);

            if ($approve) {
                $this->execute($contract, $now);
                $this->issueFinalBills($contract->project, $contract, $now);
                $this->startFabricationIfReady($contract->project);

                return null;
            }

            // The same contract (same values), as the next version to sign.
            $version = $contract->version_number + 1;
            $data = ['version' => $version] + Arr::except($contract->contract_data, 'signature');
            $path = $this->folder($contract->project, $version).'/'.sprintf('%s_v%d_Contract.pdf', $contract->code(), $version);
            Storage::put($path, $this->render($data));

            $next = $contract->project->contracts()->create([
                'design_proposal_id' => $contract->design_proposal_id,
                'version_number' => $version,
                'status' => Contract::STATUS_ISSUED,
                'issued_at' => $now,
                'contract_file_path' => $path,
                'contract_data' => $data,
            ]);
            $contract->project->unsetRelation('contracts');

            return $next;
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Final billing                                                      */
    /* ------------------------------------------------------------------ */

    /**
     * The down payment and balance bills, from the verified contract's amounts.
     *
     * @return array{0: Billing, 1: Billing}
     */
    public function issueFinalBills(Project $project, Contract $contract, CarbonInterface $verifiedAt): array
    {
        $existing = $project->billings()->where('billing_type', Billing::TYPE_FINAL_BILLING)->orderBy('billing_id')->get();

        if ($existing->count() >= 2) {
            return [$existing[0], $existing[1]];
        }

        $payment = $contract->contract_data['payment'];
        [$downDue, $balanceDue] = $this->dueDates($project, $verifiedAt);
        $percent = $payment['downPercent'];

        $down = $project->billings()->create([
            'amount' => $payment['downPayment'],
            'billing_type' => Billing::TYPE_FINAL_BILLING,
            'issued_at' => $verifiedAt,
            'due_date' => $downDue->toDateString(),
            'status' => Billing::STATUS_ISSUED,
            'description' => 'Down payment ('.$this->number($percent).'% of the final billing)',
        ]);

        $balance = $project->billings()->create([
            'amount' => $payment['balance'],
            'billing_type' => Billing::TYPE_FINAL_BILLING,
            'issued_at' => $verifiedAt,
            'due_date' => $balanceDue->toDateString(),
            'status' => Billing::STATUS_ISSUED,
            'description' => 'Remaining balance ('.$this->number(100 - $percent).'% of the final billing)',
        ]);

        $project->unsetRelation('downPayment');
        $project->unsetRelation('balanceBill');

        return [$down, $balance];
    }

    /**
     * Down payment: N days after verification. Balance: N days before the event,
     * but never before the down payment's due date.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public function dueDates(Project $project, CarbonInterface $verifiedAt): array
    {
        $down = Carbon::parse($verifiedAt->toDateString(), ConsultationScheduler::TIMEZONE)->addDays($this->downDueDays());
        $event = Carbon::parse($project->serviceRequest->start_date->toDateString(), ConsultationScheduler::TIMEZONE);
        $balance = $event->copy()->subDays($this->balanceDaysBeforeEvent());

        return [$down, $balance->lt($down) ? $down->copy() : $balance];
    }

    /**
     * The final billing (quotation minus the reservation fee) and its two parts.
     * The down payment is rounded down to the centavo; the balance takes the rest.
     *
     * @return array{0: float, 1: float, 2: float}
     */
    public function split(float $finalBilling): array
    {
        $totalCents = max((int) round($finalBilling * 100), 0);
        $downCents = intdiv($totalCents * $this->downPercent(), 100);

        return [(float) ($totalCents / 100), (float) ($downCents / 100), (float) (($totalCents - $downCents) / 100)];
    }

    /** True once the down payment has a verified payment (or the bill is marked paid). */
    public function downPaymentPaid(Project $project): bool
    {
        $bill = $project->downPayment()->with('payments')->first();

        return $bill !== null && ($bill->status === Billing::STATUS_PAID || $this->fees->verified($bill) !== null);
    }

    /**
     * Moves the project to Fabricating once the contract and the down payment
     * are both verified. The Project Manager side calls this after verifying
     * the down payment. Returns true when the project moved.
     */
    public function startFabricationIfReady(Project $project): bool
    {
        $project->refresh()->load('status');

        if ($project->status->status_name !== ProjectStatus::CONTRACT
            || $project->contracts()->where('status', Contract::STATUS_VERIFIED)->doesntExist()
            || ! $this->downPaymentPaid($project)) {
            return false;
        }

        DB::transaction(function () use ($project) {
            $project->downPayment()->first()?->update(['status' => Billing::STATUS_PAID]);
            $project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::FABRICATING)]);
        });

        return true;
    }

    /* ------------------------------------------------------------------ */
    /*  Helpers                                                            */
    /* ------------------------------------------------------------------ */

    public function downPercent(): int
    {
        return (int) config('contract.payment.down_payment_percent', 50);
    }

    public function downDueDays(): int
    {
        return (int) config('contract.payment.down_payment_due_days', 7);
    }

    public function balanceDaysBeforeEvent(): int
    {
        return (int) config('contract.payment.balance_due_days_before_event', 14);
    }

    /** The verified reservation fee amount, or 0. */
    public function reservationFeePaid(Project $project): float
    {
        $bill = $project->reservationFee;

        return $bill && ($bill->status === Billing::STATUS_PAID || $bill->payments->contains('status', Payment::STATUS_VERIFIED))
            ? round((float) $bill->amount, 2)
            : 0.0;
    }

    private function folder(Project $project, int $version): string
    {
        $customerId = $project->serviceRequest()->value('customer_id');

        return sprintf('customers/%d/projects/%d/contract/v%d', $customerId, $project->project_id, $version);
    }

    private function number(int|float $n): string
    {
        return $n == floor($n) ? (string) (int) $n : (string) $n;
    }
}
