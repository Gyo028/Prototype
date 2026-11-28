<?php

use App\Enums\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;

test('reading the role does not query the roles table again when the user is sent to a page', function () {
    $user = User::factory()->create(['role' => Role::TechnicalAdmin])->fresh();

    expect($user->role)->toBe(Role::TechnicalAdmin);

    DB::enableQueryLog();
    $user->toArray(); // what Inertia does with auth.user
    $user->getAttributes();
    expect(DB::getQueryLog())->toBe([]);
});

test('setting the role still changes role_id', function () {
    $user = User::factory()->create(['role' => Role::ProjectManager]);

    $user->role = Role::Bookkeeper;
    $user->save();

    expect($user->fresh()->role)->toBe(Role::Bookkeeper);
});
