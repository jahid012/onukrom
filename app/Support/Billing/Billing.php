<?php

namespace App\Support\Billing;

use App\Models\Invoice;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Monthly subscriptions paid by hand (bKash / Nagad / bank):
 *
 *   1. An invoice appears 7 days before the trial or paid month ends.
 *   2. The owner pays and submits the transaction id   → "submitted".
 *   3. The platform checks it and confirms            → "paid", covered a month more.
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

    /** Platform saw the money: the company is covered until the invoice's period end. */
    public static function confirm(Invoice $invoice, User $by): void
    {
        DB::transaction(function () use ($invoice, $by): void {
            $invoice->update(['status' => 'paid', 'paid_at' => now(), 'confirmed_by' => $by->id]);
            $tenant = Tenant::findOrFail($invoice->tenant_id);
            $until = $tenant->paid_until !== null && $tenant->paid_until->gt($invoice->period_end) ? $tenant->paid_until : $invoice->period_end;
            $tenant->update(['paid_until' => $until->toDateString(), 'status' => 'active']);
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
