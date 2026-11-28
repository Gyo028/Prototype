<?php

use App\Enums\Role;
use App\Models\Billing;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\EventType;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Services\ReservationFees;
use Database\Seeders\ServiceAssetSeeder;
use App\Mail\NoticeMail;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Backlog #28: Record cash / cheque payments.
 *   1. Amount, method, date and (for cheques) the cheque number are saved as verified,
 *      and the customer's balance is updated.
 *   2. Nothing is saved when a required detail is missing.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);

    $this->pm = User::factory()->create(['role' => Role::ProjectManager, 'name' => 'Paolo Reyes']);
    $manager = Employee::create([
        'user_id' => $this->pm->id,
        'position_id' => EmployeePosition::where('position_name', 'Project Manager')->value('position_id'),
        'first_name' => 'Paolo',
        'last_name' => 'Reyes',
        'contact_number' => '09181112222',
        'email' => 'pm@example.com',
    ]);

    $customer = Customer::create([
        'user_id' => User::factory()->create(['role' => Role::Customer])->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => '09171234567',
    ]);

    $request = ServiceRequest::create([
        'customer_id' => $customer->customer_id,
        'request_type' => ServiceRequest::TYPE_STANDARD,
        'event_type_id' => EventType::where('event_type_name', 'Wedding')->value('event_type_id'),
        'request_date' => now()->toDateString(),
        'start_date' => now()->addMonths(3)->toDateString(),
        'end_date' => now()->addMonths(3)->toDateString(),
        'event_start_time' => '14:00:00',
        'event_end_time' => '22:00:00',
        'venue' => 'Grand Palace Events Hall, Quezon City',
        'guest_count' => 150,
        'budget_min' => 100000,
        'budget_max' => 250000,
        'project_description' => 'Rustic garden wedding.',
        'request_status' => ServiceRequest::STATUS_APPROVED,
        'reviewed_at' => now(),
    ]);

    // After the consultation: the ₱25,000 reservation fee is due.
    $this->project = Project::create([
        'service_request_id' => $request->service_request_id,
        'project_manager_id' => $manager->employee_id,
        'current_status_id' => ProjectStatus::idFor(ProjectStatus::CONSULTATION),
        'customer_proceed_decision' => Project::DECISION_PROCEED,
        'ocular_visit_required' => true,
    ]);
    $this->fee = app(ReservationFees::class)->issue($this->project);
});

function rpRecord($test, array $data)
{
    return $test->actingAs($test->pm)->post(route('project-manager.projects.payments.record', $test->project), $data + [
        'billingId' => null,
        'paidOn' => now()->toDateString(),
    ]);
}
test('a cash payment is saved as verified and the paid reservation fee books the project', function () {
    rpRecord($this, ['method' => 'Cash', 'amount' => 25000])->assertSessionHasNoErrors();

    $payment = $this->fee->payments()->first();
    expect($payment->payment_method)->toBe(Payment::METHOD_CASH)
        ->and($payment->status)->toBe(Payment::STATUS_VERIFIED)
        ->and($payment->verified_at)->not->toBeNull()
        ->and($payment->recorded_by)->toBe($this->pm->id)
        ->and($payment->receipt_file_path)->toBeNull()
        ->and($this->fee->refresh()->status)->toBe(Billing::STATUS_PAID)
        ->and($this->project->refresh()->status->status_name)->toBe(ProjectStatus::BOOKED);
});

test('a cheque payment keeps the cheque number and shows who recorded it', function () {
    rpRecord($this, ['method' => 'Cheque', 'amount' => 10000, 'chequeNo' => 'BDO 004512'])->assertSessionHasNoErrors();

    expect($this->fee->payments()->value('payment_reference'))->toBe('BDO 004512')
        ->and($this->fee->refresh()->status)->toBe(Billing::STATUS_ISSUED) // ₱15,000 still due
        ->and($this->project->refresh()->status->status_name)->toBe(ProjectStatus::CONSULTATION);

    $this->actingAs($this->pm)
        ->get(route('project-manager.projects.show', $this->project))
        ->assertInertia(function (Assert $page) {
            $all = $page->toArray();
            $payment = ($all['props'] ?? $all)['project']['payments'][0];

            expect($payment['method'])->toBe('Cheque')
                ->and($payment['chequeNo'])->toBe('BDO 004512')
                ->and($payment['status'])->toBe('Verified')
                ->and($payment['review']['reviewedBy'])->toBe('Paolo Reyes');
        });
});

test('nothing is saved when a required detail is missing', function () {
    rpRecord($this, ['method' => '', 'amount' => 25000])->assertSessionHasErrors('method');
    rpRecord($this, ['method' => 'Cash', 'amount' => ''])->assertSessionHasErrors('amount');
    rpRecord($this, ['method' => 'Cash', 'amount' => 25000, 'paidOn' => ''])->assertSessionHasErrors('paidOn');
    rpRecord($this, ['method' => 'Cheque', 'amount' => 25000, 'chequeNo' => ''])->assertSessionHasErrors('chequeNo');
    rpRecord($this, ['method' => 'Cash', 'amount' => 25000, 'paidOn' => now('Asia/Manila')->addDay()
    ->toDateString()])->assertSessionHasErrors('paidOn');

    expect($this->fee->payments()->count())->toBe(0);
});

test('a payment cannot be more than the remaining balance', function () {
    rpRecord($this, ['method' => 'Cash', 'amount' => 30000])->assertSessionHasErrors('amount');

    rpRecord($this, ['method' => 'Cash', 'amount' => 25000]);
    rpRecord($this, ['method' => 'Cash', 'amount' => 100])->assertSessionHasErrors('target'); // already paid

    expect($this->fee->payments()->count())->toBe(1);
});

test('a bill that is not this project\'s is refused', function () {
    rpRecord($this, ['billingId' => 999999, 'method' => 'Cash', 'amount' => 100])->assertSessionHasErrors('target');

    expect(Payment::count())->toBe(0);
});

/* ---------- fix list (Nov 27): acceptance criterion 1, "a payment confirmation is sent" ---------- */

test('recording a payment emails the customer a payment confirmation', function () {
    Mail::fake();

    rpRecord($this, ['method' => 'Cheque', 'amount' => 25000, 'chequeNo' => 'BDO-001234'])->assertSessionHasNoErrors();

    Mail::assertSent(NoticeMail::class, fn (NoticeMail $m) => $m->heading === 'Payment confirmation'
        && $m->details['Payment method'] === 'Cheque no. BDO-001234'
        && $m->details['Remaining balance of this bill'] === '₱0.00');
});