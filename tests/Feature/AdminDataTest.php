<?php

namespace Tests\Feature;

use App\Models\Collection;
use App\Models\Order;
use App\Models\Product;
use App\Models\Shop;
use App\Models\ShopReturn;
use App\Models\SmsMessage;
use App\Models\StockLevel;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Tenancy\TenantContext;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminDataTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DemoSeeder::class);
    }

    private function tenant(): Tenant
    {
        return Tenant::where('code', 'rahimtraders')->first();
    }

    private function in(callable $fn): mixed
    {
        return TenantContext::run($this->tenant(), $fn);
    }

    private function owner(): User
    {
        return User::withoutGlobalScopes()->where('email', 'test@example.com')->first();
    }

    private function act(string $action, array $args, ?User $as = null)
    {
        return $this->actingAs($as ?? $this->owner())->postJson('/admin/actions/'.$action, ['args' => $args]);
    }

    public function test_owner_gets_the_whole_state_in_taka(): void
    {
        $state = $this->actingAs($this->owner())->getJson('/admin/state')->assertOk()->json('state');

        $this->assertCount(21, $state['orders']);
        $this->assertSame('Rahim Traders', $state['company']['name']);
        $cola = collect($state['products'])->firstWhere('sku', 'FC-250');
        $this->assertEquals(20, $cola['price']); // 2000 paisa → ৳20
        $this->assertSame('default', $state['priceLists'][0]['id']);
        $this->assertNotEmpty($state['dashboard']['kpis']['30d']);
        $this->assertNotEmpty(collect($state['orders'])->firstWhere('number', 'SR07-261110-019')['lines']);
    }

    public function test_sales_reps_cannot_open_the_office_panel(): void
    {
        $sr = User::withoutGlobalScopes()->where('employee_code', 'SR07')->first();

        $this->actingAs($sr)->getJson('/admin/state')->assertForbidden();
        $this->act('approveOrders', [['SR07-261110-019']], $sr)->assertForbidden();
    }

    public function test_order_from_the_phone_shows_up_and_approval_reserves_stock(): void
    {
        $token = $this->withHeader('X-Tenant', 'rahimtraders')
            ->postJson('/api/v1/auth/login', ['phone' => '01712111222', 'password' => DemoSeeder::STAFF_PASSWORD, 'device' => ['device_id' => 'p1']])
            ->json('data.token');
        [$shop, $product] = $this->in(fn () => [Shop::where('code', 'SH-04812')->first(), Product::where('sku', 'MC-120')->first()]);

        $this->withToken($token)->postJson('/api/v1/sync/push', ['operations' => [[
            'entity' => 'order', 'id' => (string) Str::ulid(), 'client_version' => 1,
            'data' => [
                'number' => 'SR07-261112-050', 'shop_id' => $shop->id, 'lat' => $shop->lat, 'lng' => $shop->lng, 'accuracy_m' => 6,
                'items' => [['id' => (string) Str::ulid(), 'product_id' => $product->id, 'qty' => 48, 'unit_price' => $product->price]],
            ],
        ]]])->assertJsonPath('data.results.0.result', 'accepted');
        $this->app['auth']->forgetGuards();

        $order = collect($this->actingAs($this->owner())->getJson('/admin/state')->json('state.orders'))->firstWhere('number', 'SR07-261112-050');
        $this->assertSame('pending', $order['status']);
        $this->assertEquals(48 * 25.5, $order['total']); // pharmacy price list: +2 %

        $reservedBefore = $this->in(fn () => StockLevel::where('warehouse_id', Warehouse::where('type', 'main')->value('id'))->where('product_id', $product->id)->value('reserved'));
        $this->act('approveOrders', [['SR07-261112-050']])->assertOk()->assertJsonPath('state.orders.0.status', 'approved');
        $reservedAfter = $this->in(fn () => StockLevel::where('warehouse_id', Warehouse::where('type', 'main')->value('id'))->where('product_id', $product->id)->value('reserved'));
        $this->assertSame($reservedBefore + 48, (int) $reservedAfter);
    }

    public function test_create_trip_returns_the_new_number_and_dispatches_orders(): void
    {
        $response = $this->act('createTrip', [['dm' => 'DM01', 'route' => 'Mirpur-10', 'vehicle' => 'Van 1', 'orderNumbers' => ['SR07-261110-010']]])->assertOk();

        $this->assertSame('T-1113', $response->json('result'));
        $this->assertSame('dispatched', $this->in(fn () => Order::where('number', 'SR07-261110-010')->value('status')));
    }

    public function test_invite_sends_a_masked_sms_and_the_password_works_in_the_app(): void
    {
        $password = $this->act('inviteStaff', [['name' => 'New Rep', 'phone' => '01755000111', 'code' => 'SR30', 'roles' => ['sr'], 'areas' => ['Mirpur-10']]])
            ->assertOk()->json('result');

        $this->assertSame(8, strlen($password));
        $sms = $this->in(fn () => SmsMessage::latest('id')->first());
        $this->assertStringNotContainsString($password, $sms->body_masked);

        $person = $this->in(fn () => User::where('employee_code', 'SR30')->first());
        $this->assertTrue(Hash::check($password, $person->password));
        $this->assertSame('invited', $person->status);
    }

    public function test_rejecting_a_payment_puts_it_back_on_the_shop_dues(): void
    {
        [$collection, $dueBefore] = $this->in(function () {
            $c = Collection::where('number', 'CL-DM02-0388')->first();

            return [$c, Shop::find($c->shop_id)->due];
        });

        $this->act('rejectCollection', ['CL-DM02-0388', 'Not received'])->assertOk();

        $this->assertSame($dueBefore + $collection->amount, (int) $this->in(fn () => Shop::find($collection->shop_id)->due));
    }

    public function test_approving_a_return_puts_goods_into_the_chosen_store(): void
    {
        $line = $this->in(fn () => ShopReturn::with('items')->where('number', 'RT-0418')->first()->items->first());
        $damage = $this->in(fn () => Warehouse::where('type', 'damage')->value('id'));
        $before = $this->in(fn () => StockLevel::where('warehouse_id', $damage)->where('product_id', $line->product_id)->value('on_hand'));

        $this->act('approveReturn', ['RT-0418', 'damage'])->assertOk();

        $after = $this->in(fn () => StockLevel::where('warehouse_id', $damage)->where('product_id', $line->product_id)->value('on_hand'));
        $this->assertGreaterThanOrEqual($before + $line->qty, (int) $after);
    }

    public function test_price_change_is_saved_with_history(): void
    {
        $id = $this->in(fn () => Product::where('sku', 'FC-250')->value('id'));

        $state = $this->act('setPrice', ['default', $id, 21.5])->assertOk()->json('state');

        $this->assertEquals(21.5, collect($state['products'])->firstWhere('id', $id)['price']);
        $this->assertEquals(21.5, $state['priceHistory'][0]['to']);
    }

    public function test_permissions_and_unknown_actions_are_refused(): void
    {
        $manager = User::withoutGlobalScopes()->where('email', 'manager@example.com')->first();

        $this->act('saveSettings', [['name' => 'X']], $manager)->assertForbidden();
        $this->act('can', ['order.approve'])->assertNotFound(); // helpers are not actions
        $this->act('approveOrders', [['NOPE']])->assertOk();
    }

    public function test_settings_are_saved_and_reach_the_app(): void
    {
        $settings = $this->actingAs($this->owner())->getJson('/admin/state')->json('state.settings');
        $settings['geofence'] = 300;
        $settings['locationMode'] = 'flag';

        $this->act('saveSettings', [$settings])->assertOk();

        $this->assertSame(300, $this->tenant()->fresh()->setting('geofence'));
        $this->assertSame('flag', $this->tenant()->fresh()->setting('locationMode'));
    }
}
