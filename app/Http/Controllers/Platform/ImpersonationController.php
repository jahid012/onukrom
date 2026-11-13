<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

/**
 * Platform staff see a company exactly as its owner does, to help or check.
 * Every start and stop is logged; a banner in the panel shows who is really
 * signed in and brings them back with one click.
 */
class ImpersonationController extends Controller
{
    public function start(Request $request, Tenant $tenant): RedirectResponse
    {
        /** @var User $staff */
        $staff = $request->user();
        $owner = $tenant->owner();

        if ($owner === null) {
            return back()->with('error', 'This company has no active owner to sign in as.');
        }

        Log::info('Impersonation started', ['by' => $staff->id, 'by_email' => $staff->email, 'tenant' => $tenant->id, 'as' => $owner->id]);

        Auth::login($owner);
        $request->session()->regenerate();
        $request->session()->put([
            'impersonator_id' => $staff->id,
            'impersonator_name' => $staff->name.' · '.$tenant->name,
            'impersonated_tenant' => $tenant->id,
        ]);

        return redirect()->route('dashboard');
    }

    public function stop(Request $request): RedirectResponse
    {
        $staffId = $request->session()->pull('impersonator_id');
        $tenantId = $request->session()->pull('impersonated_tenant');
        $request->session()->forget('impersonator_name');

        $staff = $staffId ? User::withoutGlobalScope('tenant')->whereKey($staffId)->first() : null;
        abort_if($staff === null || ! $staff->isPlatform(), 403);

        Log::info('Impersonation stopped', ['by' => $staff->id, 'tenant' => $tenantId]);

        Auth::login($staff);
        $request->session()->regenerate();

        return $tenantId
            ? redirect()->route('platform.companies.show', $tenantId)
            : redirect()->route('platform.dashboard');
    }
}
