<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Customer;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Runs after ProjectSeeder and before ReservationFeeSeeder (DatabaseSeeder).
 * Dates are relative to today. Skips any account that already has requests.
 */
class SampleCustomersSeeder extends ProjectSeeder
{
    private const ACCOUNTS = [
        'steph.curry@example.com' => ['Steph', 'Curry', '09171110030', 'San Francisco Street, Mandaluyong'],
        'kevin.durant@example.com' => ['Kevin', 'Durant', '09171110035', 'Brooklyn Heights, Quezon City'],
        'lebron.james@example.com' => ['LeBron', 'James', '09171110023', 'Akron Avenue, Makati'],
    ];

    public function run(): void
    {
        $projectManager = $this->employeeFor(Role::ProjectManager);
        $designSpecialist = $this->employeeFor(Role::DesignSpecialist);

        if ($projectManager === null || $designSpecialist === null) {
            return;
        }

        $this->today = Carbon::today();
        $this->projectManager = $projectManager;
        $this->designSpecialist = $designSpecialist;

        DB::transaction(function () {
            foreach (self::ACCOUNTS as $email => [$first, $last, $phone, $address]) {
                $customer = $this->account($email, $first, $last, $phone, $address);

                if ($customer->serviceRequests()->exists()) {
                    continue; // already seeded
                }

                $this->customer = $customer;

                match ($email) {
                    'kevin.durant@example.com' => $this->kevinDurant(),
                    'lebron.james@example.com' => $this->lebronJames(),
                    default => null, // Steph Curry: no requests yet
                };
            }
        });
    }

    /** The login and the customer profile. */
    private function account(string $email, string $first, string $last, string $phone, string $address): Customer
    {
        $user = User::query()->updateOrCreate(
            ['email' => $email],
            [
                'name' => "{$first} {$last}",
                'password' => 'password',
                'email_verified_at' => now(),
                'role' => Role::Customer,
            ],
        );

        return Customer::query()->firstOrCreate(
            ['user_id' => $user->id],
            ['first_name' => $first, 'last_name' => $last, 'contact_number' => $phone, 'address' => $address],
        );
    }

    private function kevinDurant(): void
    {
        // Booked: consultation done, reservation fee paid (ReservationFeeSeeder); the ocular
        // visit is next. The venue is a hotel, so booking it asks for the venue documents.
        $project = $this->project(
            $this->standard('Corporate', 85, '09:00', '17:00', 220, 100000, 250000, 'Shangri-La The Fort Grand Ballroom, Taguig', requestedDaysAgo: 14),
            ProjectStatus::BOOKED,
            decision: Project::DECISION_PROCEED,
            ocular: true,
        );
        $this->schedule($project, ProjectSchedule::TYPE_CONSULTATION, -8, '14:00', '15:00', ProjectSchedule::STATUS_COMPLETED);

        // Waiting for the Project Manager's review (no project yet).
        $this->standard('Birthday', 100, '18:00', '22:00', 60, 50000, 100000, 'Function Hall, Eastwood City, Quezon City', approved: false, requestedDaysAgo: 2);
    }

    private function lebronJames(): void
    {
        // Designing: version 1 sent back for changes, version 2 waiting for the customer (DesignProposalSeeder).
        $project = $this->project(
            $this->standard('Wedding', 120, '15:00', '23:00', 250, 250000, 500000, 'Fernwood Gardens, Quezon City', requestedDaysAgo: 30),
            ProjectStatus::DESIGNING,
            decision: Project::DECISION_PROCEED,
            ocular: false,
            assigned: -12,
        );
        $this->schedule($project, ProjectSchedule::TYPE_CONSULTATION, -18, '15:00', '16:00', ProjectSchedule::STATUS_COMPLETED);

        // Contract: custom project; site assessment done, design approved, contract waiting to be signed.
        $project = $this->project(
            $this->custom('Summer mall center display', 140, 170, 250000, 500000, 'Ayala Malls Manila Bay Atrium, Parañaque'),
            ProjectStatus::CONTRACT,
            decision: Project::DECISION_PROCEED,
            ocular: true,
            assigned: -22,
        );
        $this->schedule($project, ProjectSchedule::TYPE_CONSULTATION, -30, '13:00', '14:00', ProjectSchedule::STATUS_COMPLETED);
        $this->schedule($project, ProjectSchedule::TYPE_OCULAR_VISIT, -26, '13:00', '15:00', ProjectSchedule::STATUS_COMPLETED);

        // Completed last month: contract and bills paid, completion photos (ContractSeeder, ExecutionSeeder).
        $project = $this->project(
            $this->standard('Corporate', -30, '08:00', '17:00', 400, 250000, 500000, 'World Trade Center Metro Manila, Pasay', requestedDaysAgo: 110),
            ProjectStatus::COMPLETED,
            decision: Project::DECISION_PROCEED,
            ocular: false,
            assigned: -85,
            eventStatus: ProjectSchedule::STATUS_COMPLETED,
        );
        $this->schedule($project, ProjectSchedule::TYPE_CONSULTATION, -100, '10:00', '11:00', ProjectSchedule::STATUS_COMPLETED);
        $this->schedule($project, ProjectSchedule::TYPE_FABRICATION, -50, '08:00', '17:00', ProjectSchedule::STATUS_COMPLETED, endDay: -35);
        $this->schedule($project, ProjectSchedule::TYPE_INSTALLATION, -31, '08:00', '18:00', ProjectSchedule::STATUS_COMPLETED);

        // Cancelled: decided not to go ahead after the consultation.
        $project = $this->project(
            $this->standard('Birthday', 40, '17:00', '22:00', 50, 50000, 100000, 'Clubhouse, BGC, Taguig', requestedDaysAgo: 12),
            ProjectStatus::CANCELLED,
            decision: Project::DECISION_CANCELLED,
            ocular: false,
            eventStatus: ProjectSchedule::STATUS_CANCELLED,
        );
        $this->schedule($project, ProjectSchedule::TYPE_CONSULTATION, -7, '16:00', '17:00', ProjectSchedule::STATUS_COMPLETED);
    }
}
