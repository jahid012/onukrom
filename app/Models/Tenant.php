<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tenant extends Model
{
    protected $guarded = [];

    /** Defaults for company settings (spec §11.2 / §10.5). */
    public const DEFAULT_SETTINGS = [
        'autoApprove' => false,
        'creditMode' => 'warn',
        'maxDiscount' => 5,
        'priceWindow' => 48,
        'blockOverStock' => true,
        'locationMode' => 'required',
        'maxAccuracy' => 50,
        'maxAge' => 60,
        'wait' => 20,
        'geofence' => 150,
        'blockMock' => false,
        'shopFromOrder' => true,
        'requireStartDay' => false,
        'dutyTracking' => false,
        'dutyInterval' => 300,
        'oneDevice' => true,
        'proof' => 'none',
    ];

    protected function casts(): array
    {
        return ['settings' => 'array'];
    }

    /** Settings merged with the defaults. */
    public function setting(?string $key = null): mixed
    {
        $all = array_merge(self::DEFAULT_SETTINGS, $this->settings ?? []);

        return $key === null ? $all : ($all[$key] ?? null);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
