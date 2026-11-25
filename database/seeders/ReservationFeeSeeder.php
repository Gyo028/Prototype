<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Billing;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\EventType;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\Service;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Services\PreliminaryLayouts;
use App\Services\ReservationFees;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Sample reservation fee bills (Plan Project step 2), until the Project
 * Manager side issues and verifies them.
 *
 *  - Sample projects from Booked onward (every customer's) get a paid bill
 *    with a verified GCash payment.
 *  - Two new sample projects for customer@example.com, both just after
 *    the consultation:
 *      · "fee due"      the bill is issued and waiting for payment
 *      · "payment sent" a payment is waiting for verification
 *
 * Needs ProjectSeeder first. Skips if any bill already exists.
 */
class ReservationFeeSeeder extends Seeder
{
    private const PAID_STATUSES = [
        ProjectStatus::BOOKED,
        ProjectStatus::SITE_ASSESSMENT,
        ProjectStatus::DESIGNING,
        ProjectStatus::CONTRACT,
        ProjectStatus::FABRICATING,
        ProjectStatus::INSTALLING,
        ProjectStatus::COMPLETED,
    ];

    public function run(ReservationFees $fees): void
    {
        if (Billing::query()->exists()) {
            return;
        }

        $customerUser = User::query()->where('email', Role::Customer->value.'@example.com')->first();
        $customer = $customerUser ? Customer::query()->where('user_id', $customerUser->id)->first() : null;
        $manager = $this->employeeFor(Role::ProjectManager);

        if ($customer === null || $manager === null || ! Project::query()->exists()) {
            return;
        }

        $today = Carbon::today();

        DB::transaction(function () use ($fees, $customer, $customerUser, $manager, $today) {
            $this->payExistingProjects($fees, $customerUser);

            // Fee due: consultation 2 days ago, bill issued yesterday (due in 6 days).
            $feeDue = $this->newProject($customer, $manager, 'Birthday', 80, '17:00', '22:00', 120, 100000, 250000, 'Seda Vertis North Ballroom, Quezon City', consultedDaysAgo: 2);
            $fees->issue($feeDue, $today->copy()->subDay()->setTime(10, 0));

            // Payment sent: consultation 5 days ago, bill issued 4 days ago, paid 3 days ago.
            $sent = $this->newProject($customer, $manager, 'Corporate', 95, '08:00', '17:00', 250, 250000, 500000, 'The Peninsula Manila, Makati', consultedDaysAgo: 5);
            $bill = $fees->issue($sent, $today->copy()->subDays(4)->setTime(10, 0));
            $bill->payments()->create([
                'amount_paid' => $bill->amount,
                'payment_reference' => '1029384756123',
                'payment_date' => $today->copy()->subDays(3)->setTime(14, 30),
                'submitted_at' => $today->copy()->subDays(3)->setTime(14, 45),
                'payment_method' => Payment::METHOD_GCASH,
                'status' => Payment::STATUS_SUBMITTED,
                'recorded_by' => $customerUser->id,
            ]);
        });
    }

    /** A paid bill with a verified payment for every sample project past the consultation. */
    private function payExistingProjects(ReservationFees $fees, User $customerUser): void
    {
        $statusIds = ProjectStatus::query()->whereIn('status_name', self::PAID_STATUSES)->pluck('status_id');

        // Every customer's projects (customer@example.com and the SampleCustomersSeeder accounts).
        $projects = Project::query()
            ->with(['schedules', 'serviceRequest.customer'])
            ->whereIn('current_status_id', $statusIds)
            ->get();

        foreach ($projects as $i => $project) {
            $consultation = $project->schedules
                ->where('schedule_type', ProjectSchedule::TYPE_CONSULTATION)
                ->where('schedule_status', ProjectSchedule::STATUS_COMPLETED)
                ->sortByDesc('start_datetime')
                ->first();

            $issuedAt = Carbon::parse(($consultation?->start_datetime ?? now()->subDays(10))->toDateString())->addDay()->setTime(10, 0);
            $bill = $fees->issue($project, $issuedAt);
            $bill->update(['status' => Billing::STATUS_PAID]);

            $bill->payments()->create([
                'amount_paid' => $bill->amount,
                'payment_reference' => (string) (5012345678900 + $i),
                'payment_date' => $issuedAt->copy()->addDays(2)->setTime(11, 15),
                'submitted_at' => $issuedAt->copy()->addDays(2)->setTime(11, 20),
                'payment_method' => Payment::METHOD_GCASH,
                'status' => Payment::STATUS_VERIFIED,
                'recorded_by' => $project->serviceRequest->customer->user_id ?? $customerUser->id,
                'verified_at' => $issuedAt->copy()->addDays(3)->setTime(9, 0),
            ]);
        }
    }

    /** An approved standard request whose consultation is done and the customer chose to proceed. */
    private function newProject(
        Customer $customer,
        Employee $manager,
        string $eventType,
        int $inDays,
        string $from,
        string $to,
        int $guests,
        int $budgetMin,
        int $budgetMax,
        string $venue,
        int $consultedDaysAgo,
    ): Project {
        $today = Carbon::today();
        $date = $today->copy()->addDays($inDays)->toDateString();

        $request = ServiceRequest::create([
            'customer_id' => $customer->customer_id,
            'request_type' => ServiceRequest::TYPE_STANDARD,
            'event_type_id' => EventType::query()->where('event_type_name', $eventType)->value('event_type_id'),
            'request_date' => $today->copy()->subDays($consultedDaysAgo + 10)->toDateString(),
            'start_date' => $date,
            'end_date' => $date,
            'event_start_time' => $from,
            'event_end_time' => $to,
            'venue' => $venue,
            'guest_count' => $guests,
            'budget_min' => $budgetMin,
            'budget_max' => $budgetMax,
            'project_description' => "Sample {$eventType} request.",
            'request_status' => ServiceRequest::STATUS_APPROVED,
            'reviewed_at' => $today->copy()->subDays($consultedDaysAgo + 8)->setTime(10, 0),
        ]);

        if ($baseFee = Service::query()->where('service_name', Service::BASE_FEE_NAME)->first()) {
            $request->services()->create([
                'service_id' => $baseFee->service_id,
                'quantity' => 1,
                'unit_price' => $baseFee->price,
                'subtotal' => $baseFee->price,
            ]);
        }

        app(PreliminaryLayouts::class)->saveDefault($request);

        $project = Project::create([
            'service_request_id' => $request->service_request_id,
            'project_manager_id' => $manager->employee_id,
            'current_status_id' => ProjectStatus::idFor(ProjectStatus::CONSULTATION),
            'customer_proceed_decision' => Project::DECISION_PROCEED,
            'ocular_visit_required' => true,
        ]);

        $project->schedules()->createMany([
            [
                'schedule_type' => ProjectSchedule::TYPE_EVENT,
                'start_datetime' => "{$date} {$from}",
                'end_datetime' => "{$date} {$to}",
                'schedule_status' => ProjectSchedule::STATUS_TENTATIVE,
            ],
            [
                'schedule_type' => ProjectSchedule::TYPE_CONSULTATION,
                'start_datetime' => $today->copy()->subDays($consultedDaysAgo)->setTime(10, 0),
                'end_datetime' => $today->copy()->subDays($consultedDaysAgo)->setTime(11, 0),
                'schedule_status' => ProjectSchedule::STATUS_COMPLETED,
                'meeting_mode' => ProjectSchedule::MODE_ONLINE,
            ],
        ]);

        return $project;
    }

    private function employeeFor(Role $role): ?Employee
    {
        $user = User::query()->where('email', $role->value.'@example.com')->first();

        return $user ? Employee::query()->where('user_id', $user->id)->first() : null;
    }
}
