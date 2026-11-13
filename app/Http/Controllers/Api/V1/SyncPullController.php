<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Area;
use App\Models\Category;
use App\Models\Order;
use App\Models\PriceList;
use App\Models\Product;
use App\Models\Shop;
use App\Models\StockLevel;
use App\Models\Trip;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\ApiError;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * GET /sync/pull?entity=…&cursor=…&limit=…&overlap=1  (spec §7.3)
 *
 * Small tables come back in full ("mode": "full"); shops, products and the
 * user's own orders are incremental by (updated_at, id) and include deleted
 * rows as tombstones. `overlap=1` (first page only) re-reads the last 5 s so
 * rows committed late are not missed — the phone upserts by id.
 */
class SyncPullController extends Controller
{
    private const FULL = ['routes', 'categories', 'price_lists', 'stock', 'trips'];

    private const DELTA = ['shops', 'products', 'orders'];

    public function __invoke(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $entity = (string) $request->query('entity');

        if (in_array($entity, self::FULL, true)) {
            return response()->json(['data' => [
                'entity' => $entity,
                'mode' => 'full',
                'items' => $this->full($entity, $user),
                'next_cursor' => null,
                'has_more' => false,
            ]]);
        }

        if (! in_array($entity, self::DELTA, true)) {
            return ApiError::response('VALIDATION', 'Unknown entity.', 422);
        }

        $limit = min(max((int) $request->query('limit', 500), 1), 1000);
        [$since, $sinceId] = $this->decodeCursor($request->query('cursor'));

        if ($since && $request->boolean('overlap')) {
            $since = $since->copy()->subSeconds(5);
            $sinceId = '';
        }

        $query = $this->deltaQuery($entity, $user);

        if ($since) {
            $table = $query->getModel()->getTable();
            $query->where(fn (Builder $q) => $q
                ->where("$table.updated_at", '>', $since)
                ->orWhere(fn (Builder $q) => $q->where("$table.updated_at", $since)->where("$table.id", '>', $sinceId)));
        }

        $rows = $query->orderBy('updated_at')->orderBy('id')->limit($limit + 1)->get();
        $hasMore = $rows->count() > $limit;
        $rows = $rows->take($limit);
        $last = $rows->last();

        return response()->json(['data' => [
            'entity' => $entity,
            'mode' => 'delta',
            'items' => $rows->map(fn (Shop|Product|Order $row) => $this->present($row))->values(),
            'next_cursor' => $last ? base64_encode(json_encode([$last->updated_at->format('Y-m-d H:i:s.u'), $last->id], JSON_THROW_ON_ERROR)) : $request->query('cursor'),
            'has_more' => $hasMore,
        ]]);
    }

    /** @return array{0: Carbon|null, 1: string} */
    private function decodeCursor(?string $cursor): array
    {
        if (! $cursor) {
            return [null, ''];
        }

        $decoded = json_decode((string) base64_decode($cursor, true), true);

        return is_array($decoded) && count($decoded) === 2
            ? [Carbon::parse($decoded[0]), (string) $decoded[1]]
            : [null, ''];
    }

    /**
     * Routes this user works on (as SR or DM).
     *
     * @return list<string>
     */
    public static function routeIds(User $user): array
    {
        $routes = Area::where('type', 'route')
            ->unless($user->hasPermission('shop.view_all'), fn (Builder $query) => $query
                ->where(fn (Builder $q) => $q->where('sr_id', $user->id)->orWhere('dm_id', $user->id)
                    ->orWhereIn('id', $user->routes()->pluck('areas.id'))))
            ->get(['id']);

        return array_values($routes->map(fn (Area $r) => $r->id)->all());
    }

    /** @return Builder<Shop>|Builder<Product>|Builder<Order> */
    private function deltaQuery(string $entity, User $user): Builder
    {
        return match ($entity) {
            'shops' => Shop::withTrashed()->where(fn (Builder $q) => $q
                ->whereIn('route_id', self::routeIds($user))
                ->orWhere('created_by', $user->id)),
            'products' => Product::withTrashed(),
            'orders' => Order::with('items', 'trip:id,number')
                ->where('sales_user_id', $user->id)
                ->where('created_at', '>=', now()->subDays(30)),
            default => throw new \InvalidArgumentException("Not a delta entity: {$entity}"),
        };
    }

    /** @return array<string, mixed> */
    private function present(Shop|Product|Order $row): array
    {
        return match (true) {
            $row instanceof Shop => [
                'id' => $row->id,
                'deleted' => $row->trashed() || $row->status === 'inactive',
                'route_id' => $row->route_id,
                'code' => $row->code,
                'name' => $row->name,
                'name_bn' => $row->name_bn,
                'owner_name' => $row->owner_name,
                'phone' => $row->phone,
                'category' => $row->category,
                'lat' => $row->lat,
                'lng' => $row->lng,
                'credit_limit' => (int) $row->credit_limit,
                'due' => (int) $row->due,
                'status' => $row->status,
                'last_order_at' => $row->last_order_at?->toIso8601ZuluString(),
            ],
            $row instanceof Product => [
                'id' => $row->id,
                'deleted' => $row->trashed(),
                'category_id' => $row->category_id,
                'sku' => $row->sku,
                'name' => $row->name,
                'name_bn' => $row->name_bn,
                'brand' => $row->brand,
                'pack_size' => (int) $row->pack_size,
                'mrp' => (int) $row->mrp,
                'price' => (int) $row->price,
                'active' => (bool) $row->active,
            ],
            default => self::presentOrder($row),
        };
    }

    /** @return array<string, mixed> */
    public static function presentOrder(Order $order): array
    {
        return [
            'id' => $order->id,
            'deleted' => false,
            'number' => $order->number,
            'shop_id' => $order->shop_id,
            'status' => $order->status,
            'ordered_at' => $order->ordered_at->toIso8601ZuluString(),
            'subtotal' => (int) $order->subtotal,
            'discount' => (int) $order->discount,
            'total' => (int) $order->total,
            'paid' => (int) $order->paid,
            'note' => $order->note,
            'reject_reason' => $order->reject_reason,
            'trip_number' => $order->trip?->number,
            'items' => $order->items->map(fn ($i) => [
                'id' => $i->id,
                'product_id' => $i->product_id,
                'qty' => (int) $i->qty,
                'unit_price' => (int) $i->unit_price,
                'discount' => (int) $i->discount,
                'line_total' => (int) $i->line_total,
                'delivered_qty' => $i->delivered_qty,
            ])->values(),
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function full(string $entity, User $user): array
    {
        return match ($entity) {
            'routes' => Area::where('type', 'route')->whereIn('id', self::routeIds($user))->orderBy('sort')->get()
                ->map(fn (Area $r) => ['id' => $r->id, 'name' => $r->name, 'code' => $r->code, 'visit_days' => $r->visit_days ?? []])->all(),
            'categories' => Category::orderBy('sort')->get()
                ->map(fn (Category $c) => ['id' => $c->id, 'key' => $c->key, 'name' => $c->name, 'name_bn' => $c->name_bn, 'sort' => $c->sort])->all(),
            'price_lists' => PriceList::with('items')->get()->map(fn (PriceList $l) => [
                'id' => $l->id,
                'applies_to' => $l->applies_to,
                'target' => $l->target,
                'items' => $l->items->map(fn ($i) => ['product_id' => $i->product_id, 'unit_price' => (int) $i->unit_price])->values(),
            ])->all(),
            'stock' => $this->stock(),
            'trips' => $this->trips($user),
            default => throw new \InvalidArgumentException("Not a full entity: {$entity}"),
        };
    }

    /** @return array<int, array{product_id: string, available: int}> */
    private function stock(): array
    {
        $main = Warehouse::where('type', 'main')->value('id');

        return StockLevel::where('warehouse_id', $main)->get()
            ->map(fn (StockLevel $s) => ['product_id' => $s->product_id, 'available' => (int) ($s->on_hand - $s->reserved)])->all();
    }

    /**
     * Delivery man: open trips with their orders, items and shop details.
     *
     * @return array<int, array<string, mixed>>
     */
    private function trips(User $user): array
    {
        if (! $user->hasPermission('app.delivery')) {
            return [];
        }

        return Trip::with(['route:id,name', 'orders.items', 'orders.shop'])
            ->where('delivery_user_id', $user->id)
            ->where(fn (Builder $q) => $q->where('status', '!=', 'closed')->orWhere('closed_at', '>=', now()->subDay()))
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Trip $t) => [
                'id' => $t->id,
                'number' => $t->number,
                'route' => $t->route?->name,
                'vehicle' => $t->vehicle,
                'status' => $t->status,
                'cash_collected' => (int) $t->cash_collected,
                'orders' => $t->orders->map(fn (Order $o) => [
                    ...self::presentOrder($o),
                    'shop' => [
                        'id' => $o->shop->id,
                        'name' => $o->shop->name,
                        'name_bn' => $o->shop->name_bn,
                        'owner_name' => $o->shop->owner_name,
                        'phone' => $o->shop->phone,
                        'lat' => $o->shop->lat,
                        'lng' => $o->shop->lng,
                        'due' => (int) $o->shop->due,
                    ],
                ])->values(),
            ])->all();
    }
}
