<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Warehouse extends Model
{
    use BelongsToTenant, HasUlids;

    protected $guarded = ['id'];

    public function levels(): HasMany
    {
        return $this->hasMany(StockLevel::class);
    }
}
