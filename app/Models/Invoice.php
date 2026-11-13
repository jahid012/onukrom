<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One month of a company's subscription. The owner pays by bKash / Nagad /
 * bank and submits the transaction id; the platform confirms it.
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $number
 * @property string $plan_key
 * @property CarbonInterface $period_start
 * @property CarbonInterface $period_end
 * @property int $amount paisa
 * @property string $status unpaid | submitted | paid | void
 * @property CarbonInterface $due_at
 * @property string|null $payment_method
 * @property string|null $payment_reference
 * @property CarbonInterface|null $submitted_at
 * @property CarbonInterface|null $paid_at
 * @property string|null $note
 */
class Invoice extends Model
{
    use BelongsToTenant;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'due_at' => 'date',
            'submitted_at' => 'datetime',
            'paid_at' => 'datetime',
            'amount' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Plan, $this>
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_key', 'key');
    }

    /** @return array<string, mixed> */
    public function present(): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'plan' => $this->plan_key,
            'periodStart' => $this->period_start->toDateString(),
            'periodEnd' => $this->period_end->toDateString(),
            'amount' => $this->amount / 100,
            'status' => $this->status,
            'dueAt' => $this->due_at->toDateString(),
            'method' => $this->payment_method,
            'reference' => $this->payment_reference,
            'submittedAt' => $this->submitted_at?->toIso8601String(),
            'paidAt' => $this->paid_at?->toIso8601String(),
            'note' => $this->note,
        ];
    }
}
