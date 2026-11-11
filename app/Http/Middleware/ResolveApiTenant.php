<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Support\ApiError;
use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Mobile API tenant resolution (spec §3.3):
 * - logged in: the token's user decides the tenant; an X-Tenant header that
 *   doesn't match is refused (stale app after a company change);
 * - not logged in (lookup, login): the X-Tenant header (company code).
 */
class ResolveApiTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('sanctum');
        $code = strtolower(trim((string) $request->header('X-Tenant')));

        if ($user) {
            $tenant = Tenant::find($user->tenant_id);

            if (! $tenant || ($code !== '' && $code !== $tenant->code)) {
                return ApiError::response('UNAUTHENTICATED', 'Please log in again.', 401);
            }
        } else {
            $tenant = $code !== '' ? Tenant::where('code', $code)->first() : null;

            if (! $tenant) {
                return ApiError::response('TENANT_NOT_FOUND', 'Company code not found.', 404);
            }
        }

        if ($tenant->status === 'suspended') {
            return ApiError::response('TENANT_SUSPENDED', 'This company is suspended.', 403);
        }

        TenantContext::set($tenant);

        try {
            return $next($request);
        } finally {
            TenantContext::set(null);
        }
    }
}
