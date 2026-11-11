<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Trip extends Model
{
    use BelongsToTenant, HasUlids;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'closed_at' => 'datetime',
        ];
    }

    public function deliveryMan(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delivery_user_id');
    }

    public function route(): BelongsTo
    {
        return $this->belongsTo(Area::class, 'route_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
