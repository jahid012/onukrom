<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\SupportTicket;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\CompanySetup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PlatformTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{tenant: Tenant, owner: User} */
    private function company(string $code = 'acme'): array
    {
        $r = CompanySetup::create(['code' => $code, 'name' => ucfirst($code)], ['name' => 'Owner '.$code, 'email' => "owner@{$code}.test", 'password' => 'secret-pass-1']);

        return ['tenant' => $r['tenant'], 'owner' => $r['owner']];
    }

    public function test_only_platform_staff_open_the_platform_and_support_cannot_touch_money(): void
    {
        ['owner' => $owner] = $this->company();
        $support = User::factory()->platform('support')->create();

        $this->actingAs($owner)->get('/platform')->assertForbidden();
        $this->actingAs($support)->get('/platform')->assertOk()->assertInertia(fn (Assert $p) => $p->component('platform/dashboard')->where('locale', 'en'));
        $this->actingAs($support)->get('/platform/companies')->assertOk();
        $this->actingAs($support)->get('/platform/invoices')->assertForbidden();
        $this->actingAs($support)->get('/platform/team')->assertForbidden();
        $this->actingAs(User::factory()->platform()->create())->get('/platform/invoices')->assertOk();
    }

    public function test_view_as_owner_and_back(): void
    {
        ['tenant' => $tenant, 'owner' => $owner] = $this->company();
        $admin = User::factory()->platform()->create();

        $this->actingAs($admin)->post("/platform/companies/{$tenant->id}/impersonate")->assertRedirect('/dashboard');
        $this->assertAuthenticatedAs($owner);
        $this->get('/billing')->assertOk()->assertInertia(fn (Assert $p) => $p->where('auth.impersonator', $admin->name.' · '.$tenant->name));

        $this->post('/impersonation/stop')->assertRedirect("/platform/companies/{$tenant->id}");
        $this->assertAuthenticatedAs($admin);
    }

    public function test_billing_from_invoice_to_confirmed_payment(): void
    {
        ['tenant' => $tenant, 'owner' => $owner] = $this->company();
        // Trial ends in 3 days: the first invoice is due.
        $tenant->update(['trial_ends_at' => now()->addDays(3)->toDateString()]);

        $this->actingAs($owner)->get('/billing')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('billing/index')->where('subscription.status', 'trial')->has('invoices', 1));
        $invoice = Invoice::withoutGlobalScopes()->where('tenant_id', $tenant->id)->firstOrFail();
        $this->assertSame('unpaid', $invoice->status);
        $this->assertSame(1_500_00, $invoice->amount);

        // A manager (not the owner) cannot pay; another company cannot touch it.
        ['owner' => $other] = $this->company('other');
        $this->actingAs($other)->post("/billing/invoices/{$invoice->id}/pay", ['method' => 'bkash', 'reference' => 'TX12345'])->assertNotFound();

        $this->actingAs($owner)->post("/billing/invoices/{$invoice->id}/pay", ['method' => 'bkash', 'reference' => 'TX12345'])->assertRedirect();
        $this->assertSame('submitted', $invoice->fresh()?->status);

        $this->actingAs(User::factory()->platform()->create())->post("/platform/invoices/{$invoice->id}/confirm")->assertRedirect();
        $tenant->refresh();
        $this->assertSame('paid', $invoice->fresh()?->status);
        $this->assertSame('active', $tenant->subscriptionStatus());
        $this->assertSame($invoice->period_end->toDateString(), $tenant->paid_until?->toDateString());
    }

    public function test_plan_limits_staff_invites(): void
    {
        ['tenant' => $tenant, 'owner' => $owner] = $this->company();
        $limit = $tenant->currentPlan()->staff_limit;
        User::factory()->count($limit - 1)->forCompany($tenant)->create(['status' => 'active']);

        $this->actingAs($owner)->postJson('/admin/actions/inviteStaff', ['args' => [['name' => 'One too many', 'phone' => '01712000999']]])
            ->assertStatus(422)
            ->assertJsonPath('message', "Your plan allows {$limit} staff. Choose a bigger plan under Billing, or switch someone off first.");
    }

    public function test_support_ticket_round_trip_stays_inside_the_company(): void
    {
        ['owner' => $owner] = $this->company();
        ['owner' => $stranger] = $this->company('other');
        $support = User::factory()->platform('support')->create();

        $this->actingAs($owner)->post('/support', ['subject' => 'How to add a route?', 'category' => 'how_to', 'body' => 'Please help'])->assertRedirect();
        $ticket = SupportTicket::withoutGlobalScopes()->firstOrFail();

        $this->actingAs($stranger)->get("/support/{$ticket->id}")->assertNotFound();
        $this->actingAs($stranger)->get('/support')->assertInertia(fn (Assert $p) => $p->has('tickets', 0));

        $this->actingAs($support)->post("/platform/support/{$ticket->id}/reply", ['body' => 'Open Areas, press Add area.'])->assertRedirect();
        $ticket->refresh();
        $this->assertSame('answered', $ticket->status);
        $this->assertSame($support->id, $ticket->assigned_to);

        $this->actingAs($owner)->get("/support/{$ticket->id}")->assertOk()
            ->assertInertia(fn (Assert $p) => $p->has('ticket.messages', 2)->where('ticket.messages.1.fromPlatform', true)->where('ticket.messages.1.author', $support->name));
    }

    public function test_suspended_company_can_only_reach_billing_and_support(): void
    {
        ['tenant' => $tenant, 'owner' => $owner] = $this->company();
        $tenant->update(['status' => 'suspended']);

        $this->actingAs($owner)->get('/orders')->assertRedirect('/billing');
        $this->actingAs($owner)->get('/billing')->assertOk();
        $this->actingAs($owner)->get('/support')->assertOk();
    }

    public function test_switched_off_accounts_cannot_sign_in(): void
    {
        $user = User::factory()->platform('support')->create(['status' => 'inactive', 'email' => 'off@onukrom.test']);

        $this->post('/login', ['email' => 'off@onukrom.test', 'password' => 'password'])->assertSessionHasErrors('email');
        $this->assertGuest();

        $user->update(['status' => 'active']);
        $this->post('/login', ['email' => 'off@onukrom.test', 'password' => 'password'])->assertRedirect();
        $this->assertAuthenticatedAs($user);
    }

    public function test_super_admin_command_and_the_last_admin_is_kept(): void
    {
        $this->artisan('onukrom:create-super-admin', ['email' => 'Boss@Onukrom.test', '--name' => 'Boss', '--password' => 'long-secret-1'])->assertSuccessful();
        $boss = User::withoutGlobalScopes()->where('email', 'boss@onukrom.test')->firstOrFail();
        $this->assertTrue($boss->isSuperAdmin());

        $this->actingAs($boss)->post("/platform/team/{$boss->id}", ['role' => 'support', 'status' => 'active'])
            ->assertSessionHas('error', 'Keep at least one active super admin.');
        $this->assertTrue($boss->fresh()?->isSuperAdmin());
    }
}
