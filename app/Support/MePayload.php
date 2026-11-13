<?php

namespace App\Support;

use App\Models\User;
use App\Support\Tenancy\TenantContext;

/** The "me" payload sent at login and on every sync (spec Appendix A.2). */
class MePayload
{
    /** @return array<string, mixed> */
    public static function for(User $user): array
    {
        $tenant = TenantContext::get() ?? $user->tenant;
        $user->loadMissing('roles', 'routes');

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'phone' => $user->phone,
                'employee_code' => $user->employee_code,
            ],
            'tenant' => [
                'code' => $tenant->code,
                'name' => $tenant->name,
                'phone' => $tenant->phone,
                'address' => $tenant->address,
            ],
            'roles' => $user->roleKeys(),
            'permissions' => $user->permissions(),
            'route_ids' => $user->routes->pluck('id')->values(),
            'settings' => $tenant->setting(),
            'server_time' => now()->toIso8601ZuluString('millisecond'),
        ];
    }
}
