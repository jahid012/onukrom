<?php

namespace App\Support\Tenancy;

use App\Models\Tenant;

/**
 * The company (tenant) the current request or job works for.
 * Set by ResolveTenant (API) / the authenticated user (admin panel).
 */
class TenantContext
{
    private static ?Tenant $tenant = null;

    public static function set(?Tenant $tenant): void
    {
        self::$tenant = $tenant;
    }

    public static function get(): ?Tenant
    {
        return self::$tenant;
    }

    public static function id(): ?int
    {
        return self::$tenant?->id;
    }

    /** Run a callback for one tenant and restore the previous context. */
    public static function run(Tenant $tenant, callable $callback): mixed
    {
        $previous = self::$tenant;
        self::$tenant = $tenant;

        try {
            return $callback();
        } finally {
            self::$tenant = $previous;
        }
    }
}
