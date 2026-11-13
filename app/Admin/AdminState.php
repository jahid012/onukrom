<?php

namespace App\Admin;

use App\Models\Area;
use App\Models\Category;
use App\Models\Collection;
use App\Models\Deposit;
use App\Models\Order;
use App\Models\PriceChange;
use App\Models\PriceList;
use App\Models\Product;
use App\Models\Role;
use App\Models\Shop;
use App\Models\ShopReturn;
use App\Models\SmsMessage;
use App\Models\StockLevel;
use App\Models\StockMovement;
use App\Models\Trip;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Tenancy\CompanySetup;
use App\Support\Tenancy\TenantContext;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection as SupportCollection;

/**
 * Everything the admin panel shows, read from the database for the current
 * company and shaped exactly like the React store (resources/js/data/demo/store.ts).
 * Money goes out in taka, quantities in pieces, times as "minutes ago".
 */
class AdminState
{
    public const DEFAULT_LIST = 'default';

    /** Orders older than this are left out unless still open. */
    private const ORDER_DAYS = 90;

    /** @var array<int, string> user id → staff code */
    private array $codes = [];

    /** @var array<string, string> route id → route name */
    private array $routeNames = [];

    public function __construct(private readonly User $viewer) {}

    public static function taka(int|float|string|null $paisa): float|int
    {
        $v = ((int) $paisa) / 100;

        return floor($v) == $v ? (int) $v : round($v, 2);
    }

    public static function mins(?CarbonInterface $at): int
    {
        return $at ? (int) max(0, round((now()->getTimestamp() - $at->getTimestamp()) / 60)) : 0;
    }

    /** @return array<string, mixed> */
    public function build(): array
    {
        $tenant = TenantContext::get();
        // Repair a company created without its warehouses / categories.
        CompanySetup::ensureDefaults();
        $plan = $tenant->currentPlan();
        $users = User::with('roles', 'routes', 'devices')->orderBy('id')->get();
        $this->codes = $users->mapWithKeys(fn (User $u) => [$u->id => $u->employee_code ?? 'U'.$u->id])->all();
        $areas = Area::orderBy('sort')->get();
        $this->routeNames = $areas->where('type', 'route')->pluck('name', 'id')->all();
        $categories = Category::orderBy('sort')->get();
        $categoryKeys = $categories->pluck('key', 'id')->all();
        $products = Product::orderBy('name')->get();
        $warehouses = Warehouse::orderByRaw("CASE type WHEN 'main' THEN 0 WHEN 'van' THEN 1 ELSE 2 END")->get();
        $mainId = $warehouses->firstWhere('type', 'main')?->id;
        $levels = StockLevel::all();
        $shops = Shop::orderBy('name')->get();

        $orders = Order::with('items', 'trip:id,number')
            ->where(fn ($q) => $q->where('ordered_at', '>=', now()->subDays(self::ORDER_DAYS))
                ->orWhereIn('status', ['pending', 'approved', 'dispatched']))
            ->orderByDesc('ordered_at')
            ->get();

        $state = [
            'orders' => $orders->map(fn (Order $o) => $this->order($o, $shops))->values(),
            'trips' => $this->trips($orders),
            'collections' => Collection::with('order:id,number')->orderByDesc('collected_at')->limit(1000)->get()->map(fn (Collection $c) => [
                'number' => $c->number,
                'shopId' => $c->shop_id,
                'by' => $this->code($c->user_id),
                'method' => $c->method,
                'reference' => $c->reference,
                'amount' => self::taka($c->amount),
                'status' => $c->status,
                'minutesAgo' => self::mins($c->collected_at),
                'orderNumber' => $c->order?->number,
                'rejectReason' => $c->reject_reason,
            ])->values(),
            'deposits' => Deposit::orderByDesc('created_at')->limit(300)->get()->map(fn (Deposit $d) => [
                'id' => $d->id,
                'number' => $d->number,
                'staff' => $this->code($d->user_id),
                'amount' => self::taka($d->amount),
                'collections' => (int) $d->collections_count,
                'minutesAgo' => self::mins($d->created_at),
                'status' => $d->status,
            ])->values(),
            'returns' => ShopReturn::with('items')->orderByDesc('created_at')->limit(500)->get()->map(fn (ShopReturn $r) => [
                'number' => $r->number,
                'shopId' => $r->shop_id,
                'type' => $r->type,
                'items' => (int) $r->items_count,
                'value' => self::taka($r->value),
                'reason' => $r->reason,
                'condition' => $r->condition,
                'by' => $this->code($r->user_id),
                'status' => $r->status,
                'minutesAgo' => self::mins($r->created_at),
                'destination' => $r->destination,
                'rejectReason' => $r->reject_reason,
                'lines' => $r->items->map(fn ($i) => ['productId' => $i->product_id, 'qty' => (int) $i->qty, 'unitPrice' => self::taka($i->unit_price)])->values(),
            ])->values(),
            'shops' => $shops->map(fn (Shop $s) => [
                'id' => $s->id,
                'code' => $s->code,
                'name' => $s->name,
                'name_bn' => $s->name_bn ?? '',
                'owner' => $s->owner_name ?? '',
                'phone' => $s->phone ?? '',
                'route' => $this->routeNames[$s->route_id] ?? '',
                'category' => $s->category,
                'due' => self::taka($s->due),
                'creditLimit' => self::taka($s->credit_limit),
                'lastOrderDays' => $s->last_order_at ? (int) floor($s->last_order_at->diffInDays(now(), true)) : null,
                'hasLocation' => $s->lat !== null,
                'lat' => $s->lat !== null ? (float) $s->lat : null,
                'lng' => $s->lng !== null ? (float) $s->lng : null,
                'status' => $s->status,
                'addedBy' => $s->created_by ? $this->code($s->created_by) : null,
            ])->values(),
            'zones' => $this->zones($areas, $shops),
            'categories' => $categories->map(fn (Category $c) => ['key' => $c->key, 'name' => $c->name, 'name_bn' => $c->name_bn ?? $c->name])->values(),
            'warehouses' => $warehouses->map(fn (Warehouse $w) => ['id' => $w->id, 'name' => $w->name, 'name_bn' => $w->name_bn ?? $w->name, 'type' => $w->type, 'factor' => 1])->values(),
            'products' => $products->map(function (Product $p) use ($levels, $mainId, $categoryKeys) {
                $main = $levels->first(fn ($l) => $l->warehouse_id === $mainId && $l->product_id === $p->id);

                return [
                    'id' => $p->id,
                    'sku' => $p->sku,
                    'name' => $p->name,
                    'name_bn' => $p->name_bn ?? $p->name,
                    'brand' => $p->brand ?? '',
                    'category' => $categoryKeys[$p->category_id] ?? '',
                    'packSize' => (int) $p->pack_size,
                    'mrp' => self::taka($p->mrp),
                    'price' => self::taka($p->price),
                    'onHand' => (int) ($main->on_hand ?? 0),
                    'reserved' => (int) ($main->reserved ?? 0),
                    'reorderAt' => (int) $p->reorder_level,
                    'active' => (bool) $p->active,
                    'hue' => (int) $p->hue,
                ];
            })->values(),
            ...$this->pricing($products, $shops),
            'stock' => $levels->groupBy('warehouse_id')->map(fn ($rows) => $rows->mapWithKeys(fn ($l) => [
                $l->product_id => ['onHand' => (int) $l->on_hand, 'reserved' => (int) $l->reserved],
            ]))->all() ?: new \stdClass,
            'movements' => StockMovement::orderByDesc('created_at')->orderByDesc('id')->limit(300)->get()->map(fn (StockMovement $m) => [
                'id' => (string) $m->id,
                'productId' => $m->product_id,
                'qty' => (int) $m->qty,
                'type' => $m->type,
                'reference' => $m->reference ?? '',
                'minutesAgo' => self::mins($m->created_at),
                'warehouseId' => $m->warehouse_id,
            ])->values(),
            'staff' => $users->map(fn (User $u) => $this->staff($u))->values(),
            'roles' => Role::orderBy('id')->get()->map(fn (Role $r) => [
                'key' => $r->key,
                'name' => $r->name,
                'builtIn' => (bool) $r->built_in,
                'grants' => $r->permissions,
                'users' => $users->filter(fn (User $u) => $u->roles->contains('id', $r->id))->count(),
            ])->values(),
            'settings' => [
                'name' => $tenant->name,
                'phone' => $tenant->phone ?? '',
                'address' => $tenant->address ?? '',
                ...$tenant->setting(),
            ],
            'company' => [
                'name' => $tenant->name,
                'code' => $tenant->code,
                'plan' => $plan->key,
                'planName' => $plan->name,
                'subscription' => $tenant->subscriptionStatus(),
                'coveredUntil' => $tenant->coveredUntil()?->toDateString(),
                'staffUsed' => $users->where('status', '!=', 'inactive')->count(),
                'staffLimit' => $plan->staff_limit,
                'smsUsed' => SmsMessage::where('created_at', '>=', now()->startOfMonth())->count(),
                'smsLimit' => $plan->sms_limit,
            ],
            'aging' => $this->aging($shops),
            'notifications' => $this->notifications($orders, $shops, $products, $levels, $mainId),
        ];

        $state['dashboard'] = (new DashboardStats($this->codes, $this->routeNames))->build($orders, $shops, $users, $products, $areas);

        return $state;
    }

    private function code(?int $userId): string
    {
        return $userId ? ($this->codes[$userId] ?? '') : '';
    }

    /**
     * @param  SupportCollection<int, Shop>  $shops
     * @return array<string, mixed>
     */
    private function order(Order $o, SupportCollection $shops): array
    {
        $shop = $shops->firstWhere('id', $o->shop_id);

        return [
            'id' => $o->id,
            'number' => $o->number,
            'minutesAgo' => self::mins($o->ordered_at),
            'shopId' => $o->shop_id,
            'sr' => $this->code($o->sales_user_id),
            'items' => $o->items->count(),
            'subtotal' => self::taka($o->subtotal),
            'discount' => self::taka($o->discount),
            'total' => self::taka($o->total),
            'paid' => self::taka($o->paid),
            'status' => $o->status,
            'flags' => array_values($o->flags ?? []),
            'distanceM' => (int) ($o->distance_from_shop_m ?? 0),
            'accuracyM' => (int) ($o->location_accuracy_m ?? 0),
            'lat' => $o->lat !== null ? (float) $o->lat : null,
            'lng' => $o->lng !== null ? (float) $o->lng : null,
            'shopLat' => $shop?->lat !== null ? (float) $shop->lat : null,
            'shopLng' => $shop?->lng !== null ? (float) $shop->lng : null,
            'trip' => $o->trip?->number,
            'note' => $o->note,
            'rejectReason' => $o->reject_reason,
            'lines' => $o->items->map(fn ($i) => [
                'productId' => $i->product_id,
                'qty' => (int) $i->qty,
                'unitPrice' => self::taka($i->unit_price),
                'discount' => self::taka($i->discount),
                'total' => self::taka($i->line_total),
                'deliveredQty' => $i->delivered_qty,
            ])->values(),
        ];
    }

    /**
     * @param  SupportCollection<int, Order>  $orders
     * @return array<int, array<string, mixed>>
     */
    private function trips(SupportCollection $orders): array
    {
        return Trip::with('orders:id,trip_id,number,status,total')->orderByDesc('created_at')->limit(300)->get()->map(fn (Trip $t) => [
            'id' => $t->id,
            'number' => $t->number,
            'dm' => $this->code($t->delivery_user_id),
            'route' => $this->routeNames[$t->route_id] ?? '',
            'vehicle' => $t->vehicle ?? '',
            'orders' => $t->orders->count(),
            'delivered' => $t->orders->whereIn('status', ['delivered', 'partially_delivered'])->count(),
            'failed' => $t->orders->where('status', 'failed')->count(),
            'cashExpected' => self::taka($t->orders->sum('total')),
            'cashCollected' => self::taka($t->cash_collected),
            'status' => $t->status,
            'orderNumbers' => $t->orders->pluck('number')->values(),
        ])->values()->all();
    }

    /**
     * @param  SupportCollection<int, Area>  $areas
     * @param  SupportCollection<int, Shop>  $shops
     * @return array<int, array<string, mixed>>
     */
    private function zones(SupportCollection $areas, SupportCollection $shops): array
    {
        $shopCount = $shops->where('status', '!=', 'inactive')->countBy('route_id');
        $children = $areas->groupBy('parent_id');

        return $areas->where('type', 'zone')->map(fn (Area $z) => [
            'id' => $z->id,
            'name' => $z->name,
            'areas' => ($children[$z->id] ?? collect())->where('type', 'area')->map(fn (Area $a) => [
                'id' => $a->id,
                'name' => $a->name,
                'routes' => ($children[$a->id] ?? collect())->where('type', 'route')->map(fn (Area $r) => [
                    'id' => $r->id,
                    'name' => $r->name,
                    'code' => $r->code ?? '',
                    'visitDays' => array_values($r->visit_days ?? []),
                    'sr' => $r->sr_id ? $this->code($r->sr_id) : null,
                    'dm' => $r->dm_id ? $this->code($r->dm_id) : null,
                    'shops' => (int) ($shopCount[$r->id] ?? 0),
                ])->values(),
            ])->values(),
        ])->values()->all();
    }

    /**
     * Price lists + explicit prices + history. The default list is the product's own price.
     *
     * @param  SupportCollection<int, Product>  $products
     * @param  SupportCollection<int, Shop>  $shops
     * @return array<string, mixed>
     */
    private function pricing(SupportCollection $products, SupportCollection $shops): array
    {
        $lists = PriceList::with('items')->orderBy('created_at')->get();
        $active = $products->where('active', true)->count();
        $lastDefault = PriceChange::whereNull('price_list_id')->max('created_at');
        $covered = 0;

        $rows = $lists->map(function (PriceList $l) use ($shops, &$covered) {
            $count = $shops->filter(fn (Shop $s) => $l->applies_to === 'shop_category'
                ? $s->category === $l->target
                : ($this->routeNames[$s->route_id] ?? null) === $l->target)->count();
            $covered += $count;
            $updated = $l->items->max('updated_at') ?? $l->updated_at;

            return [
                'id' => $l->id,
                'name' => $l->name,
                'name_bn' => $l->name_bn ?? $l->name,
                'appliesTo' => $l->applies_to,
                'target' => $l->target,
                'products' => $l->items->count(),
                'shops' => $count,
                'updatedDaysAgo' => (int) floor(Carbon::parse($updated)->diffInDays(now(), true)),
                'delta' => 0,
            ];
        });

        $default = [
            'id' => self::DEFAULT_LIST,
            'name' => 'Default',
            'name_bn' => 'ডিফল্ট',
            'appliesTo' => 'default',
            'target' => null,
            'products' => $active,
            'shops' => max(0, $shops->count() - $covered),
            'updatedDaysAgo' => $lastDefault ? (int) floor(Carbon::parse($lastDefault)->diffInDays(now(), true)) : 0,
            'delta' => 0,
        ];

        $prices = $lists->mapWithKeys(fn (PriceList $l) => [
            $l->id => $l->items->mapWithKeys(fn ($i) => [$i->product_id => self::taka($i->unit_price)])->all() ?: new \stdClass,
        ])->all();

        return [
            'priceLists' => collect([$default])->concat($rows)->values(),
            'prices' => $prices ?: new \stdClass,
            'priceHistory' => PriceChange::orderByDesc('created_at')->orderByDesc('id')->limit(200)->get()->map(fn (PriceChange $c) => [
                'id' => (string) $c->id,
                'listId' => $c->price_list_id ?? self::DEFAULT_LIST,
                'productId' => $c->product_id,
                'from' => self::taka($c->from_price),
                'to' => self::taka($c->to_price),
                'minutesAgo' => self::mins($c->created_at),
            ])->values(),
        ];
    }

    /** @return array<string, mixed> */
    private function staff(User $u): array
    {
        $device = $u->devices->sortByDesc(fn ($d) => $d->last_sync_at ?? $d->updated_at)->first();
        $synced = $device->last_sync_at ?? $u->last_seen_at;

        return [
            'id' => $u->id,
            'code' => $this->code($u->id),
            'name' => $u->name,
            'roles' => $u->roles->pluck('key')->values(),
            'phone' => $u->phone ?? '',
            'email' => $u->email,
            'areas' => $u->routes->pluck('name')->values(),
            'device' => $device ? ['model' => $device->model ?? '—', 'app' => $device->app_version ?? '—'] : null,
            'lastSyncMin' => $synced && $u->canUseApp() ? self::mins($synced) : null,
            'status' => $u->status,
        ];
    }

    /**
     * Outstanding dues grouped by how long since the shop last ordered.
     *
     * @param  SupportCollection<int, Shop>  $shops
     * @return array<int, array{key: string, amount: float|int, shops: int}>
     */
    private function aging(SupportCollection $shops): array
    {
        $buckets = ['0_30' => [0, 0], '31_60' => [0, 0], '60_plus' => [0, 0]];

        foreach ($shops->where('due', '>', 0) as $s) {
            $days = $s->last_order_at ? $s->last_order_at->diffInDays(now(), true) : 999;
            $key = $days <= 30 ? '0_30' : ($days <= 60 ? '31_60' : '60_plus');
            $buckets[$key][0] += (int) $s->due;
            $buckets[$key][1]++;
        }

        return collect($buckets)->map(fn ($b, $key) => ['key' => $key, 'amount' => self::taka($b[0]), 'shops' => $b[1]])->values()->all();
    }

    /**
     * Built from what needs attention right now; "read" is per admin user.
     *
     * @param  SupportCollection<int, Order>  $orders
     * @param  SupportCollection<int, Shop>  $shops
     * @param  SupportCollection<int, Product>  $products
     * @param  SupportCollection<int, StockLevel>  $levels
     * @return list<array<string, mixed>>
     */
    private function notifications(SupportCollection $orders, SupportCollection $shops, SupportCollection $products, SupportCollection $levels, ?string $mainId): array
    {
        $readAt = $this->viewer->notifications_read_at;
        $items = [];
        $push = function (string $id, string $kind, array $text, string $href, ?CarbonInterface $at) use (&$items, $readAt) {
            $items[] = [
                'id' => $id,
                'kind' => $kind,
                'text' => $text,
                'href' => $href,
                'minutesAgo' => self::mins($at),
                'read' => $readAt !== null && $at !== null && $at->lte($readAt),
            ];
        };

        $pending = $orders->where('status', 'pending');
        if ($pending->isNotEmpty()) {
            $push('orders-pending', 'order', ['n' => (string) $pending->count()], '/orders?tab=pending', $pending->max('ordered_at'));
        }

        foreach ($pending->filter(fn (Order $o) => array_intersect($o->flags ?? [], ['mock', 'far_from_shop']) !== [])->take(3) as $o) {
            $push('loc-'.$o->id, 'location', ['order' => $o->number], '/orders/'.$o->number, $o->ordered_at);
        }

        foreach (Deposit::where('status', 'waiting')->orderByDesc('created_at')->limit(3)->get() as $d) {
            $name = User::find($d->user_id)->name ?? '';
            $push('dep-'.$d->id, 'deposit', ['name' => $name], '/collections?tab=deposits', $d->created_at);
        }

        $newShops = $shops->where('status', 'pending_approval');
        if ($newShops->isNotEmpty()) {
            $push('shops-pending', 'shop', ['n' => (string) $newShops->count()], '/shops?tab=pending', $newShops->max('created_at'));
        }

        $low = $products->where('active', true)->filter(function (Product $p) use ($levels, $mainId) {
            $l = $levels->first(fn ($x) => $x->warehouse_id === $mainId && $x->product_id === $p->id);

            return ($l ? $l->on_hand - $l->reserved : 0) <= $p->reorder_level;
        });
        if ($low->isNotEmpty()) {
            $push('stock-low', 'stock', ['n' => (string) $low->count()], '/stock', StockMovement::max('created_at') ? Carbon::parse(StockMovement::max('created_at')) : now());
        }

        usort($items, fn ($a, $b) => $a['minutesAgo'] <=> $b['minutesAgo']);

        return $items;
    }
}
