<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Plan;
use App\Models\SupportTicket;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Billing\Billing;
use App\Support\Tenancy\CompanySetup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

/** The companies on Onukrom: list, detail, create, plan / trial, suspend. */
class CompanyController extends Controller
{
    public function dashboard(): Response
    {
        $tenants = Tenant::with('plan')->get();
        $byStatus = $tenants->countBy(fn (Tenant $t) => $t->subscriptionStatus());
        $mrr = $tenants->filter(fn (Tenant $t) => $t->subscriptionStatus() === 'active')
            ->sum(fn (Tenant $t) => $t->currentPlan()->price);

        return Inertia::render('platform/dashboard', [
            'stats' => [
                'companies' => $tenants->count(),
                'active' => $byStatus['active'] ?? 0,
                'trial' => $byStatus['trial'] ?? 0,
                'pastDue' => $byStatus['past_due'] ?? 0,
                'suspended' => $byStatus['suspended'] ?? 0,
                'mrr' => $mrr / 100,
                'staff' => User::withoutGlobalScope('tenant')->whereNotNull('tenant_id')->where('status', '!=', 'inactive')->count(),
                'openTickets' => SupportTicket::where('status', 'open')->count(),
                'paymentsToCheck' => Invoice::where('status', 'submitted')->count(),
            ],
            'recent' => $tenants->sortByDesc('created_at')->take(6)->map(fn (Tenant $t) => $this->row($t))->values(),
            'tickets' => SupportTicket::with('company', 'opener', 'assignee')->where('status', 'open')
                ->orderBy('last_message_at')->limit(6)->get()->map(fn (SupportTicket $t) => $t->present())->values(),
        ]);
    }

    public function index(Request $request): Response
    {
        $q = trim((string) $request->query('q'));

        $tenants = Tenant::with('plan')
            ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w->where('name', 'like', "%{$q}%")->orWhere('code', 'like', "%{$q}%")))
            ->orderByDesc('created_at')
            ->get();
        $staff = User::withoutGlobalScope('tenant')->whereNotNull('tenant_id')->where('status', '!=', 'inactive')
            ->selectRaw('tenant_id, count(*) as n')->groupBy('tenant_id')->pluck('n', 'tenant_id');

        return Inertia::render('platform/companies/index', [
            'q' => $q,
            'companies' => $tenants->map(fn (Tenant $t) => [...$this->row($t), 'staff' => (int) ($staff[$t->id] ?? 0)])->values(),
            'plans' => $this->plans(),
        ]);
    }

    public function show(Tenant $tenant): Response
    {
        Billing::ensureInvoice($tenant);
        $owner = $tenant->owner();

        return Inertia::render('platform/companies/show', [
            'company' => [
                ...$this->row($tenant),
                'phone' => $tenant->phone,
                'address' => $tenant->address,
                'trialEndsAt' => $tenant->trial_ends_at?->toDateString(),
                'paidUntil' => $tenant->paid_until?->toDateString(),
                'staffUsed' => Billing::staffUsed($tenant),
                'staffLimit' => $tenant->currentPlan()->staff_limit,
                'owner' => $owner ? ['name' => $owner->name, 'email' => $owner->email, 'phone' => $owner->phone] : null,
            ],
            'staff' => $tenant->users()->with(['roles' => fn ($q) => $q->withoutGlobalScope('tenant')])->orderBy('id')->get()
                ->map(fn (User $u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'code' => $u->employee_code,
                    'phone' => $u->phone,
                    'email' => $u->email,
                    'roles' => $u->roles->pluck('key')->values(),
                    'status' => $u->status,
                    'lastSeen' => $u->last_seen_at?->toIso8601String(),
                ])->values(),
            'invoices' => $tenant->invoices()->latest('id')->limit(24)->get()->map(fn (Invoice $i) => $i->present())->values(),
            'tickets' => SupportTicket::with('opener', 'assignee')->where('tenant_id', $tenant->id)->latest('id')->limit(10)->get()
                ->map(fn (SupportTicket $t) => $t->present())->values(),
            'plans' => $this->plans(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([...CompanySetup::rules(), 'plan' => ['required', 'exists:plans,key']]);

        $result = CompanySetup::create(
            ['code' => $data['code'], 'name' => $data['name'], 'plan' => $data['plan']],
            ['name' => $data['owner_name'], 'email' => $data['email'], 'phone' => $data['phone'] ?? null, 'password' => $data['password'] ?? null],
        );

        return redirect()->route('platform.companies.show', $result['tenant'])
            ->with('success', 'Company created. Code: '.$result['tenant']->code)
            ->with('secret', ($data['password'] ?? null) ? null : $result['owner']->email.' / '.$result['password']);
    }

    /** Change plan, extend the trial, or mark covered until a date. */
    public function subscription(Request $request, Tenant $tenant): RedirectResponse
    {
        $data = $request->validate([
            'plan' => ['required', 'exists:plans,key'],
            'trial_ends_at' => ['nullable', 'date'],
            'paid_until' => ['nullable', 'date'],
        ]);

        $tenant->update([
            'plan_key' => $data['plan'],
            'trial_ends_at' => $data['trial_ends_at'] ?? null,
            'paid_until' => $data['paid_until'] ?? null,
        ]);
        Log::info('Subscription changed by platform', ['by' => $request->user()?->id, 'tenant' => $tenant->id, ...$data]);

        return back()->with('success', 'Subscription updated.');
    }

    public function status(Request $request, Tenant $tenant): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', 'in:active,suspended']]);
        $tenant->update(['status' => $data['status']]);
        Log::info('Company status changed', ['by' => $request->user()?->id, 'tenant' => $tenant->id, 'status' => $data['status']]);

        return back()->with('success', $data['status'] === 'suspended' ? 'Company suspended.' : 'Company is active again.');
    }

    /** @return array<string, mixed> */
    private function row(Tenant $t): array
    {
        $plan = $t->currentPlan();

        return [
            'id' => $t->id,
            'code' => $t->code,
            'name' => $t->name,
            'plan' => $plan->key,
            'planName' => $plan->name,
            'price' => $plan->price / 100,
            'subscription' => $t->subscriptionStatus(),
            'coveredUntil' => $t->coveredUntil()?->toDateString(),
            'createdAt' => $t->created_at?->toIso8601String(),
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function plans(): array
    {
        return Plan::orderBy('sort')->get()
            ->map(fn (Plan $p) => ['key' => $p->key, 'name' => $p->name, 'price' => $p->price / 100, 'active' => $p->is_active])
            ->values()->all();
    }
}
