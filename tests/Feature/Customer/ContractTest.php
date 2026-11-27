<?php

use App\Enums\Role;
use App\Models\Billing;
use App\Models\Contract;
use App\Models\Customer;
use App\Models\DesignProposal;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\EventType;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Services\Contracts;
use App\Services\DesignProposals;
use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * The customer reviews and signs the project contract (e-sign or
 * upload), the Project Manager verifies it, and the customer pays the down payment.
 *
 * The sample quotation is ₱380,000 and the reservation fee paid is ₱50,000,
 * so the final billing is ₱330,000: ₱165,000 down and ₱165,000 balance.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);

    // 10:00 in Manila.
    $this->travelTo(Carbon::parse('2026-11-20 10:00', 'Asia/Manila'));

    [$this->user, $this->customer] = ctCustomer();
    $this->project = ctProject($this->customer);
    $this->proposal = ctProposal($this->project);
    $this->manager = User::factory()->create(['role' => Role::ProjectManager]);
});

/** @return array{0: User, 1: Customer} */
function ctCustomer(string $first = 'Andrea', string $last = 'Santos'): array
{
    $user = User::factory()->create(['role' => Role::Customer]);

    return [$user, Customer::create([
        'user_id' => $user->id,
        'first_name' => $first,
        'last_name' => $last,
        'contact_number' => uniqueMobile(),
    ])];
}

/** A project in Designing with a paid ₱50,000 reservation fee; the event is on $eventDate. */
function ctProject(Customer $customer, string $eventDate = '2027-01-16'): Project
{
    $request = ServiceRequest::create([
        'customer_id' => $customer->customer_id,
        'request_type' => ServiceRequest::TYPE_STANDARD,
        'event_type_id' => EventType::where('event_type_name', 'Wedding')->value('event_type_id'),
        'request_date' => '2026-10-01',
        'start_date' => $eventDate,
        'end_date' => $eventDate,
        'event_start_time' => '14:00',
        'event_end_time' => '22:00',
        'venue' => 'Garden Pavilion, Tagaytay',
        'guest_count' => 150,
        'budget_min' => 250000,
        'budget_max' => 500000,
        'request_status' => ServiceRequest::STATUS_APPROVED,
    ]);

    $employee = fn (string $position, string $email) => Employee::where('email', $email)->first() ?? Employee::create([
        'position_id' => EmployeePosition::where('position_name', $position)->value('position_id'),
        'first_name' => 'Staff',
        'last_name' => $position,
        'contact_number' => '09181112222',
        'email' => $email,
    ]);

    $project = Project::create([
        'service_request_id' => $request->service_request_id,
        'project_manager_id' => $employee('Project Manager', 'pm@example.com')->employee_id,
        'design_specialist_id' => $employee('Design Specialist', 'ds@example.com')->employee_id,
        'design_assigned_at' => '2026-11-01 09:00',
        'current_status_id' => ProjectStatus::idFor(ProjectStatus::DESIGNING),
        'customer_proceed_decision' => Project::DECISION_PROCEED,
        'ocular_visit_required' => false,
    ]);

    $project->schedules()->create([
        'schedule_type' => ProjectSchedule::TYPE_EVENT,
        'start_datetime' => "{$eventDate} 14:00",
        'end_datetime' => "{$eventDate} 22:00",
        'schedule_status' => ProjectSchedule::STATUS_CONFIRMED,
    ]);

    $fee = $project->billings()->create([
        'amount' => 50000,
        'billing_type' => Billing::TYPE_RESERVATION_FEE,
        'issued_at' => '2026-10-10 10:00',
        'due_date' => '2026-10-17',
        'status' => Billing::STATUS_PAID,
        'description' => 'Reservation fee',
    ]);
    $fee->payments()->create([
        'amount_paid' => 50000,
        'payment_reference' => '1234567890',
        'payment_date' => '2026-10-11 10:00',
        'submitted_at' => '2026-10-11 10:05',
        'payment_method' => Payment::METHOD_GCASH,
        'status' => Payment::STATUS_VERIFIED,
        'verified_at' => '2026-10-12 09:00',
    ]);

    return $project;
}

/** A ₱380,000 version approved by the PM and the Owner, waiting for the customer. */
function ctProposal(Project $project): DesignProposal
{
    $proposal = DesignProposal::create([
        'project_id' => $project->project_id,
        'design_specialist_id' => $project->design_specialist_id,
        'version_number' => 1,
        'quotation_amount' => 380000,
        'status' => DesignProposal::STATUS_SUBMITTED,
        'submitted_at' => '2026-11-10 10:00',
        'pm_review_decision' => DesignProposal::APPROVED,
        'owner_review_decision' => DesignProposal::APPROVED,
    ]);

    $proposal->items()->createMany([
        ['item_name' => 'Stage backdrop', 'quantity' => 1, 'unit' => 'set', 'unit_price' => 200000, 'subtotal' => 200000, 'sort_order' => 1],
        ['item_name' => 'Floral arrangements', 'quantity' => 12, 'unit' => 'pc', 'unit_price' => 15000, 'subtotal' => 180000, 'sort_order' => 2],
    ]);

    return $proposal;
}

/** The customer approves the design, which issues contract v1. */
function ctIssue($test): Contract
{
    $test->actingAs($test->user)
        ->post("/customer/projects/{$test->project->project_id}/design-proposals/{$test->proposal->design_proposal_id}/approve")
        ->assertSessionHasNoErrors();

    return Contract::where('project_id', $test->project->project_id)->sole();
}

/** A signature with enough points: a wavy line across the pad. */
function ctStrokes(): array
{
    return [array_map(fn ($i) => [40 + $i * 20, 100 + ($i % 2 ? 25 : -25)], range(0, 20))];
}

function ctSign($test, array $overrides = [])
{
    return $test->actingAs($test->user)->post("/customer/projects/{$test->project->project_id}/contract/sign", array_merge([
        'signature' => json_encode(ctStrokes()),
        'agree' => true,
    ], $overrides));
}

function ctPage($test)
{
    return customerProjectPage($test->actingAs($test->user), $test->project);
}

/* ---------------- Issuing ---------------- */

test('approving the design issues contract version 1 with its PDF, and signing it is the action needed', function () {
    $contract = ctIssue($this);

    expect($contract->status)->toBe(Contract::STATUS_ISSUED)
        ->and($contract->version_number)->toBe(1)
        ->and($contract->design_proposal_id)->toBe($this->proposal->design_proposal_id)
        ->and($contract->contract_data['payment'])->toMatchArray([
            'reservationFeePaid' => 50000, 'finalBilling' => 330000, 'downPercent' => 50, 'downPayment' => 165000, 'balance' => 165000,
        ])
        ->and($contract->contract_data['terms'])->not->toBeEmpty();
    Storage::assertExists($contract->contract_file_path);

    ctPage($this)->assertInertia(fn (Assert $page) => $page
        ->where('currentStep', 'contract')
        ->where('nextAction.title', 'Review and sign your contract')
        ->where('nextAction.actionNeeded', true)
        ->where('contract.current.version', 1)
        ->where('contract.current.status', 'issued')
        ->where('contract.canSign', true)
        ->where('contract.signerName', 'Andrea Santos')
        ->where('contract.summary.finalBilling', fn ($v) => (float) $v === 330000.0)
        ->where('contract.summary.downPayment', fn ($v) => (float) $v === 165000.0)
        ->where('contract.downPayment', null));
});

test('a real PDF is made from the template: unsigned, e-signed and fully signed', function () {
    config(['contract.fake_pdf' => false]);
    $contract = ctIssue($this);

    expect(Storage::get($contract->contract_file_path))->toStartWith('%PDF');

    ctSign($this)->assertSessionHasNoErrors();
    expect(Storage::get($contract->refresh()->signed_contract_path))->toStartWith('%PDF');

    app(Contracts::class)->review($contract, true, $this->manager);
    expect(Storage::get($contract->refresh()->executed_contract_path))->toStartWith('%PDF');
});

test('a project in Contract without a contract gets one when the page opens (sample data)', function () {
    $this->proposal->update(['customer_decision' => DesignProposal::APPROVED, 'decision_date' => now()]);
    $this->project->update(['current_status_id' => ProjectStatus::idFor(ProjectStatus::CONTRACT)]);

    ctPage($this)->assertInertia(fn (Assert $page) => $page->where('contract.current.version', 1));
    expect(Contract::where('project_id', $this->project->project_id)->count())->toBe(1);
});

test('the final billing is split with the extra centavo on the balance', function () {
    expect(app(Contracts::class)->split(100000.01))->toBe([100000.01, 50000.0, 50000.01]);
});

/* ---------------- E-signing ---------------- */

test('e-signing saves the signed copy and waits for verification', function () {
    $contract = ctIssue($this);

    ctSign($this)->assertSessionHasNoErrors();

    $contract->refresh();
    expect($contract->status)->toBe(Contract::STATUS_SIGNED)
        ->and($contract->sign_method)->toBe(Contract::METHOD_ELECTRONIC)
        ->and($contract->signer_name)->toBe('Andrea Santos') // from the customers table
        ->and($contract->signed_at)->not->toBeNull()
        ->and($contract->signed_file_name)->toBe(Contract::codeFor($this->project).'_v1_Signed-Contract.pdf');
    Storage::assertExists($contract->signed_contract_path);

    ctPage($this)->assertInertia(fn (Assert $page) => $page
        ->where('nextAction.title', 'Waiting for contract verification')
        ->where('nextAction.actionNeeded', false)
        ->where('contract.canSign', false)
        ->where('contract.current.signMethod', 'electronic'));
});

test('the signature is built on the server from the drawn points', function () {
    $svg = app(Contracts::class)->signatureSvg([[[10, 20], [30.26, 40]], [[50, 60]]]);

    expect($svg)->toStartWith('<svg')
        ->toContain('d="M10.0 20.0 L30.3 40.0 M50.0 60.0 L50.5 60.0"')
        ->not->toContain('<script');
});

test('e-signing needs a drawn signature and the agreement', function (array $input, string $field) {
    $contract = ctIssue($this);

    ctSign($this, $input)->assertSessionHasErrors($field);

    expect($contract->refresh()->status)->toBe(Contract::STATUS_ISSUED);
})->with([
    'no signature' => [['signature' => ''], 'signature'],
    'not JSON' => [['signature' => 'not json'], 'signature'],
    'a dot only' => [['signature' => json_encode([[[100, 100]]])], 'signature'],
    'point off the pad' => [['signature' => json_encode([array_map(fn ($i) => [$i * 10, 900], range(1, 10))])], 'signature'],
    'not points' => [['signature' => json_encode([['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']])], 'signature'],
    'did not agree' => [['agree' => false], 'agree'],
]);

/* ---------------- Uploading ---------------- */

test('a signed copy can be uploaded as PDF, JPG or PNG', function (string $name, string $mime) {
    $contract = ctIssue($this);

    $this->actingAs($this->user)
        ->post("/customer/projects/{$this->project->project_id}/contract/upload", ['file' => UploadedFile::fake()->create($name, 800, $mime)])
        ->assertSessionHasNoErrors();

    $contract->refresh();
    expect($contract->status)->toBe(Contract::STATUS_SIGNED)
        ->and($contract->sign_method)->toBe(Contract::METHOD_UPLOAD)
        ->and($contract->signed_file_name)->toBe($name)
        ->and($contract->signedExtension())->toBe(pathinfo($name, PATHINFO_EXTENSION));
    Storage::assertExists($contract->signed_contract_path);
})->with([
    'pdf' => ['signed.pdf', 'application/pdf'],
    'jpg' => ['signed.jpg', 'image/jpeg'],
    'png' => ['signed.png', 'image/png'],
]);

test('an upload in another format or over 10 MB is rejected', function (Closure $file, string $message) {
    $contract = ctIssue($this);

    $this->actingAs($this->user)
        ->post("/customer/projects/{$this->project->project_id}/contract/upload", ['file' => $file()])
        ->assertSessionHasErrors(['file' => $message]);

    expect($contract->refresh()->status)->toBe(Contract::STATUS_ISSUED);
})->with([
    'Word file' => [fn () => UploadedFile::fake()->create('signed.docx', 100, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'The signed contract must be a PDF, JPG or PNG file.'],
    'over 10 MB' => [fn () => UploadedFile::fake()->create('signed.pdf', 10 * 1024 + 1, 'application/pdf'), 'The signed contract must be 10 MB or smaller.'],
]);

test('a contract can only be signed once, and not before it is issued', function () {
    ctSign($this)->assertSessionHasErrors(['contract' => 'Your contract is being prepared.']);

    ctIssue($this);
    ctSign($this)->assertSessionHasNoErrors();
    ctSign($this)->assertSessionHasErrors(['contract' => 'Your signed contract is waiting for verification.']);

    $this->actingAs($this->user)
        ->post("/customer/projects/{$this->project->project_id}/contract/upload", ['file' => UploadedFile::fake()->create('signed.pdf', 100, 'application/pdf')])
        ->assertSessionHasErrors('contract');
});

/* ---------------- Project Manager review ---------------- */

test('a rejected contract comes back as the next version, with the remarks shown', function () {
    $v1 = ctIssue($this);
    ctSign($this);

    expect(fn () => app(Contracts::class)->review($v1->refresh(), false, $this->manager, '  '))->toThrow(InvalidArgumentException::class);

    $v2 = app(Contracts::class)->review($v1->refresh(), false, $this->manager, 'Page 3 is not signed.');

    expect($v1->refresh()->status)->toBe(Contract::STATUS_REJECTED)
        ->and($v1->rejection_reason)->toBe('Page 3 is not signed.')
        ->and($v1->reviewed_by)->toBe($this->manager->id)
        ->and($v2->version_number)->toBe(2)
        ->and($v2->status)->toBe(Contract::STATUS_ISSUED)
        ->and($v2->contract_data['version'])->toBe(2)
        ->and($v2->contract_data)->not->toHaveKey('signature');
    Storage::assertExists($v2->contract_file_path);

    ctPage($this)->assertInertia(fn (Assert $page) => $page
        ->where('nextAction.title', 'Your signed contract was not accepted')
        ->where('nextAction.detail', 'Reason: Page 3 is not signed. Please review and sign the contract again.')
        ->where('nextAction.actionNeeded', true)
        ->where('contract.current.version', 2)
        ->where('contract.canSign', true)
        ->has('contract.history', 1)
        ->where('contract.history.0.status', 'rejected')
        ->where('contract.history.0.rejectionReason', 'Page 3 is not signed.'));

    ctSign($this)->assertSessionHasNoErrors();
    expect($v2->refresh()->status)->toBe(Contract::STATUS_SIGNED);
});

test('verifying creates the down payment and balance bills', function () {
    $contract = ctIssue($this);
    ctSign($this);

    app(Contracts::class)->review($contract->refresh(), true, $this->manager, null, ['signed', 'details', 'amount', 'complete', 'made-up']);

    $contract->refresh();
    expect($contract->status)->toBe(Contract::STATUS_VERIFIED)
        ->and($contract->verified_at)->not->toBeNull()
        ->and($contract->checklist)->toBe(Contracts::CHECKLIST);

    // The fully signed contract, with the Owner's signature.
    Storage::assertExists($contract->executed_contract_path);
    expect(basename($contract->executed_contract_path))->toBe(Contract::codeFor($this->project).'_v1_Fully-Signed-Contract.pdf');

    $project = $this->project->refresh();
    expect((float) $project->downPayment->amount)->toBe(165000.0)
        ->and($project->downPayment->due_date->toDateString())->toBe('2026-11-27') // 7 days after verifying
        ->and($project->downPayment->description)->toBe('Down payment (50% of the final billing)')
        ->and((float) $project->balanceBill->amount)->toBe(165000.0)
        ->and($project->balanceBill->due_date->toDateString())->toBe('2027-01-02') // 14 days before the event
        ->and($project->status->status_name)->toBe(ProjectStatus::CONTRACT); // not until the down payment is verified

    ctPage($this)->assertInertia(fn (Assert $page) => $page
        ->where('nextAction.title', 'Pay your down payment')
        ->where('nextAction.actionNeeded', true)
        ->where('contract.downPayment.amount', fn ($v) => (float) $v === 165000.0)
        ->where('contract.downPayment.title', 'Down payment')
        ->where('contract.downPayment.canPay', true)
        ->where('contract.downPayment.url', "/customer/billing/{$project->downPayment->billing_id}")
        ->where('contract.balance.title', 'Remaining balance')
        ->where('contract.balance.dueDate', '2027-01-02')
        ->where('contract.current.executedFile.name', Contract::codeFor($this->project).'_v1_Fully-Signed-Contract.pdf'));

    // Billing & Payments: remaining is the contract price minus what is paid (the reservation fee).
    $this->actingAs($this->user)->get('/customer/billing')
        ->assertInertia(fn (Assert $page) => $page
            ->where('projects.0.contractPrice', fn ($v) => (float) $v === 380000.0)
            ->where('projects.0.paid', fn ($v) => (float) $v === 50000.0)
            ->where('projects.0.remaining', fn ($v) => (float) $v === 330000.0)
            ->where('projects.0.nextBill.title', 'Down payment')
            ->where('projects.0.nextBill.kind', 'down_payment')
            ->where('projects.0.fullyPaid', false));
});

test('the fully signed contract shows both signatures, for e-signed and uploaded copies', function () {
    $owner = fn () => ['name' => config('contract.business.representative'), 'date' => '2026-11-20'];

    $html = fn (?array $customer) => view('pdf.contract', [
        'c' => Contract::where('project_id', $this->project->project_id)->latest('version_number')->first()->contract_data,
        'signature' => $customer,
        'owner' => $owner() + ['src' => 'data:image/svg+xml;base64,AAAA'],
        'logo' => null,
    ])->render();

    ctIssue($this);

    expect(config('contract.business.representative'))->toBe('Angela Santiago')
        ->and($html(['method' => 'electronic', 'src' => 'data:image/svg+xml;base64,BBBB', 'name' => 'Andrea Santos', 'date' => '2026-11-19']))
        ->toContain('alt="Client signature"')
        ->toContain('alt="Owner signature"')
        ->toContain('Angela Santiago')
        ->toContain('November 20, 2026')
        ->and($html(['method' => 'upload', 'name' => 'Andrea Santos', 'date' => '2026-11-19']))
        ->not->toContain('alt="Client signature"')
        ->toContain('Signed on paper');
});

test('an uploaded paper copy is also made into a fully signed contract when verified', function () {
    $contract = ctIssue($this);
    $this->actingAs($this->user)
        ->post("/customer/projects/{$this->project->project_id}/contract/upload", ['file' => UploadedFile::fake()->create('signed.pdf', 100, 'application/pdf')]);

    app(Contracts::class)->review($contract->refresh(), true, $this->manager);

    Storage::assertExists($contract->refresh()->executed_contract_path);
    $this->actingAs($this->user)
        ->get("/customer/projects/{$this->project->project_id}/contracts/{$contract->contract_id}/file?executed=1&download=1")
        ->assertDownload(Contract::codeFor($this->project).'_v1_Fully-Signed-Contract.pdf');
});

test('when the event is close, the balance is due with the down payment', function () {
    $this->project->serviceRequest->update(['start_date' => '2026-12-01', 'end_date' => '2026-12-01']);
    $contract = ctIssue($this);
    ctSign($this);

    app(Contracts::class)->review($contract->refresh(), true, $this->manager);

    expect($this->project->refresh()->balanceBill->due_date->toDateString())->toBe('2026-11-27');
});

test('only a signed contract can be reviewed', function () {
    $contract = ctIssue($this);

    expect(fn () => app(Contracts::class)->review($contract, true, $this->manager))->toThrow(LogicException::class);
});

/* ---------------- Down payment ---------------- */

test('the down payment is paid in full by GCash on its bill page, then the project moves to Fabricating once verified', function () {
    $contract = ctIssue($this);
    ctSign($this);
    $receipt = fn () => UploadedFile::fake()->create('receipt.pdf', 100, 'application/pdf');

    // No bill before the contract is verified.
    ctPage($this)->assertInertia(fn (Assert $page) => $page->where('contract.downPayment', null));

    app(Contracts::class)->review($contract->refresh(), true, $this->manager);
    $url = "/customer/billing/{$this->project->refresh()->downPayment->billing_id}/payments";

    $this->actingAs($this->user)->post($url, ['reference' => '1029384756', 'paymentDate' => '2026-11-20', 'amount' => '100000', 'receipt' => $receipt()])
        ->assertSessionHasErrors('amount');

    $this->actingAs($this->user)->post($url, ['reference' => '1029 384 756', 'paymentDate' => '2026-11-20', 'amount' => '165000', 'receipt' => $receipt()])
        ->assertSessionHasNoErrors();

    $bill = $this->project->refresh()->downPayment;
    $payment = $bill->payments()->sole();
    expect($payment->status)->toBe(Payment::STATUS_SUBMITTED)
        ->and($payment->payment_reference)->toBe('1029384756');

    ctPage($this)->assertInertia(fn (Assert $page) => $page->where('nextAction.title', 'Waiting for payment verification'));

    // The Project Manager verifies the payment (their side), then:
    $payment->update(['status' => Payment::STATUS_VERIFIED, 'verified_at' => now()]);
    expect(app(Contracts::class)->startFabricationIfReady($this->project))->toBeTrue();

    $this->project->refresh();
    expect($this->project->status->status_name)->toBe(ProjectStatus::FABRICATING)
        ->and($this->project->downPayment->status)->toBe(Billing::STATUS_PAID);

    $steps = collect(app(\App\Services\ProjectProgress::class)->for($this->project)['steps'])->keyBy('key');
    expect($steps['contract']['state'])->toBe('done')
        ->and($steps['contract']['note'])->toBe('Verified Nov 20');
});

/* ---------------- Files and access ---------------- */

test('the customer can open and download the contract and their signed copy', function () {
    $contract = ctIssue($this);
    ctSign($this);
    $base = "/customer/projects/{$this->project->project_id}/contracts/{$contract->contract_id}/file";

    $this->actingAs($this->user)->get($base)->assertOk();
    $this->actingAs($this->user)->get($base.'?download=1')->assertDownload(Contract::codeFor($this->project).'_v1_Contract.pdf');
    $this->actingAs($this->user)->get($base.'?signed=1&download=1')->assertDownload(Contract::codeFor($this->project).'_v1_Signed-Contract.pdf');
});

test('another customer cannot open, sign or upload the contract', function () {
    $contract = ctIssue($this);
    [$otherUser, $other] = ctCustomer('Maria', 'Clara');

    $this->actingAs($otherUser)->get("/customer/projects/{$this->project->project_id}/contracts/{$contract->contract_id}/file")->assertNotFound();
    $this->actingAs($otherUser)
        ->post("/customer/projects/{$this->project->project_id}/contract/sign", ['signature' => json_encode(ctStrokes()), 'agree' => true])
        ->assertNotFound();

    // A contract can't be reached through another project, even the customer's own.
    $otherProject = ctProject($this->customer);
    $this->actingAs($this->user)->get("/customer/projects/{$otherProject->project_id}/contracts/{$contract->contract_id}/file")->assertNotFound();

    expect($contract->refresh()->status)->toBe(Contract::STATUS_ISSUED);
});

test('My Projects flags the contract waiting for a signature', function () {
    ctIssue($this);

    $this->actingAs($this->user)->get('/customer/projects')
        ->assertInertia(fn (Assert $page) => $page
            ->where('items.0.nextAction.title', 'Review and sign your contract')
            ->where('items.0.nextAction.actionNeeded', true));
});

test('the PDF template can be rebuilt for unsigned contracts', function () {
    $contract = ctIssue($this);
    config(['contract.terms' => ['New clause' => 'Placeholder text.']]);

    expect(app(Contracts::class)->regenerateUnsigned())->toBe(1)
        ->and($contract->refresh()->contract_data['terms'])->toBe([['heading' => 'New clause', 'text' => 'Placeholder text.']]);

    // A signed contract keeps what it was signed with.
    ctSign($this);
    config(['contract.terms' => ['Another clause' => 'Changed.']]);
    expect(app(Contracts::class)->regenerateUnsigned())->toBe(0)
        ->and($contract->refresh()->contract_data['terms'][0]['heading'])->toBe('New clause');
});
