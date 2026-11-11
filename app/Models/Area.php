<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Area extends Model
{
    use BelongsToTenant, HasUlids, SoftDeletes;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'visit_days' => 'array',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Area::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Area::class, 'parent_id');
    }

    public function salesRep(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sr_id');
    }

    public function deliveryMan(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dm_id');
    }

    public function shops(): HasMany
    {
        return $this->hasMany(Shop::class, 'route_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'area_user');
    }
}
