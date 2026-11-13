<?php

namespace App\Support\Billing;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Meta\MetaConversions;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use RuntimeException;

/**
 * Monthly subscriptions:
 *
 *   1. An invoice appears 7 days before the trial or paid month ends.
 *   2a. Online: the owner pays on PayStation's checkout; we confirm it with
 *       PayStation server-to-server → "paid" at once.
 *   2b. By hand: the owner pays bKash / Nagad / bank and submits the
 *       transaction id → "submitted"; the platform checks it → "paid".
 *   3. Paid → the company is covered a month more.
 *
 * Nothing runs on a schedule: invoices are created when the billing pages
 * are opened, and the subscription status is worked out from the dates.
 */
class Billing
{
    public const PAYMENT_METHODS = ['bkash', 'nagad', 'rocket', 'bank'];

    /** How many days before the period ends the next invoice is issued. */
    public const ISSUE_DAYS_BEFORE = 7;

    /** The open (unpaid or submitted) invoice, creating it when it is due. */
    public static function ensureInvoice(Tenant $tenant): ?Invoice
    {
        $open = $tenant->invoices()->whereIn('status', ['unpaid', 'submitted'])->latest('id')->first();

        if ($open) {
            return $open;
        }

        $covered = $tenant->coveredUntil();
        $today = now()->startOfDay();

        if ($covered !== null && $covered->copy()->subDays(self::ISSUE_DAYS_BEFORE)->gt($today)) {
            return null; // not due yet
        }

        $start = $covered !== null && $covered->gte($today) ? $covered->copy()->addDay() : $today;

        return self::issue($tenant, $start);
    }

    /** A new month's invoice from $start at the company's current plan price. */
    public static function issue(Tenant $tenant, CarbonInterface $start): Invoice
    {
        $plan = $tenant->currentPlan();

        return DB::transaction(fn () => Invoice::withoutGlobalScope('tenant')->create([
            'tenant_id' => $tenant->id,
            'number' => self::nextNumber(),
            'plan_key' => $plan->key,
            'period_start' => $start->toDateString(),
            'period_end' => $start->copy()->addMonthNoOverflow()->subDay()->toDateString(),
            'amount' => $plan->price,
            'status' => 'unpaid',
            'due_at' => $start->toDateString(),
        ]));
    }

    private static function nextNumber(): string
    {
        $seq = Invoice::withoutGlobalScopes()->max('id') + 1;

        return 'INV-'.now()->format('Ym').'-'.str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
    }

    /** Owner switches plan: unpaid invoices at the old price are replaced. */
    public static function changePlan(Tenant $tenant, Plan $plan): void
    {
        if (! $plan->is_active) {
            throw new InvalidArgumentException('This plan is not available.');
        }

        DB::transaction(function () use ($tenant, $plan): void {
            $tenant->update(['plan_key' => $plan->key]);
            $tenant->invoices()->where('status', 'unpaid')->update(['status' => 'void', 'note' => 'Plan changed to '.$plan->name]);
        });

        self::ensureInvoice($tenant->fresh() ?? $tenant);
    }

    public static function submitPayment(Invoice $invoice, string $method, string $reference, User $by): void
    {
        if (! in_array($invoice->status, ['unpaid', 'submitted'], true)) {
            throw new InvalidArgumentException('This invoice is not waiting for payment.');
        }

        $invoice->update([
            'status' => 'submitted',
            'payment_method' => $method,
            'payment_reference' => trim($reference),
            'submitted_at' => now(),
            'submitted_by' => $by->id,
            'note' => null,
        ]);
    }

    /**
     * The money arrived: the company is covered until the invoice's period end.
     * $by is the platform user who checked it by hand; null when PayStation
     * confirmed it (then method / reference come from the gateway).
     */
    public static function confirm(Invoice $invoice, ?User $by, ?string $method = null, ?string $reference = null): void
    {
        DB::transaction(function () use ($invoice, $by, $method, $reference): void {
            // A manual confirm keeps the method / id the owner submitted.
            $invoice->update([
                'status' => 'paid',
                'paid_at' => now(),
                'confirmed_by' => $by?->id,
                'note' => null,
                ...array_filter(['payment_method' => $method, 'payment_reference' => $reference]),
            ]);
            $tenant = Tenant::findOrFail($invoice->tenant_id);
            $until = $tenant->paid_until !== null && $tenant->paid_until->gt($invoice->period_end) ? $tenant->paid_until : $invoice->period_end;
            $tenant->update(['paid_until' => $until->toDateString(), 'status' => 'active']);
        });

        // The real conversion for ads: a company paid. Server-only event.
        $owner = Tenant::findOrFail($invoice->tenant_id)->owner();
        MetaConversions::sendSystem('Subscribe', 'subscribe.invoice-'.$invoice->id, [
            'email' => $owner?->email,
            'phone' => $owner?->phone,
            'name' => $owner?->name,
            'external_id' => 'tenant-'.$invoice->tenant_id,
        ], ['value' => $invoice->amount / 100, 'currency' => 'BDT', 'predicted_ltv' => ($invoice->amount / 100) * 12, 'content_name' => $invoice->plan_key]);
    }

    /* ------------------------------------------------------------------ */
    /* Online payment (PayStation) */
    /* ------------------------------------------------------------------ */

    /** Start a hosted checkout for an open invoice; returns the URL to send the owner to. */
    public static function startOnline(Invoice $invoice, User $owner): string
    {
        if (! in_array($invoice->status, ['unpaid', 'submitted'], true)) {
            throw new InvalidArgumentException('This invoice is not waiting for payment.');
        }

        $tenant = Tenant::findOrFail($invoice->tenant_id);
        $phone = $owner->phone ?: $tenant->phone;

        if (blank($phone) || blank($owner->email)) {
            throw new InvalidArgumentException('Add the company phone under Settings first — the payment page needs a contact number.');
        }

        // A fresh gateway number per attempt: PayStation refuses one it has seen.
        $attempt = Payment::where('invoice_id', $invoice->id)->count() + 1;
        $payment = Payment::create([
            'invoice_id' => $invoice->id,
            'tenant_id' => $invoice->tenant_id,
            'user_id' => $owner->id,
            'gateway' => 'paystation',
            'gateway_invoice' => $invoice->number.'-P'.$attempt,
            'amount' => $invoice->amount,
            'status' => 'initiated',
        ]);

        try {
            return PayStation::initiate([
                'invoice_number' => $payment->gateway_invoice,
                'amount_taka' => (int) ceil($invoice->amount / 100),
                'name' => $owner->name,
                'phone' => (string) $phone,
                'email' => (string) $owner->email,
                'address' => $tenant->address,
                'callback_url' => route('billing.paystation.return', $payment),
                'reference' => $invoice->number,
                'items' => 'Onukrom '.$invoice->plan_key.' plan, '.$invoice->period_start->toDateString().' to '.$invoice->period_end->toDateString(),
            ]);
        } catch (RuntimeException $e) {
            $payment->update(['status' => 'failed']);

            throw $e;
        }
    }

    /**
     * Ask PayStation about an attempt and, if it succeeded for the full amount,
     * mark the invoice paid. Safe to call any number of times (callback, IPN,
     * retries): an invoice is never paid twice or turned back to unpaid.
     *
     * @return string success | processing | failed | mismatch
     */
    public static function settleOnline(Payment $payment): string
    {
        if ($payment->status === 'success') {
            return 'success';
        }

        $result = PayStation::status($payment->gateway_invoice);

        return DB::transaction(function () use ($payment, $result): string {
            $payment = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();

            if ($payment->status === 'success') {
                return 'success';
            }

            $expected = (int) ceil($payment->amount / 100);
            $outcome = match (true) {
                $result['status'] === 'success' && $result['amount'] !== null && $expected > $result['amount'] + 0.001 => 'mismatch',
                $result['status'] === 'success' => 'success',
                $result['status'] === 'processing' || ! $result['found'] => 'processing',
                default => 'failed',
            };

            $payment->update([
                'status' => $outcome === 'mismatch' ? 'failed' : ($outcome === 'processing' ? ($payment->status === 'initiated' ? 'initiated' : 'processing') : $outcome),
                'trx_id' => $result['trx_id'] ?? $payment->trx_id,
                'method' => $result['method'] ?? $payment->method,
                'payer' => $result['payer'] ?? $payment->payer,
                'raw' => $result['raw'] ?: $payment->raw,
            ]);

            if ($outcome === 'mismatch') {
                Log::warning('PayStation amount lower than the invoice', ['payment' => $payment->id, 'paid' => $result['amount'], 'expected' => $expected]);
            }

            if ($outcome === 'success') {
                $invoice = Invoice::withoutGlobalScope('tenant')->whereKey($payment->invoice_id)->lockForUpdate()->firstOrFail();

                if ($invoice->status !== 'paid') {
                    self::confirm($invoice, null, 'paystation:'.strtolower((string) ($result['method'] ?? 'online')), $result['trx_id']);
                }
            }

            return $outcome;
        });
    }

    /** Platform could not find the payment: the owner can submit again. */
    public static function reject(Invoice $invoice, string $reason): void
    {
        $invoice->update(['status' => 'unpaid', 'note' => trim($reason) ?: 'Payment not found']);
    }

    /** Staff who count towards the plan limit (everyone not switched off). */
    public static function staffUsed(Tenant $tenant): int
    {
        return $tenant->users()->where('status', '!=', 'inactive')->count();
    }
}
