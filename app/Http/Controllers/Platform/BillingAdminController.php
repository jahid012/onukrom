<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Plan;
use App\Models\PlatformSetting;
use App\Models\Tenant;
use App\Support\Billing\Billing;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Super admin: invoices to confirm, plans and prices, how companies pay. */
class BillingAdminController extends Controller
{
    public function invoices(Request $request): Response
    {
        $status = (string) $request->query('status', 'submitted');
        $invoices = Invoice::with('plan')
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->latest('id')->limit(300)->get();
        $names = Tenant::whereIn('id', $invoices->pluck('tenant_id')->unique())->pluck('name', 'id');

        return Inertia::render('platform/invoices', [
            'status' => $status,
            'invoices' => $invoices->map(fn (Invoice $i) => [
                ...$i->present(),
                'companyId' => $i->tenant_id,
                'company' => $names[$i->tenant_id] ?? '—',
            ])->values(),
            'counts' => Invoice::selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status'),
        ]);
    }

    public function confirm(Request $request, Invoice $invoice): RedirectResponse
    {
        abort_unless(in_array($invoice->status, ['unpaid', 'submitted'], true), 422, 'Only an open invoice can be confirmed.');
        Billing::confirm($invoice, $request->user());

        return back()->with('success', $invoice->number.' confirmed as paid.');
    }

    public function reject(Request $request, Invoice $invoice): RedirectResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:200']]);
        abort_unless($invoice->status === 'submitted', 422, 'Only a submitted payment can be rejected.');
        Billing::reject($invoice, (string) ($data['reason'] ?? ''));

        return back()->with('success', $invoice->number.' sent back to the company.');
    }

    public function void(Invoice $invoice): RedirectResponse
    {
        abort_if($invoice->status === 'paid', 422, 'A paid invoice cannot be cancelled.');
        $invoice->update(['status' => 'void']);

        return back()->with('success', $invoice->number.' cancelled.');
    }

    /** A one-off invoice for a company, starting on the given date. */
    public function issue(Request $request, Tenant $tenant): RedirectResponse
    {
        $data = $request->validate(['start' => ['required', 'date']]);
        $invoice = Billing::issue($tenant, Carbon::parse($data['start']));

        return back()->with('success', $invoice->number.' created.');
    }

    public function plans(): Response
    {
        return Inertia::render('platform/plans', [
            'plans' => Plan::orderBy('sort')->get()->map(fn (Plan $p) => [
                'id' => $p->id,
                'key' => $p->key,
                'name' => $p->name,
                'name_bn' => $p->name_bn,
                'price' => $p->price / 100,
                'staffLimit' => $p->staff_limit,
                'smsLimit' => $p->sms_limit,
                'description' => $p->description,
                'active' => $p->is_active,
                'companies' => Tenant::where('plan_key', $p->key)->count(),
            ])->values(),
        ]);
    }

    public function savePlan(Request $request, ?Plan $plan = null): RedirectResponse
    {
        $data = $request->validate([
            'key' => ['required', 'alpha_dash:ascii', 'max:32', Rule::unique('plans', 'key')->ignore($plan?->id)],
            'name' => ['required', 'string', 'max:60'],
            'name_bn' => ['nullable', 'string', 'max:60'],
            'price' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'staffLimit' => ['required', 'integer', 'min:1', 'max:10000'],
            'smsLimit' => ['required', 'integer', 'min:0', 'max:1000000'],
            'description' => ['nullable', 'string', 'max:190'],
            'active' => ['boolean'],
        ]);
        $fields = [
            'name' => $data['name'],
            'name_bn' => $data['name_bn'] ?? null,
            'price' => (int) round(((float) $data['price']) * 100),
            'staff_limit' => (int) $data['staffLimit'],
            'sms_limit' => (int) $data['smsLimit'],
            'description' => $data['description'] ?? null,
            'is_active' => (bool) ($data['active'] ?? true),
        ];

        if ($plan !== null) {
            // The key is what companies point at; renaming it would orphan them.
            $plan->update($fields);
        } else {
            Plan::create([...$fields, 'key' => strtolower($data['key']), 'sort' => (int) Plan::max('sort') + 1]);
        }

        return back()->with('success', 'Plan saved.');
    }

    public function settings(): Response
    {
        return Inertia::render('platform/settings', [
            'paymentInstructions' => PlatformSetting::get('payment_instructions', ''),
            'supportPhone' => PlatformSetting::get('support_phone', ''),
        ]);
    }

    public function saveSettings(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'paymentInstructions' => ['nullable', 'string', 'max:2000'],
            'supportPhone' => ['nullable', 'string', 'max:40'],
        ]);
        PlatformSetting::put('payment_instructions', $data['paymentInstructions'] ?? '');
        PlatformSetting::put('support_phone', $data['supportPhone'] ?? '');

        return back()->with('success', 'Settings saved.');
    }
}
