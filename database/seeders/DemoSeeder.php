<?php

namespace Database\Seeders;

use App\Models\Area;
use App\Models\Category;
use App\Models\Collection;
use App\Models\Deposit;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PriceList;
use App\Models\PriceListItem;
use App\Models\Product;
use App\Models\ReturnItem;
use App\Models\Role;
use App\Models\Shop;
use App\Models\ShopReturn;
use App\Models\StockLevel;
use App\Models\StockMovement;
use App\Models\Tenant;
use App\Models\Trip;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Permissions;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Demo company "Rahim Traders" (code: rahimtraders).
 *
 * Admin panel: test@example.com / password
 * Mobile app:  company code rahimtraders, phone e.g. 01712111222 (SR07), password onukrom1
 */
class DemoSeeder extends Seeder
{
    public const STAFF_PASSWORD = 'onukrom1';

    /** @var array<string, User> */
    private array $staff = [];

    /** @var array<string, Area> routes by name */
    private array $routes = [];

    /** @var array<string, Shop> shops by demo id (s1…) */
    private array $shops = [];

    /** @var array<string, Product> products by demo id (p1…) */
    private array $products = [];

    /** @var array<string, Category> categories by key */
    private array $categories = [];

    /** @var array<string, Trip> trips by number */
    private array $trips = [];

    public function run(): void
    {
        $tenant = Tenant::create([
            'code' => 'rahimtraders',
            'name' => 'Rahim Traders',
            'phone' => '01711-000001',
            'address' => 'House 12, Road 3, Mirpur-10, Dhaka',
            'settings' => Tenant::DEFAULT_SETTINGS,
        ]);

        TenantContext::run($tenant, function (): void {
            $this->roles();
            $this->people();
            $this->territory();
            $this->catalog();
            $this->shopsAndSales();
        });
    }

    private function roles(): void
    {
        foreach (Permissions::defaults() as $key => $permissions) {
            Role::create(['key' => $key, 'built_in' => true, 'permissions' => $permissions]);
        }
    }

    /** @return list<array{string, string, list<string>, string, string|null, int|null}> code, name, roles, phone, admin email, minutes since last sync */
    private static function peopleData(): array
    {
        return [
            ['OW01', 'Rahim Uddin', ['owner'], '01711000001', 'test@example.com', null],
            ['MG01', 'Selina Parvin', ['manager'], '01711000002', 'manager@example.com', null],
            ['SR07', 'Rafiq Hasan', ['sr'], '01712111222', null, 2],
            ['SR03', 'Nasrin Akter', ['sr'], '01713333444', null, 5],
            ['SR15', 'Jamal Uddin', ['sr'], '01714555666', null, 14],
            ['SR09', 'Shahin Alam', ['sr'], '01715777888', null, 48],
            ['SR12', 'Karim Mia', ['sr'], '01716999000', null, 1560],
            ['SR21', 'Tanvir Ahmed', ['sr'], '01717121212', null, null],
            ['DM01', 'Alamgir Hossain', ['dm'], '01718343434', null, 3],
            ['DM02', 'Rubel Sarkar', ['dm'], '01719565656', null, 9],
            ['DM03', 'Mizanur Rahman', ['dm', 'sr'], '01720787878', null, 31],
            ['DM04', 'Sumon Das', ['dm'], '01721909090', null, 1610],
            ['SR05', 'Liton Kumar', ['sr'], '01722131313', null, null],
        ];
    }

    private function people(): void
    {
        $roles = Role::all()->keyBy('key');
        $models = ['Redmi 9A', 'Samsung A05', 'Realme C11', 'Oppo A16', 'Vivo Y12', 'Redmi 10C', 'Samsung A04', 'Realme C30', 'Tecno Spark 8'];

        foreach (self::peopleData() as $i => [$code, $name, $roleKeys, $phone, $email, $syncMin]) {
            $user = User::create([
                'name' => $name,
                'employee_code' => $code,
                'phone' => $phone,
                'email' => $email,
                'email_verified_at' => now(),
                'password' => $email ? 'password' : self::STAFF_PASSWORD,
                'status' => match ($code) {
                    'SR21' => 'invited',
                    'SR05' => 'inactive',
                    default => 'active',
                },
                'last_seen_at' => $syncMin !== null ? now()->subMinutes($syncMin) : null,
            ]);
            $user->roles()->attach($roles->whereIn('key', $roleKeys)->pluck('id'));

            if ($syncMin !== null && ! $email) {
                $user->devices()->create([
                    'tenant_id' => $user->tenant_id,
                    'device_id' => 'demo-'.strtolower($code),
                    'model' => $models[$i % count($models)],
                    'app_version' => $code === 'SR09' ? '0.9.8' : '1.0.0',
                    'last_sync_at' => now()->subMinutes($syncMin),
                ]);
            }

            $this->staff[$code] = $user;
        }
    }

    /** @return array<string, array<string, list<array{string, string, list<string>, string|null, string}>>> zone → area → [route, code, visit days, SR, DM] */
    private static function territoryData(): array
    {
        return [
            'Dhaka North' => [
                'Mirpur' => [['Mirpur-10', 'MR-10', ['sat', 'tue'], 'SR07', 'DM01'], ['Mirpur-2', 'MR-02', ['sun', 'wed'], 'SR07', 'DM01'], ['Pallabi', 'MR-PL', ['mon', 'thu'], 'SR21', 'DM01']],
                'Uttara' => [['Uttara Sec-7', 'UT-07', ['sat', 'tue'], 'SR03', 'DM02'], ['Uttara Sec-11', 'UT-11', ['sun', 'wed'], 'SR03', 'DM02']],
                'Badda' => [['Badda', 'BD-01', ['sat', 'tue'], 'SR12', 'DM04'], ['Rampura', 'BD-RP', ['mon', 'thu'], null, 'DM04']],
            ],
            'Dhaka South' => [
                'Dhanmondi' => [['Dhanmondi', 'DH-01', ['sat', 'tue'], 'SR15', 'DM03'], ['Kalabagan', 'DH-KB', ['sun', 'wed'], 'SR15', 'DM03']],
                'Mohammadpur' => [['Mohammadpur', 'MP-01', ['sat', 'tue'], 'SR09', 'DM03']],
            ],
        ];
    }

    private function territory(): void
    {
        $sort = 0;

        foreach (self::territoryData() as $zoneName => $areas) {
            $zone = Area::create(['type' => 'zone', 'name' => $zoneName, 'sort' => $sort++]);

            foreach ($areas as $areaName => $routes) {
                $area = Area::create(['type' => 'area', 'name' => $areaName, 'parent_id' => $zone->id, 'sort' => $sort++]);

                foreach ($routes as [$name, $code, $days, $sr, $dm]) {
                    $route = Area::create([
                        'type' => 'route',
                        'parent_id' => $area->id,
                        'name' => $name,
                        'code' => $code,
                        'visit_days' => $days,
                        'sr_id' => $sr ? $this->staff[$sr]->id : null,
                        'dm_id' => $dm ? $this->staff[$dm]->id : null,
                        'sort' => $sort++,
                    ]);
                    $this->routes[$name] = $route;

                    foreach (array_filter([$sr, $dm]) as $code2) {
                        $this->staff[$code2]->routes()->syncWithoutDetaching([$route->id]);
                    }
                }
            }
        }
    }

    private function catalog(): void
    {
        foreach ([['drinks', 'Drinks', 'পানীয়'], ['biscuits', 'Biscuits', 'বিস্কুট'], ['snacks', 'Snacks', 'স্ন্যাকস'], ['soap', 'Soap & care', 'সাবান ও যত্ন'], ['noodles', 'Noodles', 'নুডলস']] as $i => [$key, $name, $bn]) {
            $this->categories[$key] = Category::create(['key' => $key, 'name' => $name, 'name_bn' => $bn, 'sort' => $i]);
        }

        $products = [
            ['p1', 'FC-250', 'Fresh Cola 250ml', 'ফ্রেশ কোলা ২৫০ মিলি', 'Fresh', 'drinks', 24, 25, 20, 9840, 1200, 2400, true, 25],
            ['p2', 'FC-1L', 'Fresh Cola 1L', 'ফ্রেশ কোলা ১ লিটার', 'Fresh', 'drinks', 12, 75, 64, 1032, 240, 600, true, 25],
            ['p3', 'MJ-200', 'Mango Juice 200ml', 'ম্যাংগো জুস ২০০ মিলি', 'Fresh', 'drinks', 24, 30, 25, 432, 288, 960, true, 75],
            ['p4', 'MC-120', 'Mr. Cookie 120g', 'মি. কুকি ১২০ গ্রাম', 'Mr. Cookie', 'biscuits', 24, 30, 25, 6120, 960, 1440, true, 55],
            ['p5', 'MC-40', 'Mr. Cookie Mini 40g', 'মি. কুকি মিনি ৪০ গ্রাম', 'Mr. Cookie', 'biscuits', 48, 10, 8, 11520, 1440, 2880, true, 55],
            ['p6', 'CH-150', 'Chanachur Hot 150g', 'চানাচুর হট ১৫০ গ্রাম', 'Mukhorochok', 'snacks', 30, 40, 34, 2610, 300, 900, true, 40],
            ['p7', 'CP-25', 'Potato Chips 25g', 'পটেটো চিপস ২৫ গ্রাম', 'Mukhorochok', 'snacks', 60, 15, 12, 0, 0, 1200, true, 85],
            ['p8', 'LS-100', 'Lemon Soap 100g', 'লেমন সাবান ১০০ গ্রাম', 'Shuvro', 'soap', 72, 45, 38, 5040, 720, 1440, true, 110],
            ['p9', 'HW-200', 'Hand Wash 200ml', 'হ্যান্ড ওয়াশ ২০০ মিলি', 'Shuvro', 'soap', 24, 95, 82, 312, 96, 480, true, 150],
            ['p10', 'NM-62', 'Masala Noodles 62g', 'মসলা নুডলস ৬২ গ্রাম', 'Instant', 'noodles', 48, 20, 17, 7680, 960, 1920, true, 15],
            ['p11', 'NC-62', 'Chicken Noodles 62g', 'চিকেন নুডলস ৬২ গ্রাম', 'Instant', 'noodles', 48, 22, 19, 1104, 480, 1920, true, 15],
            ['p12', 'FL-500', 'Fresh Lemon 500ml', 'ফ্রেশ লেমন ৫০০ মিলি', 'Fresh', 'drinks', 24, 40, 34, 0, 0, 480, false, 100],
        ];

        $main = Warehouse::create(['name' => 'Main godown — Mirpur', 'name_bn' => 'প্রধান গুদাম — মিরপুর', 'type' => 'main']);
        $van = Warehouse::create(['name' => 'Van — DM01 Alamgir', 'name_bn' => 'ভ্যান — DM01 আলমগীর', 'type' => 'van', 'user_id' => $this->staff['DM01']->id]);
        $damage = Warehouse::create(['name' => 'Damage store', 'name_bn' => 'ড্যামেজ স্টোর', 'type' => 'damage']);

        foreach ($products as [$key, $sku, $name, $bn, $brand, $cat, $pack, $mrp, $price, $onHand, $reserved, $reorder, $active, $hue]) {
            $product = Product::create([
                'category_id' => $this->categories[$cat]->id,
                'sku' => $sku,
                'name' => $name,
                'name_bn' => $bn,
                'brand' => $brand,
                'pack_size' => $pack,
                'mrp' => $mrp * 100,
                'price' => $price * 100,
                'reorder_level' => $reorder,
                'active' => $active,
                'hue' => $hue,
            ]);
            $this->products[$key] = $product;

            StockLevel::create(['warehouse_id' => $main->id, 'product_id' => $product->id, 'on_hand' => $onHand, 'reserved' => $reserved]);
            StockLevel::create(['warehouse_id' => $van->id, 'product_id' => $product->id, 'on_hand' => (int) round($onHand * 0.06), 'reserved' => 0]);
            StockLevel::create(['warehouse_id' => $damage->id, 'product_id' => $product->id, 'on_hand' => (int) round($onHand * 0.01), 'reserved' => 0]);
        }

        foreach ([['p1', -480, 'deliver', 'T-1108'], ['p4', -240, 'reserve', 'SR07-261110-019'], ['p8', 1440, 'purchase', 'PO-2211'], ['p6', 30, 'return', 'RT-0412'], ['p3', -24, 'adjust', 'ADJ-088'], ['p10', -960, 'transfer', 'TR-031']] as $i => [$p, $qty, $type, $ref]) {
            StockMovement::create([
                'warehouse_id' => $main->id, 'product_id' => $this->products[$p]->id, 'qty' => $qty, 'type' => $type, 'reference' => $ref,
                'created_at' => now()->subMinutes([18, 34, 95, 140, 260, 410][$i]),
            ]);
        }

        foreach ([['Wholesale', 'পাইকারি', 'shop_category', 'wholesale', -6], ['Pharmacy', 'ফার্মেসি', 'shop_category', 'pharmacy', 2], ['Outer Dhaka', 'ঢাকার বাইরে', 'area', 'Rampura', 3]] as [$name, $bn, $applies, $target, $delta]) {
            $list = PriceList::create(['name' => $name, 'name_bn' => $bn, 'applies_to' => $applies, 'target' => $target]);

            foreach ($this->products as $product) {
                if ($product->active) {
                    PriceListItem::create(['price_list_id' => $list->id, 'product_id' => $product->id, 'unit_price' => (int) round($product->price * (1 + $delta / 100))]);
                }
            }
        }
    }

    /** @return list<array{string, string, string, string, string, string, string, string, int, int, int|null, bool, string, string|null}> id, code, name, name_bn, owner, phone, route, category, due, credit limit, days since last order, has location, status, added by */
    private static function shopData(): array
    {
        return [
            ['s1', 'SH-04811', 'Hossain Store', 'হোসেন স্টোর', 'Md. Hossain', '01811111111', 'Mirpur-10', 'grocery', 3200, 20000, 3, true, 'active', null],
            ['s2', 'SH-04812', 'Nadia Pharmacy', 'নাদিয়া ফার্মেসি', 'Nadia Islam', '01999999999', 'Mirpur-10', 'pharmacy', 0, 15000, 1, true, 'active', null],
            ['s3', 'SH-03920', 'Bismillah Traders', 'বিসমিল্লাহ ট্রেডার্স', 'Abdul Karim', '01712345678', 'Uttara Sec-7', 'wholesale', 48600, 40000, 2, true, 'active', null],
            ['s4', 'SH-04120', 'Ma Store', 'মা স্টোর', 'Rokeya Begum', '01633221144', 'Dhanmondi', 'grocery', 7850, 10000, 6, true, 'active', null],
            ['s5', 'SH-02210', 'Rahman Tea Stall', 'রহমান টি স্টল', 'Habibur Rahman', '01555876543', 'Badda', 'tea_stall', 1250, 5000, 34, false, 'active', null],
            ['s6', 'SH-04977', 'New Amin General Store', 'নিউ আমিন জেনারেল স্টোর', 'Aminul Haque', '01977332211', 'Mohammadpur', 'grocery', 12400, 15000, 0, true, 'active', null],
            ['s7', 'SH-05001', 'Shapla Variety Store', 'শাপলা ভ্যারাইটি স্টোর', 'Jahanara Akter', '01822445566', 'Mirpur-2', 'grocery', 0, 10000, null, true, 'pending_approval', 'SR07'],
            ['s8', 'SH-05002', 'Al-Madina Pharma', 'আল-মদিনা ফার্মা', 'Faruk Ahmed', '01733998877', 'Uttara Sec-11', 'pharmacy', 0, 10000, null, true, 'pending_approval', 'SR03'],
            ['s9', 'SH-03315', 'Sonali Super Shop', 'সোনালী সুপার শপ', 'Sohel Rana', '01911765432', 'Kalabagan', 'wholesale', 22300, 50000, 4, true, 'active', null],
            ['s10', 'SH-01188', 'Babul Store', 'বাবুল স্টোর', 'Babul Mia', '01644112233', 'Rampura', 'grocery', 5600, 8000, 41, false, 'active', null],
            ['s11', 'SH-02744', 'Joy Pharmacy', 'জয় ফার্মেসি', 'Joydeb Saha', '01799554433', 'Pallabi', 'pharmacy', 0, 12000, 9, true, 'inactive', null],
            ['s12', 'SH-05003', 'Tasnim Store', 'তাসনিম স্টোর', 'Tasnim Hasan', '01866778899', 'Badda', 'grocery', 0, 8000, null, false, 'pending_approval', 'SR12'],
        ];
    }

    /** @return list<array{string, int, string, string, int, string, list<string>, int, int, string|null}> number, minutes ago, shop, SR, item lines, status, flags, distance m, accuracy m, trip */
    private static function orderData(): array
    {
        return [
            ['SR07-261110-019', 12, 's1', 'SR07', 5, 'pending', [], 14, 9, null],
            ['SR07-261110-018', 27, 's2', 'SR07', 3, 'pending', [], 22, 12, null],
            ['SR03-261110-017', 41, 's3', 'SR03', 9, 'pending', ['over_credit'], 31, 15, null],
            ['SR15-261110-012', 55, 's4', 'SR15', 4, 'pending', ['far_from_shop'], 640, 18, null],
            ['SR09-261110-009', 80, 's6', 'SR09', 6, 'pending', ['mock'], 4, 3, null],
            ['SR12-261110-002', 96, 's5', 'SR12', 2, 'pending', ['low_accuracy', 'price_changed'], 85, 64, null],
            ['SR03-261110-011', 130, 's9', 'SR03', 6, 'approved', [], 19, 8, null],
            ['SR07-261110-010', 175, 's1', 'SR07', 4, 'approved', [], 11, 7, null],
            ['SR09-261110-004', 210, 's6', 'SR09', 6, 'approved', [], 10, 6, null],
            ['SR09-261110-003', 240, 's6', 'SR09', 4, 'approved', [], 10, 6, null],
            ['SR15-261110-008', 200, 's9', 'SR15', 6, 'approved', [], 20, 8, null],
            ['SR15-261110-007', 260, 's4', 'SR15', 3, 'approved', [], 20, 8, null],
            ['SR03-261110-009', 280, 's8', 'SR03', 6, 'approved', [], 16, 7, null],
            ['SR12-261110-001', 320, 's10', 'SR12', 4, 'approved', [], 20, 11, null],
            ['SR12-261110-003', 150, 's12', 'SR12', 2, 'approved', [], 13, 9, null],
            ['SR15-261109-021', 1210, 's4', 'SR15', 5, 'dispatched', [], 16, 10, 'T-1110'],
            ['SR09-261109-018', 1300, 's6', 'SR09', 6, 'dispatched', [], 25, 14, 'T-1110'],
            ['SR07-261109-024', 1420, 's2', 'SR07', 3, 'delivered', [], 9, 6, 'T-1108'],
            ['SR03-261109-015', 1480, 's3', 'SR03', 6, 'partially_delivered', [], 28, 11, 'T-1109'],
            ['SR12-261109-006', 1530, 's10', 'SR12', 3, 'failed', ['no_location'], 0, 0, 'T-1111'],
            ['SR15-261109-014', 1600, 's9', 'SR15', 2, 'cancelled', [], 33, 13, null],
        ];
    }

    /** @return list<array{string, string, string, int, int, string, string, string, string, int}> number, shop, type, item lines, value, reason, condition, by, status, minutes ago */
    private static function returnData(): array
    {
        return [
            ['RT-0418', 's3', 'at_delivery', 2, 1920, 'damaged', 'damaged', 'DM02', 'pending', 40],
            ['RT-0417', 's4', 'market', 1, 680, 'expired', 'damaged', 'SR15', 'pending', 95],
            ['RT-0416', 's6', 'at_delivery', 1, 408, 'wrong_item', 'good', 'DM01', 'pending', 150],
            ['RT-0415', 's9', 'market', 3, 2340, 'not_needed', 'good', 'SR03', 'pending', 300],
            ['RT-0412', 's1', 'market', 1, 1020, 'expired', 'damaged', 'SR07', 'approved', 1440],
            ['RT-0410', 's2', 'at_delivery', 2, 760, 'damaged', 'damaged', 'DM01', 'approved', 1700],
            ['RT-0407', 's10', 'market', 4, 3600, 'other', 'good', 'SR12', 'rejected', 2900],
        ];
    }

    private function shopsAndSales(): void
    {
        // Around Mirpur, Dhaka — demo coordinates for the shop map.
        $base = [23.8069, 90.3687];

        foreach (self::shopData() as $i => [$key, $code, $name, $bn, $owner, $phone, $route, $cat, $due, $limit, $lastDays, $hasLoc, $status, $addedBy]) {
            $this->shops[$key] = Shop::create([
                'route_id' => $this->routes[$route]->id,
                'code' => $code,
                'name' => $name,
                'name_bn' => $bn,
                'owner_name' => $owner,
                'phone' => $phone,
                'category' => $cat,
                'lat' => $hasLoc ? $base[0] + (($i * 37) % 23 - 11) * 0.004 : null,
                'lng' => $hasLoc ? $base[1] + (($i * 53) % 19 - 9) * 0.004 : null,
                'location_accuracy_m' => $hasLoc ? 12 : null,
                'due' => $due * 100,
                'credit_limit' => $limit * 100,
                'status' => $status,
                'created_by' => $addedBy ? $this->staff[$addedBy]->id : null,
                'last_order_at' => $lastDays !== null ? now()->subDays($lastDays) : null,
            ]);
        }

        // Trips first (orders reference them).
        foreach ([
            ['T-1108', 'DM01', 'Mirpur-10', 'Van DHK-ন-11-2233', 'in_progress', 48300],
            ['T-1109', 'DM02', 'Uttara Sec-7', 'Van DHK-ন-12-4455', 'in_progress', 36750],
            ['T-1110', 'DM03', 'Dhanmondi', 'Pickup DHK-ঠ-14-1010', 'in_progress', 19200],
            ['T-1111', 'DM04', 'Badda', 'Van DHK-ন-15-7788', 'loaded', 0],
            ['T-1112', 'DM01', 'Mirpur-2', 'Van DHK-ন-11-2233', 'planned', 0],
            ['T-1104', 'DM02', 'Uttara Sec-11', 'Van DHK-ন-12-4455', 'closed', 52300],
        ] as [$number, $dm, $route, $vehicle, $status, $cash]) {
            $this->trips[$number] = Trip::create([
                'number' => $number, 'delivery_user_id' => $this->staff[$dm]->id, 'route_id' => $this->routes[$route]->id,
                'vehicle' => $vehicle, 'status' => $status, 'cash_collected' => $cash * 100,
                'closed_at' => $status === 'closed' ? now()->subDay() : null,
            ]);
        }

        $actives = array_values(array_filter($this->products, fn (Product $p) => $p->active));

        foreach (self::orderData() as $n => [$number, $min, $shopKey, $sr, $items, $status, $flags, $dist, $acc, $trip]) {
            $shop = $this->shops[$shopKey];
            $at = now()->subMinutes($min);
            $order = Order::create([
                'number' => $number,
                'shop_id' => $shop->id,
                'sales_user_id' => $this->staff[$sr]->id,
                'trip_id' => $trip ? $this->trips[$trip]->id : null,
                'status' => $status,
                'ordered_at' => $at,
                'note' => $n === 3 ? 'সকাল ১১টার আগে ডেলিভারি দিন — দুপুরে দোকান বন্ধ থাকে।' : null,
                'lat' => in_array('no_location', $flags, true) ? null : ($shop->lat ?? 23.8069),
                'lng' => in_array('no_location', $flags, true) ? null : ($shop->lng ?? 90.3687),
                'location_accuracy_m' => $acc ?: null,
                'location_at' => $at,
                'distance_from_shop_m' => $dist,
                'is_mock_location' => in_array('mock', $flags, true),
                'flags' => $flags,
                'approved_at' => in_array($status, ['pending', 'cancelled'], true) ? null : $at->copy()->addMinutes(20),
                'delivered_at' => in_array($status, ['delivered', 'partially_delivered'], true) ? $at->copy()->addHours(18) : null,
                'created_at' => $at,
            ]);

            $subtotal = 0;

            for ($i = 0; $i < min($items, 6); $i++) {
                $product = $actives[($n * 3 + $i * 5) % count($actives)];
                $qty = (($n + $i) % 3) * $product->pack_size + 6 + ($i * 2) % 7;
                $line = $qty * $product->price;
                $subtotal += $line;
                OrderItem::create([
                    'order_id' => $order->id, 'product_id' => $product->id, 'qty' => $qty, 'unit_price' => $product->price,
                    'line_total' => $line, 'delivered_qty' => in_array($status, ['delivered', 'partially_delivered'], true) ? ($status === 'delivered' ? $qty : (int) floor($qty * 0.7)) : null,
                ]);
            }

            $order->update(['subtotal' => $subtotal, 'total' => $subtotal, 'paid' => $status === 'delivered' ? $subtotal : 0]);
        }

        $deposits = [];

        foreach ([['D-221', 'DM01', 21400, 7, 35, 'waiting'], ['D-220', 'DM03', 9600, 4, 70, 'waiting'], ['D-219', 'SR07', 4200, 3, 115, 'waiting'], ['D-218', 'DM02', 3000, 1, 170, 'waiting'], ['D-217', 'DM02', 38750, 12, 1420, 'confirmed']] as [$num, $who, $amount, $count, $min, $status]) {
            $deposits[$num] = Deposit::create([
                'number' => $num, 'user_id' => $this->staff[$who]->id, 'amount' => $amount * 100, 'collections_count' => $count,
                'status' => $status, 'received_at' => $status === 'confirmed' ? now()->subMinutes($min - 30) : null, 'created_at' => now()->subMinutes($min),
            ]);
        }

        foreach ([
            ['CL-DM01-0412', 's1', 'DM01', 'cash', null, 3840, 'pending', 22, 'SR07-261109-024'],
            ['CL-DM02-0388', 's3', 'DM02', 'bkash', '9KX4T2PL1M', 15000, 'pending', 48, 'SR03-261109-015'],
            ['CL-DM03-0291', 's4', 'DM03', 'nagad', '71QZ0A8R', 2000, 'pending', 66, null],
            ['CL-SR07-0144', 's2', 'SR07', 'cash', null, 1880, 'confirmed', 140, null],
            ['CL-DM01-0409', 's6', 'DM01', 'cash', null, 5480, 'confirmed', 190, null],
            ['CL-DM02-0385', 's9', 'DM02', 'cheque', 'DBBL 004521', 22300, 'pending', 260, null],
            ['CL-DM03-0288', 's10', 'DM03', 'bank', 'BRAC 7731', 4000, 'confirmed', 1380, null],
            ['CL-DM04-0102', 's5', 'DM04', 'bkash', '3HH8N0QW', 500, 'rejected', 1500, null],
        ] as [$num, $shopKey, $who, $method, $ref, $amount, $status, $min, $orderNumber]) {
            Collection::create([
                'number' => $num, 'shop_id' => $this->shops[$shopKey]->id, 'user_id' => $this->staff[$who]->id,
                'order_id' => $orderNumber ? Order::where('number', $orderNumber)->value('id') : null,
                'method' => $method, 'reference' => $ref, 'amount' => $amount * 100, 'status' => $status,
                'reject_reason' => $status === 'rejected' ? 'Transaction ID not found' : null,
                'collected_at' => now()->subMinutes($min), 'created_at' => now()->subMinutes($min),
            ]);
        }

        foreach (self::returnData() as [$num, $shopKey, $type, $items, $value, $reason, $condition, $who, $status, $min]) {
            $return = ShopReturn::create([
                'number' => $num, 'shop_id' => $this->shops[$shopKey]->id, 'user_id' => $this->staff[$who]->id, 'type' => $type,
                'items_count' => $items, 'value' => $value * 100, 'reason' => $reason, 'condition' => $condition, 'status' => $status,
                'destination' => $status === 'approved' ? ($condition === 'good' ? 'main' : 'damage') : null,
                'reject_reason' => $status === 'rejected' ? 'Outside return period' : null,
                'created_at' => now()->subMinutes($min),
            ]);

            // Split the value over `items` products, in whole pieces.
            $left = $value * 100;

            for ($i = 0; $i < $items; $i++) {
                $product = $actives[(strlen($num) + $i * 4 + $items) % count($actives)];
                $qty = $i === $items - 1 ? max(1, intdiv($left, $product->price)) : max(1, intdiv($value * 100, $items * $product->price));
                $left -= $qty * $product->price;
                ReturnItem::create(['return_id' => $return->id, 'product_id' => $product->id, 'qty' => $qty, 'unit_price' => $product->price]);
            }
        }

        Carbon::setTestNow(); // no-op safety: keep real time for anything after seeding
    }
}
