<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A subscription plan (platform-wide, not per company). Prices in paisa.
 *
 * @property int $id
 * @property string $key
 * @property string $name
 * @property string|null $name_bn
 * @property int $price
 * @property int $staff_limit
 * @property int $sms_limit
 * @property string|null $description
 * @property bool $is_active
 * @property int $sort
 */
class Plan extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'price' => 'integer', 'staff_limit' => 'integer', 'sms_limit' => 'integer'];
    }

    public static function forKey(?string $key): self
    {
        return self::where('key', $key)->first()
            ?? self::orderBy('sort')->first()
            ?? new self(['key' => 'starter', 'name' => 'Starter', 'price' => 0, 'staff_limit' => 10, 'sms_limit' => 300]);
    }
}
