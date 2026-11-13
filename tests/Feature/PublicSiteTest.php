<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Lead;
use App\Models\PlatformSetting;
use App\Models\User;
use App\Support\Billing\Billing;
use App\Support\Tenancy\CompanySetup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PublicSiteTest extends TestCase
{
    use RefreshDatabase;

    private function enableMeta(): void
    {
        PlatformSetting::put('meta_pixel_id', '1234567890');
        PlatformSetting::putSecret('meta_capi_token', 'secret-token');
    }

    public function test_public_pages_render_and_tell_the_browser_which_event_id_to_use(): void
    {
        $this->enableMeta();
        Http::fake(['graph.facebook.com/*' => Http::response(['events_received' => 1])]);

        $this->get('/')->assertOk()->assertInertia(fn (Assert $p) => $p->component('welcome')
            ->where('meta.pixelId', '1234567890')
            ->where('meta.eventId', fn ($id) => str_starts_with($id, 'pageview.'))
            ->has('teamSizes', 4));
        $this->get('/terms')->assertOk()->assertInertia(fn (Assert $p) => $p->component('legal/terms'));
        $this->get('/privacy')->assertOk()->assertInertia(fn (Assert $p) => $p->component('legal/privacy'));
        $this->app->terminate();

        Http::assertSent(fn (HttpRequest $r) => str_contains($r->url(), '/1234567890/events') && $r['data'][0]['event_name'] === 'PageView');
    }

    public function test_demo_request_is_saved_and_sent_to_meta_with_hashed_details(): void
    {
        $this->enableMeta();
        Http::fake(['graph.facebook.com/*' => Http::response(['events_received' => 1])]);

        $this->withUnencryptedCookie('_fbp', 'fb.1.123.456')
            ->post('/demo-request', [
                'name' => 'Karim Uddin',
                'phone' => '+8801712-345678',
                'company' => 'Karim Traders',
                'team_size' => '6-15',
                'utm' => ['utm_source' => 'facebook', 'utm_campaign' => 'launch', 'evil' => 'x'],
                'event_id' => 'lead.abc',
            ])
            ->assertRedirect()
            ->assertSessionHas('lead', true);
        $this->app->terminate();

        $lead = Lead::firstOrFail();
        $this->assertSame('01712345678', $lead->phone);
        $this->assertSame(['utm_source' => 'facebook', 'utm_campaign' => 'launch'], $lead->utm);
        $this->assertSame('fb.1.123.456', $lead->fbp);

        Http::assertSent(function (HttpRequest $r) {
            $event = $r['data'][0];

            return $event['event_name'] === 'Lead'
                && $event['event_id'] === 'lead.abc'
                && $event['user_data']['ph'] === [hash('sha256', '8801712345678')]
                && $event['user_data']['fn'] === [hash('sha256', 'karim')]
                && $event['user_data']['fbp'] === 'fb.1.123.456'
                && $r['access_token'] === 'secret-token';
        });
    }

    public function test_bots_and_bad_numbers_are_refused_and_nothing_is_sent_without_settings(): void
    {
        Http::fake();

        $this->post('/demo-request', ['name' => 'Bot', 'phone' => '01712345678', 'website' => 'http://spam'])->assertSessionHasErrors('website');
        $this->post('/demo-request', ['name' => 'Typo', 'phone' => '12345'])->assertSessionHasErrors('phone');
        $this->post('/demo-request', ['name' => 'Real', 'phone' => '01812345678'])->assertSessionHas('lead', true);
        $this->app->terminate();

        $this->assertSame(1, Lead::count());
        Http::assertNothingSent(); // no Pixel / token configured
    }

    public function test_settings_keep_the_token_encrypted_and_never_send_it_back(): void
    {
        $admin = User::factory()->platform()->create();

        $this->actingAs($admin)->post('/platform/settings', [
            'metaPixelId' => '1234567890',
            'metaToken' => 'EAAB-secret',
            'legalName' => 'Onukrom Ltd',
        ])->assertSessionHas('success');

        $this->assertNotSame('EAAB-secret', PlatformSetting::get('meta_capi_token'));
        $this->assertSame('EAAB-secret', PlatformSetting::secret('meta_capi_token'));

        $this->get('/platform/settings')->assertInertia(fn (Assert $p) => $p
            ->where('metaTokenSet', true)
            ->missing('metaToken')
            ->where('legalName', 'Onukrom Ltd'));

        // Saving again with an empty token keeps the saved one.
        $this->post('/platform/settings', ['metaPixelId' => '1234567890', 'metaToken' => ''])->assertSessionHas('success');
        $this->assertSame('EAAB-secret', PlatformSetting::secret('meta_capi_token'));
    }

    public function test_a_confirmed_payment_is_sent_as_subscribe(): void
    {
        $this->enableMeta();
        Http::fake(['graph.facebook.com/*' => Http::response(['events_received' => 1])]);
        $r = CompanySetup::create(['code' => 'acme', 'name' => 'Acme'], ['name' => 'Rahim', 'email' => 'owner@acme.test', 'phone' => '01711000000', 'password' => 'secret-pass-1']);
        $r['tenant']->update(['trial_ends_at' => now()->addDays(2)->toDateString()]);
        $invoice = Billing::ensureInvoice($r['tenant']);
        $this->assertInstanceOf(Invoice::class, $invoice);

        $this->actingAs(User::factory()->platform()->create())->post("/platform/invoices/{$invoice->id}/confirm")->assertRedirect();
        $this->app->terminate();

        Http::assertSent(fn (HttpRequest $req) => $req['data'][0]['event_name'] === 'Subscribe'
            && $req['data'][0]['action_source'] === 'system_generated'
            && $req['data'][0]['custom_data']['currency'] === 'BDT'
            && $req['data'][0]['custom_data']['value'] == 1500
            && $req['data'][0]['user_data']['em'] === [hash('sha256', 'owner@acme.test')]);
    }

    public function test_support_staff_see_the_leads(): void
    {
        Lead::create(['name' => 'Karim', 'phone' => '01712345678', 'status' => 'new']);

        $this->actingAs(User::factory()->platform('support')->create())
            ->get('/platform/leads')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('platform/leads')->has('leads', 1));
    }
}
