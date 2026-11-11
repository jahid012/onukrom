<?php

namespace Tests\Feature\Api;

use App\Models\Order;
use App\Models\Product;
use App\Models\Shop;
use App\Models\Tenant;
use App\Models\Trip;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class MobileApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DemoSeeder::class);
    }

    private function login(string $phone = '01712111222', string $device = 'test-device'): string
    {
        return $this->withHeader('X-Tenant', 'rahimtraders')
            ->postJson('/api/v1/auth/login', ['phone' => $phone, 'password' => DemoSeeder::STAFF_PASSWORD, 'device' => ['device_id' => $device, 'model' => 'Test']])
            ->assertOk()
            ->json('data.token');
    }

    private function tenant(): Tenant
    {
        return Tenant::where('code', 'rahimtraders')->first();
    }

    public function test_company_code_lookup(): void
    {
        $this->getJson('/api/v1/tenants/lookup?code=rahimtraders')->assertOk()->assertJsonPath('data.name', 'Rahim Traders');
        $this->getJson('/api/v1/tenants/lookup?code=nope')->assertNotFound()->assertJsonPath('error.code', 'TENANT_NOT_FOUND');
    }

    public function test_sales_rep_logs_in_with_phone_and_password(): void
    {
        $this->withHeader('X-Tenant', 'rahimtraders')
            ->postJson('/api/v1/auth/login', ['phone' => '+880 1712-111222', 'password' => DemoSeeder::STAFF_PASSWORD, 'device' => ['device_id' => 'd1']])
            ->assertOk()
            ->assertJsonPath('data.user.employee_code', 'SR07')
            ->assertJsonPath('data.tenant.code', 'rahimtraders')
            ->assertJsonStructure(['data' => ['token', 'permissions', 'settings', 'route_ids']]);
    }

    public function test_wrong_password_and_unknown_phone_give_the_same_error(): void
    {
        $a = $this->withHeader('X-Tenant', 'rahimtraders')->postJson('/api/v1/auth/login', ['phone' => '01712111222', 'password' => 'wrong', 'device' => ['device_id' => 'd']]);
        $b = $this->withHeader('X-Tenant', 'rahimtraders')->postJson('/api/v1/auth/login', ['phone' => '01999000000', 'password' => 'wrong', 'device' => ['device_id' => 'd']]);

        $a->assertStatus(401)->assertJsonPath('error.code', 'INVALID_CREDENTIALS');
        $b->assertStatus(401)->assertJsonPath('error.code', 'INVALID_CREDENTIALS');
        $this->assertSame($a->json('error.message'), $b->json('error.message'));
    }

    public function test_office_users_cannot_use_the_app(): void
    {
        $this->withHeader('X-Tenant', 'rahimtraders')
            ->postJson('/api/v1/auth/login', ['phone' => '01711000002', 'password' => 'password', 'device' => ['device_id' => 'd']])
            ->assertStatus(403)->assertJsonPath('error.code', 'NO_APP_ACCESS');
    }

    public function test_change_password_signs_out_other_phones(): void
    {
        $first = $this->login(device: 'phone-a');
        $this->app['auth']->forgetGuards();
        $second = $this->login(device: 'phone-b'); // oneDevice is on: phone-a is already signed out
        $this->app['auth']->forgetGuards();

        $this->withToken($first)->getJson('/api/v1/me')->assertStatus(401);
        $this->app['auth']->forgetGuards();

        $this->withToken($second)->postJson('/api/v1/auth/password', ['current_password' => DemoSeeder::STAFF_PASSWORD, 'new_password' => 'newpass99'])->assertOk();
        $this->app['auth']->forgetGuards();

        $this->withHeader('X-Tenant', 'rahimtraders')
            ->postJson('/api/v1/auth/login', ['phone' => '01712111222', 'password' => 'newpass99', 'device' => ['device_id' => 'c']])
            ->assertOk();
    }

    public function test_pull_returns_only_the_reps_routes_and_shops(): void
    {
        $token = $this->login();
        $routes = $this->withToken($token)->getJson('/api/v1/sync/pull?entity=routes')->assertOk()->json('data.items');
        $this->assertEqualsCanonicalizing(['Mirpur-10', 'Mirpur-2'], array_column($routes, 'name'));

        $shops = $this->withToken($token)->getJson('/api/v1/sync/pull?entity=shops')->assertOk()->json('data.items');
        $this->assertNotEmpty($shops);
        $this->assertContains('Hossain Store', array_column($shops, 'name'));
        $this->assertNotContains('Bismillah Traders', array_column($shops, 'name')); // Uttara — not his route

        $products = $this->withToken($token)->getJson('/api/v1/sync/pull?entity=products&limit=5')->assertOk();
        $this->assertTrue($products->json('data.has_more'));
        $next = $this->withToken($token)->getJson('/api/v1/sync/pull?entity=products&limit=50&cursor='.urlencode($products->json('data.next_cursor')))->json('data.items');
        $this->assertCount(7, $next);
    }

    public function test_offline_order_push_is_idempotent_and_applies_location_rules(): void
    {
        $token = $this->login();
        $tenant = $this->tenant();
        [$shop, $product] = TenantContext::run($tenant, fn () => [Shop::where('code', 'SH-04812')->first(), Product::where('sku', 'FC-250')->first()]);
        $id = (string) Str::ulid();
        $op = [
            'entity' => 'order', 'op' => 'upsert', 'id' => $id, 'client_version' => 1,
            'data' => [
                'number' => 'SR07-261112-001', 'shop_id' => $shop->id, 'ordered_at' => now()->toIso8601String(),
                'lat' => $shop->lat + 0.01, 'lng' => $shop->lng, 'accuracy_m' => 8, 'is_mock' => false,
                'items' => [['id' => (string) Str::ulid(), 'product_id' => $product->id, 'qty' => 30, 'unit_price' => $product->price]],
            ],
        ];

        $first = $this->withToken($token)->postJson('/api/v1/sync/push', ['operations' => [$op]])->assertOk()->json('data.results.0');
        $this->assertSame('accepted', $first['result']);
        $this->assertSame('pending', $first['server']['status']);
        $this->assertContains('far_from_shop', $first['server']['flags']); // ~1.1 km away

        // Network dropped, phone sends it again → duplicate, no second order.
        $again = $this->withToken($token)->postJson('/api/v1/sync/push', ['operations' => [$op]])->json('data.results.0');
        $this->assertSame('duplicate', $again['result']);
        $this->assertSame(1, TenantContext::run($tenant, fn () => Order::where('id', $id)->count()));

        // No GPS fix while location is required → rejected.
        $noGps = $op;
        $noGps['id'] = (string) Str::ulid();
        unset($noGps['data']['lat'], $noGps['data']['lng']);
        $this->withToken($token)->postJson('/api/v1/sync/push', ['operations' => [$noGps]])
            ->assertJsonPath('data.results.0.result', 'rejected')
            ->assertJsonPath('data.results.0.error.code', 'LOCATION_REQUIRED');
    }

    public function test_sales_rep_creates_a_shop_offline(): void
    {
        $token = $this->login();
        $id = (string) Str::ulid();

        $this->withToken($token)->postJson('/api/v1/sync/push', ['operations' => [[
            'entity' => 'shop', 'op' => 'upsert', 'id' => $id,
            'data' => ['name' => 'Mayer Doa Store', 'phone' => '01811223344', 'category' => 'grocery', 'lat' => 23.8, 'lng' => 90.36, 'accuracy_m' => 10],
        ]]])->assertJsonPath('data.results.0.result', 'accepted')->assertJsonPath('data.results.0.server.status', 'pending_approval');
    }

    public function test_delivery_man_delivers_and_collects_cash(): void
    {
        $token = $this->login('01720787878'); // DM03
        $trips = $this->withToken($token)->getJson('/api/v1/sync/pull?entity=trips')->assertOk()->json('data.items');
        $trip = collect($trips)->firstWhere('number', 'T-1110');
        $order = collect($trip['orders'])->firstWhere('status', 'dispatched');

        $results = $this->withToken($token)->postJson('/api/v1/sync/push', ['operations' => [
            ['entity' => 'delivery', 'op' => 'upsert', 'id' => (string) Str::ulid(), 'data' => ['order_id' => $order['id'], 'result' => 'delivered']],
            ['entity' => 'collection', 'op' => 'upsert', 'id' => (string) Str::ulid(), 'data' => ['shop_id' => $order['shop_id'], 'order_id' => $order['id'], 'method' => 'cash', 'amount' => 50000]],
        ]])->json('data.results');

        $this->assertSame('delivered', $results[0]['server']['status']);
        $this->assertSame('accepted', $results[1]['result']);
        $this->assertSame(50000, (int) TenantContext::run($this->tenant(), fn () => Order::find($order['id'])->paid));
        $this->assertSame(19200 * 100 + 50000, (int) TenantContext::run($this->tenant(), fn () => Trip::where('number', 'T-1110')->value('cash_collected')));
    }

    public function test_token_from_one_company_is_refused_for_another(): void
    {
        $token = $this->login();
        Tenant::create(['code' => 'other', 'name' => 'Other']);

        $this->withToken($token)->withHeader('X-Tenant', 'other')->getJson('/api/v1/me')->assertStatus(401);
    }

    public function test_inactive_staff_cannot_log_in(): void
    {
        TenantContext::run($this->tenant(), fn () => User::where('employee_code', 'SR07')->update(['status' => 'inactive']));

        $this->withHeader('X-Tenant', 'rahimtraders')
            ->postJson('/api/v1/auth/login', ['phone' => '01712111222', 'password' => DemoSeeder::STAFF_PASSWORD, 'device' => ['device_id' => 'd']])
            ->assertStatus(403)->assertJsonPath('error.code', 'USER_INACTIVE');
    }
}
