<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One online payment attempt for an invoice (platform-level: read by the
 * gateway callback / IPN without a company context).
 *
 * @property int $id
 * @property int $invoice_id
 * @property int $tenant_id
 * @property int|null $user_id
 * @property string $gateway
 * @property string $gateway_invoice
 * @property int $amount paisa
 * @property string $status initiated | processing | success | failed
 * @property string|null $trx_id
 * @property string|null $method
 * @property string|null $payer
 * @property array<string, mixed>|null $raw
 */
class Payment extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['raw' => 'array', 'amount' => 'integer'];
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class)->withoutGlobalScope('tenant');
    }
}
