<?php

namespace App\Http\Controllers\TechnicalAdmin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\TechnicalAdmin\UserAccountRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Technical Admin > User Accounts.
 *
 * The Technical Admin manages the staff accounts only. Customer accounts
 * (who register on their own) and Technical Admin accounts are not listed and
 * cannot be created, changed or archived here. Accounts are never deleted:
 * "delete" means archive (account_status = disabled), which can be restored.
 */

class UserAccountController extends Controller
{
    /** The roles this screen is allowed to manage. */
    public const MANAGED_ROLES = [
        Role::ProjectManager,
        Role::DesignSpecialist,
        Role::Bookkeeper,
        Role::Owner,
    ];

    public function index(Request $request): Response
    {
        $users = User::query()
            ->whereHas('userRole', fn ($q) => $q->whereIn('name', self::managedRoleKeys()))
            ->latest()
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->label(),
                'roleKey' => $user->role->value,
                'status' => $user->isActive() ? 'Active' : 'Archived',
                'added' => $user->created_at?->format('M j'),
            ]);

        return Inertia::render('technical-admin/users', [
            'users' => $users,
            'roles' => collect(self::MANAGED_ROLES)
                ->map(fn (Role $role) => ['value' => $role->value, 'label' => $role->label()])
                ->values(),
            // Set once right after an account is created, then gone on the next request.
            'newAccount' => $request->session()->get('new_account'),
        ]);
    }

    public function store(UserAccountRequest $request): RedirectResponse
    {
        // Temporary password: shown to the admin once, until the set-password email is available.
        $password = Str::password(12, symbols: false);

        $user = new User([
            'name' => $request->validated('name'),
            'email' => $request->validated('email'),
            'password' => $password,
        ]);
        $user->role = Role::from($request->validated('role'));
        $user->email_verified_at = now(); // staff accounts are created by the admin, so no verification step
        $user->account_status = User::STATUS_ACTIVE;
        $user->save();

        return to_route('technical-admin.users')->with('new_account', [
            'name' => $user->name,
            'email' => $user->email,
            'password' => $password,
        ]);
    }

    public function update(UserAccountRequest $request, User $user): RedirectResponse
    {
        $this->ensureManaged($user);

        $user->fill([
            'name' => $request->validated('name'),
            'email' => $request->validated('email'),
        ]);
        $user->role = Role::from($request->validated('role'));
        $user->save();

        return to_route('technical-admin.users');
    }

    public function archive(User $user): RedirectResponse
    {
        $this->ensureManaged($user);

        $user->forceFill([
            'account_status' => User::STATUS_DISABLED,
            'remember_token' => null,
        ])->save();

        // Log the person out everywhere right away, not only at their next login.
        DB::table('sessions')->where('user_id', $user->id)->delete();

        return to_route('technical-admin.users');
    }

    public function restore(User $user): RedirectResponse
    {
        $this->ensureManaged($user);

        $user->forceFill(['account_status' => User::STATUS_ACTIVE])->save();

        return to_route('technical-admin.users');
    }

    /** Customers and Technical Admins don't exist as far as this screen is concerned. */
    private function ensureManaged(User $user): void
    {
        abort_unless(in_array($user->role, self::MANAGED_ROLES, true), 404);
    }

    /** @return list<string> */
    public static function managedRoleKeys(): array
    {
        return array_map(fn (Role $role) => $role->value, self::MANAGED_ROLES);
    }
}