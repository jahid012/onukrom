<?php

namespace App\Models\Concerns;

use App\Models\Tenant;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Tenant isolation: every query is filtered by the current tenant and new
 * records get its id automatically (spec §3.1).
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope('tenant', function (Builder $query): void {
            if (TenantContext::id() !== null) {
                $query->where($query->getModel()->getTable().'.tenant_id', TenantContext::id());
            }
        });

        static::creating(function ($model): void {
            if (empty($model->tenant_id) && TenantContext::id() !== null) {
                $model->tenant_id = TenantContext::id();
            }
        });
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
