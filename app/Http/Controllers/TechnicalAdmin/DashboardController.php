<?php

namespace App\Http\Controllers\TechnicalAdmin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\LayoutAsset;
use App\Models\Service;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Technical Admin > Dashboard.
 *
 * A read-only overview of what the Technical Admin manages: user accounts
 * (all roles, customers included), employee records, services and layout assets.
 */
class DashboardController extends Controller
{
    private const NEWEST_ACCOUNTS = 5;

    public function index(): Response
    {
        // One query per table: each counts its total and its subsets together.
        $users = $this->counts(User::query(), ['archived' => ['account_status', User::STATUS_DISABLED]]);
        $employees = $this->counts(Employee::query(), [
            'active' => ['employee_status', Employee::STATUS_ACTIVE],
            'archived' => ['employee_status', Employee::STATUS_INACTIVE],
        ]);
        $services = $this->counts(Service::query(), ['active' => ['status', Service::STATUS_ACTIVE]]);
        $assets = $this->counts(LayoutAsset::query(), ['active' => ['status', 'active']], 'count(distinct asset_category) as categories');

        return Inertia::render('technical-admin/dashboard', [
            'stats' => [
                'users' => [
                    'total' => $users['total'],
                    'archived' => $users['archived'],
                ],
                'employees' => [
                    'active' => $employees['active'],
                    'archived' => $employees['archived'],
                ],
                'services' => [
                    'total' => $services['total'],
                    'active' => $services['active'],
                ],
                'assets' => [
                    'total' => $assets['total'],
                    'active' => $assets['active'],
                    'categories' => $assets['categories'],
                ],
            ],
            'accountsByRole' => $this->accountsByRole(),
            'newestAccounts' => $this->newestAccounts(),
        ]);
    }

    /**
     * A table's total plus how many rows match each [column, value], in one query.
     *
     * @param  array<string, array{0: string, 1: string}>  $subsets
     * @return array<string, int>
     */
    private function counts(Builder $query, array $subsets, ?string $extra = null): array
    {
        $select = ['count(*) as total'];
        $bindings = [];

        foreach ($subsets as $name => [$column, $value]) {
            $select[] = "sum(case when {$column} = ? then 1 else 0 end) as {$name}";
            $bindings[] = $value;
        }

        if ($extra !== null) {
            $select[] = $extra;
        }

        $row = (array) $query->toBase()->selectRaw(implode(', ', $select), $bindings)->first();

        return array_map(fn ($count) => (int) $count, $row);
    }

    private function accountsByRole(): array
    {
        $counts = UserRole::withCount('users')->pluck('users_count', 'name');

        return array_map(fn (Role $role) => [
            'role' => $role->label(),
            'count' => (int) ($counts[$role->value] ?? 0),
        ], Role::cases());
    }

    /** @return list<array<string, mixed>> */
    private function newestAccounts(): array
    {
        return User::query()
            ->with('userRole')
            ->latest()
            ->orderByDesc('id')
            ->limit(self::NEWEST_ACCOUNTS)
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role->label(),
                'added' => $user->created_at?->diffForHumans(),
                'status' => match (true) {
                    ! $user->isActive() => 'Archived',
                    $user->email_verified_at === null => 'Unverified',
                    default => 'Active',
                },
            ])
            ->values()
            ->all();
    }
}