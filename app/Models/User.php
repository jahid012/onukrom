<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Owner / manager (admin panel) or field staff (SR / DM, mobile app).
 *
 * @property int $id
 * @property int|null $tenant_id
 * @property string $name
 * @property string|null $phone
 * @property string|null $employee_code
 * @property string $status
 * @property string|null $email
 * @property Carbon|null $last_seen_at
 */
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use BelongsToTenant, HasApiTokens, HasFactory, Notifiable, TwoFactorAuthenticatable;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'password_changed_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    /** Routes (areas of type "route") this person covers. */
    public function routes(): BelongsToMany
    {
        return $this->belongsToMany(Area::class, 'area_user');
    }

    public function devices(): HasMany
    {
        return $this->hasMany(Device::class);
    }

    /** @return list<string> */
    public function roleKeys(): array
    {
        return $this->roles->pluck('key')->all();
    }

    /** @return list<string> */
    public function permissions(): array
    {
        return $this->roles->flatMap(fn (Role $r) => $r->permissions)->unique()->values()->all();
    }

    public function hasPermission(string $permission): bool
    {
        return in_array($permission, $this->permissions(), true);
    }

    /** The mobile app is only for SR and DM (spec §5). */
    public function canUseApp(): bool
    {
        return $this->hasPermission('app.sales') || $this->hasPermission('app.delivery');
    }
}
