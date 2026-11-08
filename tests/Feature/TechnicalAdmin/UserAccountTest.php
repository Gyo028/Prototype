<?php

use App\Enums\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->withoutVite();
    $this->admin = User::factory()->create(['role' => Role::TechnicalAdmin]);
});

function validAccount(array $overrides = []): array
{
    return array_merge([
        'name' => 'Ana Reyes',
        'email' => 'ana@email.com',
        'role' => 'project_manager',
    ], $overrides);
}

test('only the Technical Admin can open or use the user accounts screen', function (Role $role) {
    $user = User::factory()->create(['role' => $role]);

    $this->actingAs($user)->get(route('technical-admin.users'))->assertForbidden();
    $this->actingAs($user)->post(route('technical-admin.users.store'), validAccount())->assertForbidden();
})->with([Role::Customer, Role::ProjectManager, Role::Owner]);

test('the list shows staff accounts but never customers or technical admins', function () {
    User::factory()->create(['role' => Role::ProjectManager, 'name' => 'Pat Manager']);
    User::factory()->create(['role' => Role::Bookkeeper, 'name' => 'Beth Books']);
    User::factory()->create(['role' => Role::Customer, 'name' => 'Juan Customer']);

    $this->actingAs($this->admin)
        ->get(route('technical-admin.users'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('technical-admin/users')
            ->has('users', 2)
            ->has('roles', 4)
            ->where('users.0.status', 'Active')
        );
});

test('creating an account makes an active, verified staff account with a one-time temporary password', function () {
    $response = $this->actingAs($this->admin)
        ->post(route('technical-admin.users.store'), validAccount());

    $response->assertRedirect(route('technical-admin.users'));

    $user = User::where('email', 'ana@email.com')->firstOrFail();
    $password = session('new_account.password');

    expect($user->role)->toBe(Role::ProjectManager)
        ->and($user->isActive())->toBeTrue()
        ->and($user->email_verified_at)->not->toBeNull()
        ->and($password)->toBeString()->toHaveLength(12)
        ->and(Hash::check($password, $user->password))->toBeTrue();

    // The password is not kept anywhere: the next request no longer has it.
    $this->get(route('technical-admin.users'))->assertInertia(fn (Assert $page) => $page
        ->where('newAccount.email', 'ana@email.com')
    );
    $this->get(route('technical-admin.users'))->assertInertia(fn (Assert $page) => $page
        ->where('newAccount', null)
    );
});

test('a duplicate email shows "Email already registered"', function () {
    User::factory()->create(['email' => 'ana@email.com']);

    $this->actingAs($this->admin)
        ->post(route('technical-admin.users.store'), validAccount(['email' => 'ANA@email.com']))
        ->assertSessionHasErrors(['email' => 'Email already registered']);

    expect(User::where('email', 'ana@email.com')->count())->toBe(1);
});

test('incomplete account information is not saved', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.users.store'), ['name' => '', 'email' => '', 'role' => ''])
        ->assertSessionHasErrors(['name', 'email', 'role']);

    expect(User::count())->toBe(1); // only the admin
});

test('customer and technical admin roles cannot be assigned', function (string $role) {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.users.store'), validAccount(['role' => $role]))
        ->assertSessionHasErrors('role');

    expect(User::where('email', 'ana@email.com')->exists())->toBeFalse();
})->with(['customer', 'technical_admin']);

test('a staff account can be updated', function () {
    $staff = User::factory()->create(['role' => Role::ProjectManager]);

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.users.update', $staff), validAccount([
            'name' => 'Ana Santos',
            'email' => 'ana.santos@email.com',
            'role' => 'bookkeeper',
        ]))
        ->assertRedirect(route('technical-admin.users'));

    $staff->refresh();

    expect($staff->name)->toBe('Ana Santos')
        ->and($staff->email)->toBe('ana.santos@email.com')
        ->and($staff->role)->toBe(Role::Bookkeeper);
});

test('updating keeps the account\'s own email without a duplicate error', function () {
    $staff = User::factory()->create(['role' => Role::Owner, 'email' => 'owner@email.com']);

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.users.update', $staff), validAccount([
            'name' => 'New Name',
            'email' => 'owner@email.com',
            'role' => 'owner',
        ]))
        ->assertSessionHasNoErrors();
});

test('archiving blocks the account and ends its sessions, and restoring brings it back', function () {
    $staff = User::factory()->create(['role' => Role::DesignSpecialist]);

    DB::table('sessions')->insert([
        'id' => 'staff-session',
        'user_id' => $staff->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'test',
        'payload' => 'x',
        'last_activity' => time(),
    ]);

    $this->actingAs($this->admin)->patch(route('technical-admin.users.archive', $staff))
        ->assertRedirect(route('technical-admin.users'));

    expect($staff->fresh()->isActive())->toBeFalse();
    $this->assertDatabaseMissing('sessions', ['id' => 'staff-session']);

    $this->actingAs($this->admin)->patch(route('technical-admin.users.restore', $staff))
        ->assertRedirect(route('technical-admin.users'));

    expect($staff->fresh()->isActive())->toBeTrue();
});

test('customer and technical admin accounts cannot be changed from this screen', function (Role $role) {
    $other = User::factory()->create(['role' => $role]);

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.users.update', $other), validAccount())
        ->assertNotFound();
    $this->actingAs($this->admin)->patch(route('technical-admin.users.archive', $other))->assertNotFound();
    $this->actingAs($this->admin)->patch(route('technical-admin.users.restore', $other))->assertNotFound();

    expect($other->fresh()->isActive())->toBeTrue();
})->with([Role::Customer, Role::TechnicalAdmin]);