<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Admin panel: the logged-in user's company is the current tenant. */
class TenantFromUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $tenantId = $request->user()?->tenant_id;

        if ($tenantId !== null) {
            TenantContext::set(Tenant::find($tenantId));
        }

        try {
            return $next($request);
        } finally {
            TenantContext::set(null);
        }
    }
}
