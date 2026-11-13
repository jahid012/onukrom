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

    /**
     * @return BelongsTo<Area, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Area::class, 'parent_id');
    }

    /**
     * @return HasMany<Area, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(Area::class, 'parent_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function salesRep(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sr_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function deliveryMan(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dm_id');
    }

    /**
     * @return HasMany<Shop, $this>
     */
    public function shops(): HasMany
    {
        return $this->hasMany(Shop::class, 'route_id');
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'area_user');
    }
}
