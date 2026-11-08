<?php

use App\Enums\Role;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\LayoutAsset;
use App\Models\Service;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->withoutVite();
    $this->admin = User::factory()->create(['role' => Role::TechnicalAdmin]);
});

function dashboardEmployee(string $first, string $status): Employee
{
    return Employee::create([
        'position_id' => EmployeePosition::value('position_id'),
        'first_name' => $first,
        'last_name' => 'Test',
        'contact_number' => '0917'.random_int(1000000, 9999999),
        'email' => strtolower($first).'@example.com',
        'employee_status' => $status,
    ]);
}

test('only the Technical Admin can open the dashboard', function (Role $role) {
    $user = User::factory()->create(['role' => $role]);

    $this->actingAs($user)->get(route('technical-admin.dashboard'))->assertForbidden();
})->with([Role::Customer, Role::ProjectManager, Role::Owner]);

test('guests are sent to the login page', function () {
    $this->get(route('technical-admin.dashboard'))->assertRedirect(route('login'));
});

test('the summary cards show the real counts', function () {
    User::factory()->count(2)->create(['role' => Role::Customer]);
    $archived = User::factory()->create(['role' => Role::Bookkeeper]);
    $archived->forceFill(['account_status' => User::STATUS_DISABLED])->save();

    dashboardEmployee('Ana', Employee::STATUS_ACTIVE);
    dashboardEmployee('Ben', Employee::STATUS_ACTIVE);
    dashboardEmployee('Cora', Employee::STATUS_INACTIVE);

    Service::create(['service_name' => 'DJ Services', 'service_category' => 'Entertainment', 'price' => 15000, 'status' => 'active']);
    Service::create(['service_name' => 'Photobooth', 'service_category' => 'Entertainment', 'price' => 8000, 'status' => 'inactive']);

    LayoutAsset::create(['asset_name' => 'Rattan Chair', 'asset_category' => 'Furniture', 'status' => 'active']);
    LayoutAsset::create(['asset_name' => 'Round Table', 'asset_category' => 'Furniture', 'status' => 'active']);
    LayoutAsset::create(['asset_name' => 'Fairy Lights', 'asset_category' => 'Lighting', 'status' => 'inactive']);

    $this->actingAs($this->admin)
        ->get(route('technical-admin.dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('technical-admin/dashboard')
            ->where('stats.users.total', 4)          // admin + 2 customers + bookkeeper
            ->where('stats.users.archived', 1)
            ->where('stats.employees.active', 2)
            ->where('stats.employees.archived', 1)
            ->where('stats.services.total', 2)
            ->where('stats.services.active', 1)
            ->where('stats.assets.total', 3)
            ->where('stats.assets.active', 2)
            ->where('stats.assets.categories', 2)
        );
});

test('accounts are counted per role, including roles with no accounts', function () {
    User::factory()->count(3)->create(['role' => Role::Customer]);
    User::factory()->create(['role' => Role::ProjectManager]);

    $this->actingAs($this->admin)
        ->get(route('technical-admin.dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('accountsByRole', count(Role::cases()))
            ->where('accountsByRole', fn ($rows) => collect($rows)->pluck('count', 'role')->all() === [
                'Customer' => 3,
                'Project Manager' => 1,
                'Design Specialist' => 0,
                'Bookkeeper' => 0,
                'Owner' => 0,
                'Technical Admin' => 1,
            ])
        );
});

test('the newest accounts come first, limited to five, with their status', function () {
    $this->travel(-1)->days();
    User::factory()->count(4)->create(['role' => Role::Customer]);
    $this->travelBack();

    $unverified = User::factory()->unverified()->create(['role' => Role::Customer, 'name' => 'Newest Customer']);
    $archived = User::factory()->create(['role' => Role::DesignSpecialist, 'name' => 'Archived Designer']);
    $archived->forceFill(['account_status' => User::STATUS_DISABLED])->save();

    $this->actingAs($this->admin)
        ->get(route('technical-admin.dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('newestAccounts', 5)
            ->where('newestAccounts.0.name', 'Archived Designer')
            ->where('newestAccounts.0.role', 'Design Specialist')
            ->where('newestAccounts.0.status', 'Archived')
            ->where('newestAccounts.1.name', 'Newest Customer')
            ->where('newestAccounts.1.status', 'Unverified')
            ->where('newestAccounts.2.status', 'Active')
        );
});