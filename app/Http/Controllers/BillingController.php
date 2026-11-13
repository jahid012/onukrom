<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\PlatformSetting;
use App\Models\SmsMessage;
use App\Models\User;
use App\Support\Billing\Billing;
use App\Support\Billing\PayStation;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/** The owner's billing page: plan, usage, invoices; pay online (PayStation) or by hand. */
class BillingController extends Controller
{
    public function show(Request $request): Response
    {
        $tenant = TenantContext::get();
        Billing::ensureInvoice($tenant);
        $plan = $tenant->currentPlan();

        return Inertia::render('billing/index', [
            'canManage' => $this->owner($request)->isOwner(),
            'subscription' => [
                'status' => $tenant->subscriptionStatus(),
                'plan' => $plan->key,
                'planName' => $plan->name,
                'planNameBn' => $plan->name_bn,
                'price' => $plan->price / 100,
                'trialEndsAt' => $tenant->trial_ends_at?->toDateString(),
                'paidUntil' => $tenant->paid_until?->toDateString(),
                'coveredUntil' => $tenant->coveredUntil()?->toDateString(),
                'staffUsed' => Billing::staffUsed($tenant),
                'staffLimit' => $plan->staff_limit,
                'smsUsed' => SmsMessage::where('created_at', '>=', now()->startOfMonth())->count(),
                'smsLimit' => $plan->sms_limit,
            ],
            'plans' => Plan::where('is_active', true)->orderBy('sort')->get()->map(fn (Plan $p) => [
                'key' => $p->key,
                'name' => $p->name,
                'name_bn' => $p->name_bn,
                'price' => $p->price / 100,
                'staffLimit' => $p->staff_limit,
                'smsLimit' => $p->sms_limit,
                'description' => $p->description,
            ])->values(),
            'invoices' => Invoice::latest('id')->limit(36)->get()->map(fn (Invoice $i) => $i->present())->values(),
            'methods' => Billing::PAYMENT_METHODS,
            'paymentInstructions' => PlatformSetting::get('payment_instructions', ''),
            'onlinePayment' => PayStation::enabled(),
        ]);
    }

    /** Owner pressed "Pay online": off to PayStation's checkout page. */
    public function payOnline(Request $request, Invoice $invoice): SymfonyResponse
    {
        $this->onlyOwner($request);
        // Route binding runs before the tenant filter, so check the owner here.
        abort_unless($invoice->tenant_id === $this->owner($request)->tenant_id, 404);

        if (! PayStation::enabled()) {
            return back()->with('error', 'Online payment is not available yet. Please pay by bKash / Nagad / bank below.');
        }

        try {
            $url = Billing::startOnline($invoice, $this->owner($request));
        } catch (InvalidArgumentException|RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        // Full-page visit to the gateway (not an Inertia page).
        return Inertia::location($url);
    }

    /**
     * PayStation sends the payer back here. Public on purpose (the return may
     * arrive without our login cookie): it reveals nothing, only asks
     * PayStation about this attempt and then shows the Billing page.
     */
    public function payOnlineReturn(Payment $payment): RedirectResponse
    {
        return match (Billing::settleOnline($payment)) {
            'success' => redirect()->route('billing.index')->with('success', 'Payment received — thank you! Your subscription is extended.'),
            'processing' => redirect()->route('billing.index')->with('success', 'Your payment is being processed. This page updates once PayStation confirms it.'),
            'mismatch' => redirect()->route('billing.index')->with('error', 'The amount paid is less than the invoice. Please contact support.'),
            default => redirect()->route('billing.index')->with('error', 'The payment was not completed. You can try again.'),
        };
    }

    public function changePlan(Request $request): RedirectResponse
    {
        $this->onlyOwner($request);
        $data = $request->validate(['plan' => ['required', 'exists:plans,key']]);
        $tenant = TenantContext::get();
        $plan = Plan::where('key', $data['plan'])->firstOrFail();

        if (Billing::staffUsed($tenant) > $plan->staff_limit) {
            return back()->with('error', "You have more active staff than {$plan->name} allows. Switch some off first.");
        }

        try {
            Billing::changePlan($tenant, $plan);
        } catch (InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Plan changed to '.$plan->name.'.');
    }

    public function pay(Request $request, Invoice $invoice): RedirectResponse
    {
        $this->onlyOwner($request);
        // Route binding runs before the tenant filter, so check the owner here.
        abort_unless($invoice->tenant_id === $this->owner($request)->tenant_id, 404);
        $data = $request->validate([
            'method' => ['required', Rule::in(Billing::PAYMENT_METHODS)],
            'reference' => ['required', 'string', 'min:4', 'max:60'],
        ]);

        try {
            Billing::submitPayment($invoice, $data['method'], $data['reference'], $this->owner($request));
        } catch (InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Thank you. We will confirm the payment shortly.');
    }

    private function owner(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    private function onlyOwner(Request $request): void
    {
        abort_unless($this->owner($request)->isOwner(), 403, 'Only the company owner can change billing.');
    }
}
