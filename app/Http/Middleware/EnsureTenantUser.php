<?php

namespace App\Http\Middleware;

use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Company pages: only a company's own users. Platform staff go to their own
 * panel (they reach a company only by impersonating its owner). A company
 * suspended by the platform keeps billing and support so it can pay.
 */
class EnsureTenantUser
{
    /** Pages a suspended company can still open. */
    private const WHILE_SUSPENDED = ['billing.*', 'support.*', 'admin.state'];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->isPlatform()) {
            return redirect()->route('platform.dashboard');
        }

        abort_if($user === null || $user->tenant_id === null, 403);

        if (TenantContext::get()?->status === 'suspended' && ! $request->routeIs(...self::WHILE_SUSPENDED)) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'This company is suspended. Open Billing to pay or Support for help.'], 403);
            }

            return redirect()->route('billing.index');
        }

        return $next($request);
    }
}
