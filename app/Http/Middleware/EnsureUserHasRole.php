<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Allow the request only if the logged-in user has one of the given roles.
     * Usage in routes: ->middleware('role:technical_admin') or 'role:project_manager,owner'
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        // Role::from() throws on a typo in a route definition, so mistakes are caught early
        $allowed = array_map(fn (string $role) => Role::from($role), $roles);

        $userRole = $user?->role instanceof Role
            ? $user->role
            : Role::tryFrom((string) $user?->role);

        abort_unless($userRole !== null && in_array($userRole, $allowed, true), 403);

        return $next($request);
    }
}
