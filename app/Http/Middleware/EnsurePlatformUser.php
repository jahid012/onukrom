<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Onukrom's own panel. `platform` lets in super admins and support staff;
 * `platform:super_admin` is for money, plans, the team and settings.
 */
class EnsurePlatformUser
{
    public function handle(Request $request, Closure $next, ?string $role = null): Response
    {
        $user = $request->user();

        abort_unless($user?->isPlatform() === true, 403);
        abort_if($role === 'super_admin' && ! $user->isSuperAdmin(), 403);

        return $next($request);
    }
}
