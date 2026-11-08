<?php

namespace App\Http\Controllers\TechnicalAdmin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\LayoutAsset;
use App\Models\Service;
use App\Models\User;
use App\Models\UserRole;
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
        return Inertia::render('technical-admin/dashboard', [
            'stats' => [
                'users' => [
                    'total' => User::count(),
                    'archived' => User::where('account_status', User::STATUS_DISABLED)->count(),
                ],
                'employees' => [
                    'active' => Employee::where('employee_status', Employee::STATUS_ACTIVE)->count(),
                    'archived' => Employee::where('employee_status', Employee::STATUS_INACTIVE)->count(),
                ],
                'services' => [
                    'total' => Service::count(),
                    'active' => Service::where('status', Service::STATUS_ACTIVE)->count(),
                ],
                'assets' => [
                    'total' => LayoutAsset::count(),
                    'active' => LayoutAsset::where('status', 'active')->count(),
                    'categories' => LayoutAsset::distinct()->count('asset_category'),
                ],
            ],
            'accountsByRole' => $this->accountsByRole(),
            'newestAccounts' => $this->newestAccounts(),
        ]);
    }

    /**
     * Every role in the order of the Role enum, including roles with no accounts yet.
     *
     * @return list<array{role: string, count: int}>
     */
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