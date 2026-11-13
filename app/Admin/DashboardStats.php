<?php

namespace App\Admin;

use App\Models\Area;
use App\Models\Collection;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Shop;
use App\Models\Trip;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Support\Collection as SupportCollection;

/**
 * Dashboard numbers (spec §11.1), computed in PHP from plain rows so the same
 * code runs on SQLite (local) and MySQL (cPanel) without date functions.
 */
class DashboardStats
{
    private const LIVE = ['pending', 'approved', 'dispatched', 'delivered', 'partially_delivered', 'failed'];

    private const DONE = ['delivered', 'partially_delivered'];

    /**
     * @param  array<int, string>  $codes  user id → staff code
     * @param  array<string, string>  $routeNames  route id → name
     */
    public function __construct(private readonly array $codes, private readonly array $routeNames) {}

    /**
     * @param  SupportCollection<int, Order>  $orders
     * @param  SupportCollection<int, Shop>  $shops
     * @param  SupportCollection<int, User>  $users
     * @param  SupportCollection<int, Product>  $products
     * @param  SupportCollection<int, Area>  $areas
     * @return array<string, mixed>
     */
    public function build(SupportCollection $orders, SupportCollection $shops, SupportCollection $users, SupportCollection $products, SupportCollection $areas): array
    {
        $yearAgo = now()->subMonths(12)->startOfMonth();
        // Two periods back so "change vs previous period" works for 12 months too.
        // Plain rows with integer timestamps: Eloquent date casts re-parse on
        // every access, which is far too slow inside the bucket loops below.
        $history = Order::where('ordered_at', '>=', $yearAgo->copy()->subMonths(12))
            ->get(['id', 'status', 'ordered_at', 'delivered_at', 'total', 'sales_user_id', 'shop_id'])
            ->map(fn (Order $o) => (object) [
                'status' => $o->status,
                'ordered_at' => $o->ordered_at->getTimestamp(),
                'delivered_at' => $o->delivered_at?->getTimestamp(),
                'total' => (int) $o->total,
                'sales_user_id' => $o->sales_user_id,
                'shop_id' => $o->shop_id,
            ]);
        $collections = Collection::where('collected_at', '>=', $yearAgo->copy()->subMonths(12))
            ->where('status', '!=', 'rejected')
            ->get(['amount', 'method', 'collected_at', 'status', 'deposit_id'])
            ->map(fn (Collection $c) => (object) [
                'amount' => (int) $c->amount,
                'method' => $c->method,
                'collected_at' => $c->collected_at->getTimestamp(),
                'status' => $c->status,
                'deposit_id' => $c->deposit_id,
            ]);
        $dueNow = (int) $shops->sum('due');
        $d30 = now()->subDays(30)->getTimestamp();

        $trends = [];
        $kpis = [];
        foreach (['7d', '30d', '12m'] as $period) {
            $buckets = $this->buckets($period);
            $trends[$period] = $this->trend($buckets, $history, $period);
            $kpis[$period] = $this->kpis($period, $buckets, $history, $collections, $dueNow);
        }

        $today = now()->startOfDay();
        $todayTs = $today->getTimestamp();
        $todayKey = strtolower(now()->format('D'));
        $routes = $areas->where('type', 'route');
        $todayRoutes = $routes->filter(fn (Area $r) => in_array($todayKey, $r->visit_days ?? [], true));
        $visitsToday = Visit::where('checked_in_at', '>=', $today)->get(['user_id', 'shop_id']);
        $ordersToday = $history->filter(fn ($o) => $o->ordered_at >= $todayTs && in_array($o->status, self::LIVE, true));
        $last30 = $history->filter(fn ($o) => $o->ordered_at >= $d30 && in_array($o->status, self::LIVE, true));
        $avgOrder = $last30->count() ? (int) round($last30->avg('total') / 100) : 0;

        $appUsers = $users->filter(fn (User $u) => $u->status === 'active' && $u->canUseApp());
        $salesReps = $appUsers->filter(fn (User $u) => $u->hasPermission('app.sales'))->map(function (User $u) use ($todayRoutes, $routes, $shops, $visitsToday, $ordersToday) {
            $mine = $todayRoutes->filter(fn (Area $r) => $r->sr_id === $u->id || $u->routes->contains('id', $r->id));
            $route = $mine->first() ?? $routes->first(fn (Area $r) => $r->sr_id === $u->id);
            $myOrders = $ordersToday->where('sales_user_id', $u->id);
            $visited = $myOrders->pluck('shop_id')->merge($visitsToday->where('user_id', $u->id)->pluck('shop_id'))->unique();

            return [
                'name' => $u->name,
                'code' => $this->codes[$u->id] ?? '',
                'route' => $route->name ?? '—',
                'visited' => $visited->count(),
                'planned' => $shops->whereIn('route_id', $mine->pluck('id'))->where('status', 'active')->count(),
                'orders' => $myOrders->count(),
                'sales' => AdminState::taka($myOrders->sum('total')),
                'lastSyncMin' => $u->last_seen_at ? AdminState::mins($u->last_seen_at) : 9999,
            ];
        })->sortByDesc('sales')->values();

        $openTrips = Trip::withCount([
            'orders',
            'orders as done_count' => fn ($q) => $q->whereIn('status', ['delivered', 'partially_delivered', 'failed']),
        ])->where('status', '!=', 'closed')->orderByDesc('created_at')->get();
        $deliveryMen = $appUsers->filter(fn (User $u) => $u->hasPermission('app.delivery'))->map(function (User $u) use ($openTrips) {
            $trip = $openTrips->firstWhere('delivery_user_id', $u->id);

            return [
                'name' => $u->name,
                'code' => $this->codes[$u->id] ?? '',
                'trip' => $trip ? $trip->number.' · '.($this->routeNames[$trip->route_id] ?? '') : '—',
                'delivered' => (int) ($trip->done_count ?? 0),
                'total' => (int) ($trip->orders_count ?? 0),
                'cash' => AdminState::taka($trip->cash_collected ?? 0),
                'lastSyncMin' => $u->last_seen_at ? AdminState::mins($u->last_seen_at) : 9999,
            ];
        })->values();

        $plannedToday = $shops->whereIn('route_id', $todayRoutes->pluck('id'))->where('status', 'active')->count();
        $visitedToday = $ordersToday->pluck('shop_id')->merge($visitsToday->pluck('shop_id'))->unique()->count();

        $delivered30 = $history->filter(fn ($o) => $o->delivered_at && $o->delivered_at >= $d30 && in_array($o->status, self::DONE, true))->sum('total');
        $collected30 = $collections->filter(fn ($c) => $c->collected_at >= $d30);

        $byMethod = ['cash' => 0, 'bkash' => 0, 'nagad' => 0, 'bank' => 0];
        foreach ($collected30 as $c) {
            // Rocket and cheques are shown with bank transfers ("other").
            $byMethod[array_key_exists($c->method, $byMethod) ? $c->method : 'bank'] += (int) $c->amount;
        }

        $shopsWithDue = $shops->where('due', '>', 0)->count();
        $overLimit = $shops->filter(fn (Shop $s) => $s->credit_limit > 0 && $s->due > $s->credit_limit)->count();

        return [
            'trends' => $trends,
            'kpis' => $kpis,
            'kpiFacts' => [
                'avgOrder' => $avgOrder,
                'collectedShare' => $delivered30 > 0 ? (int) min(100, round($collected30->sum('amount') / $delivered30 * 100)) : 0,
                'shopsWithDue' => $shopsWithDue,
                'overLimit' => $overLimit,
            ],
            'salesReps' => $salesReps,
            'deliveryMen' => $deliveryMen,
            'fieldToday' => [
                'onDuty' => $appUsers->filter(fn (User $u) => $u->last_seen_at && $u->last_seen_at >= now()->startOfDay())->count(),
                'staff' => $appUsers->count(),
                'visited' => $visitedToday,
                'planned' => max($plannedToday, $visitedToday),
                'ordersFromVisits' => $ordersToday->count(),
                'avgOrder' => $avgOrder,
            ],
            'topProducts' => $this->topProducts($products),
            'collectionsByMethod' => collect($byMethod)->keys()->map(fn ($k, $i) => [
                'key' => $k, 'amount' => AdminState::taka($byMethod[$k]), 'color' => 'var(--chart-'.($i + 1).')',
            ])->values(),
            'cashWithStaff' => AdminState::taka($collections->where('method', 'cash')->where('status', 'pending')->whereNull('deposit_id')->sum('amount')),
            'shopHealth' => [
                'total' => $shops->count(),
                'active30d' => $shops->filter(fn (Shop $s) => $s->last_order_at && $s->last_order_at >= now()->subDays(30))->count(),
                'noOrder30d' => $shops->filter(fn (Shop $s) => $s->status === 'active' && (! $s->last_order_at || $s->last_order_at < now()->subDays(30)))->count(),
                'withDue' => $shopsWithDue,
                'overLimit' => $overLimit,
                'newThisMonth' => $shops->filter(fn (Shop $s) => $s->created_at >= now()->startOfMonth())->count(),
                'pendingApproval' => $shops->where('status', 'pending_approval')->count(),
            ],
        ];
    }

    /** @return list<array{0: int, 1: int, 2: string}> [start, end) timestamps + label per point */
    private function buckets(string $period): array
    {
        if ($period === '12m') {
            $month = now()->startOfMonth();

            return array_map(fn ($i) => [$month->subMonths($i)->getTimestamp(), $month->subMonths($i - 1)->getTimestamp(), $month->subMonths($i)->format('Y-m-d')], range(11, 0));
        }
        $days = $period === '7d' ? 7 : 30;

        $day = now()->startOfDay();

        return array_map(fn ($i) => [$day->subDays($i)->getTimestamp(), $day->subDays($i - 1)->getTimestamp(), $day->subDays($i)->format('Y-m-d')], range($days - 1, 0));
    }

    /** Is the timestamp inside [from, to)? */
    private function between(?int $at, int $from, int $to): bool
    {
        return $at !== null && $at >= $from && $at < $to;
    }

    /**
     * @template THistory of \stdClass
     *
     * @param  list<array{0: int, 1: int, 2: string}>  $buckets
     * @param  SupportCollection<int, THistory>  $history
     * @return list<array{date: string, ordered: float|int, delivered: float|int}>
     */
    private function trend(array $buckets, SupportCollection $history, string $period): array
    {
        return array_map(fn ($b) => [
            'date' => $b[2],
            'ordered' => AdminState::taka($history->filter(fn ($o) => in_array($o->status, self::LIVE, true) && $this->between($o->ordered_at, $b[0], $b[1]))->sum('total')),
            'delivered' => AdminState::taka($history->filter(fn ($o) => in_array($o->status, self::DONE, true) && $this->between($o->delivered_at, $b[0], $b[1]))->sum('total')),
        ], $buckets);
    }

    /**
     * @template THistory of \stdClass
     * @template TCollection of \stdClass
     *
     * @param  list<array{0: int, 1: int, 2: string}>  $buckets
     * @param  SupportCollection<int, THistory>  $history
     * @param  SupportCollection<int, TCollection>  $collections
     * @return list<array<string, mixed>>
     */
    private function kpis(string $period, array $buckets, SupportCollection $history, SupportCollection $collections, int $dueNow): array
    {
        $start = $buckets[0][0];
        $prevStart = $period === '12m' ? now()->startOfMonth()->subMonths(23)->getTimestamp() : $start - count($buckets) * 86400;
        $cur = [$start, PHP_INT_MAX];
        $prev = [$prevStart, $start];

        $live = fn (int $from, int $to) => $history->filter(fn ($o) => in_array($o->status, self::LIVE, true) && $this->between($o->ordered_at, $from, $to));
        $paid = fn (int $from, int $to) => $collections->filter(fn ($c) => $this->between($c->collected_at, $from, $to))->sum('amount');
        $delivered = fn (int $from, int $to) => $history->filter(fn ($o) => in_array($o->status, self::DONE, true) && $this->between($o->delivered_at, $from, $to))->sum('total');
        $change = fn ($a, $b) => $b > 0 ? round(($a - $b) / $b * 100, 1) : 0;

        // Dues back then = dues now − delivered since + collected since.
        $dueAt = fn (int $at) => $dueNow - $delivered($at, PHP_INT_MAX) + $paid($at, PHP_INT_MAX);
        $duePrev = $dueAt($start);

        return [
            [
                'key' => 'sales', 'money' => true, 'goodWhenUp' => true,
                'value' => AdminState::taka($live(...$cur)->sum('total')),
                'change' => $change($live(...$cur)->sum('total'), $live(...$prev)->sum('total')),
                'spark' => array_map(fn ($b) => AdminState::taka($live($b[0], $b[1])->sum('total')), $buckets),
            ],
            [
                'key' => 'orders', 'money' => false, 'goodWhenUp' => true,
                'value' => $live(...$cur)->count(),
                'change' => $change($live(...$cur)->count(), $live(...$prev)->count()),
                'spark' => array_map(fn ($b) => $live($b[0], $b[1])->count(), $buckets),
            ],
            [
                'key' => 'collections', 'money' => true, 'goodWhenUp' => true,
                'value' => AdminState::taka($paid(...$cur)),
                'change' => $change($paid(...$cur), $paid(...$prev)),
                'spark' => array_map(fn ($b) => AdminState::taka($paid($b[0], $b[1])), $buckets),
            ],
            [
                'key' => 'dues', 'money' => true, 'goodWhenUp' => false,
                'value' => AdminState::taka($dueNow),
                'change' => $change($dueNow, $duePrev),
                'spark' => array_map(fn ($b) => AdminState::taka(max(0, $dueAt($b[1]))), $buckets),
            ],
        ];
    }

    /**
     * @param  SupportCollection<int, Product>  $products
     * @return array<int, array<string, mixed>>
     */
    private function topProducts(SupportCollection $products): array
    {
        $items = OrderItem::whereHas('order', fn ($q) => $q->where('ordered_at', '>=', now()->subDays(30))->whereIn('status', self::LIVE))
            ->get(['product_id', 'qty', 'line_total']);
        $byId = $products->keyBy('id');

        return $items->groupBy('product_id')->map(function ($rows, $id) use ($byId) {
            $p = $byId[$id] ?? null;

            return [
                'name' => $p->name ?? '—',
                'name_bn' => $p->name_bn ?? $p->name ?? '—',
                'sku' => $p->sku ?? '',
                'sales' => AdminState::taka($rows->sum('line_total')),
                'cartons' => (int) floor($rows->sum('qty') / max(1, $p->pack_size ?? 1)),
            ];
        })->sortByDesc('sales')->take(5)->values()->all();
    }
}
