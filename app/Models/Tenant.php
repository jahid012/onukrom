<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string|null $phone
 * @property string|null $address
 * @property string $status active | suspended
 * @property string $plan_key
 * @property CarbonInterface|null $trial_ends_at
 * @property CarbonInterface|null $paid_until
 * @property array<string, mixed>|null $settings
 * @property CarbonInterface|null $created_at
 */
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

    /** Days a new company may use everything before the first invoice is due. */
    public const TRIAL_DAYS = 14;

    protected function casts(): array
    {
        return ['settings' => 'array', 'trial_ends_at' => 'date', 'paid_until' => 'date'];
    }

    /**
     * @return BelongsTo<Plan, $this>
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_key', 'key');
    }

    /**
     * @return HasMany<Invoice, $this>
     */
    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class)->withoutGlobalScope('tenant');
    }

    /** The plan in force (falls back to the cheapest if the key is unknown). */
    public function currentPlan(): Plan
    {
        return $this->plan ?? Plan::forKey($this->plan_key);
    }

    /**
     * suspended (by the platform) | active (paid) | trial | past_due.
     * Worked out from the dates, so nothing has to run on a schedule.
     */
    public function subscriptionStatus(): string
    {
        $today = now()->startOfDay();

        return match (true) {
            $this->status === 'suspended' => 'suspended',
            $this->paid_until !== null && $this->paid_until->gte($today) => 'active',
            $this->trial_ends_at !== null && $this->trial_ends_at->gte($today) => 'trial',
            default => 'past_due',
        };
    }

    /** Until when the company is covered: paid period, else the trial. */
    public function coveredUntil(): ?CarbonInterface
    {
        return $this->paid_until ?? $this->trial_ends_at;
    }

    /** Settings merged with the defaults. */
    public function setting(?string $key = null): mixed
    {
        $all = array_merge(self::DEFAULT_SETTINGS, $this->settings ?? []);

        return $key === null ? $all : ($all[$key] ?? null);
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class)->withoutGlobalScope('tenant');
    }

    /** The company's owner (first active user with the owner role). */
    public function owner(): ?User
    {
        return User::withoutGlobalScope('tenant')
            ->where('tenant_id', $this->id)
            ->whereHas('roles', fn ($q) => $q->withoutGlobalScope('tenant')->where('key', 'owner'))
            ->where('status', '!=', 'inactive')
            ->orderBy('id')
            ->first();
    }
}
