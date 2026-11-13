<?php

namespace App\Sync;

use App\Http\Controllers\Api\V1\SyncPullController;
use App\Models\Area;
use App\Models\Collection;
use App\Models\LocationPing;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PriceList;
use App\Models\Product;
use App\Models\Shop;
use App\Models\StockLevel;
use App\Models\StockMovement;
use App\Models\Trip;
use App\Models\User;
use App\Models\Visit;
use App\Models\Warehouse;
use App\Support\Phone;
use App\Support\Tenancy\TenantContext;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * Applies one outbox operation from the phone (spec §7.5 / §7.6 / §10.5).
 * Every operation runs in its own transaction and is idempotent by the
 * phone-generated ULID (+ client_version for orders).
 *
 * Operation payloads come straight from the phone, so `$data` is untrusted
 * `array<mixed>` everywhere below.
 *
 * @phpstan-type PushResult array{entity: string, id: string, result: string, error?: array{code: string, message: string}, server?: array<string, mixed>}
 * @phpstan-type LocationFix array{lat: float|null, lng: float|null, location_accuracy_m: int<0, max>|null, location_at: CarbonInterface|null, distance_from_shop_m: int|null, is_mock_location: bool}
 */
class PushProcessor
{
    /** @var EloquentCollection<int, PriceList>|null Price lists, loaded once per push batch. */
    private ?EloquentCollection $priceLists = null;

    public function __construct(private readonly User $user) {}

    /** A record id sent by the phone; anything that is not a scalar id matches nothing. */
    private static function key(mixed $value): string
    {
        return is_string($value) || is_int($value) ? (string) $value : '';
    }

    /**
     * @param  array<mixed>  $op
     * @return PushResult
     */
    public function apply(array $op): array
    {
        $entity = (string) ($op['entity'] ?? '');
        $id = (string) ($op['id'] ?? '');
        $data = (array) ($op['data'] ?? []);

        try {
            return DB::transaction(fn () => match ($entity) {
                'shop' => $this->shop($id, $data),
                'order' => $this->order($id, (int) ($op['client_version'] ?? 1), $data),
                'visit' => $this->visit($id, $data),
                'delivery' => $this->delivery($id, $data),
                'collection' => $this->collection($id, $data),
                'trip_status' => $this->tripStatus($id, $data),
                'location_ping' => $this->pings($id, $data),
                default => throw new PushRejected('VALIDATION', 'Unknown entity.'),
            });
        } catch (PushRejected $e) {
            return ['entity' => $entity, 'id' => $id, 'result' => 'rejected', 'error' => ['code' => $e->errorCode, 'message' => $e->getMessage()]];
        } catch (Throwable $e) {
            report($e);

            return ['entity' => $entity, 'id' => $id, 'result' => 'retry', 'error' => ['code' => 'SERVER', 'message' => 'Temporary server problem.']];
        }
    }

    private function can(string $permission): void
    {
        if (! $this->user->hasPermission($permission)) {
            throw new PushRejected('PERMISSION_DENIED', 'You are not allowed to do this.');
        }
    }

    /**
     * @param  array<string, mixed>  $server
     * @return PushResult
     */
    private function ok(string $entity, string $id, array $server = [], string $result = 'accepted'): array
    {
        return ['entity' => $entity, 'id' => $id, 'result' => $result, 'server' => $server];
    }

    /* ------------------------------------------------------------------ */

    /**
     * @param  array<mixed>  $data
     * @return PushResult
     */
    private function shop(string $id, array $data): array
    {
        $shop = Shop::withTrashed()->find($id);

        if ($shop) {
            // SR may only fix contact details / location of an existing shop (spec §7.6).
            $editable = $shop->created_by === $this->user->id && $shop->status === 'pending_approval'
                ? ['name', 'name_bn', 'owner_name', 'phone', 'category', 'route_id', 'lat', 'lng', 'location_accuracy_m']
                : ['phone', 'owner_name'];
            $shop->update(Arr::only($this->shopFields($data), $editable));

            return $this->ok('shop', $id, ['status' => $shop->status, 'code' => $shop->code]);
        }

        $this->can('shop.create');

        if (trim((string) ($data['name'] ?? '')) === '') {
            throw new PushRejected('VALIDATION', 'Shop name is required.');
        }

        $shop = new Shop($this->shopFields($data));
        $shop->id = $id;
        $shop->code = $this->nextShopCode();
        $shop->status = 'pending_approval';
        $shop->created_by = $this->user->id;
        $shop->device_id = $data['device_id'] ?? null;
        $shop->save();

        return $this->ok('shop', $id, ['status' => $shop->status, 'code' => $shop->code]);
    }

    /**
     * @param  array<mixed>  $data
     * @return array<string, mixed>
     */
    private function shopFields(array $data): array
    {
        $routeIds = SyncPullController::routeIds($this->user);
        $route = in_array($data['route_id'] ?? null, $routeIds, true) ? $data['route_id'] : ($routeIds[0] ?? null);

        return array_filter([
            'name' => isset($data['name']) ? trim((string) $data['name']) : null,
            'name_bn' => isset($data['name_bn']) ? trim((string) $data['name_bn']) : null,
            'owner_name' => isset($data['owner_name']) ? trim((string) $data['owner_name']) : null,
            'phone' => isset($data['phone']) ? Phone::normalize($data['phone']) : null,
            'category' => in_array($data['category'] ?? null, ['grocery', 'pharmacy', 'wholesale', 'tea_stall'], true) ? $data['category'] : null,
            'route_id' => $route,
            'lat' => $data['lat'] ?? null,
            'lng' => $data['lng'] ?? null,
            'location_accuracy_m' => isset($data['accuracy_m']) ? max(0, (int) $data['accuracy_m']) : null,
        ], fn ($v) => $v !== null && $v !== '');
    }

    private function nextShopCode(): string
    {
        $max = Shop::withTrashed()->pluck('code')->map(fn ($c) => (int) preg_replace('/\D/', '', $c))->max() ?? 5000;

        return 'SH-'.str_pad((string) ($max + 1), 5, '0', STR_PAD_LEFT);
    }

    /* ------------------------------------------------------------------ */

    /**
     * @param  array<mixed>  $data
     * @return PushResult
     */
    private function order(string $id, int $version, array $data): array
    {
        $this->can('order.create');
        $tenant = TenantContext::get();
        $order = Order::find($id);

        if ($order) {
            if ($version <= $order->client_version) {
                return $this->ok('order', $id, $this->orderServer($order), 'duplicate');
            }

            if ($order->status !== 'pending' || $order->sales_user_id !== $this->user->id) {
                throw new PushRejected('ORDER_LOCKED', 'This order was already handled by the office.');
            }
        }

        $shop = Shop::find(self::key($data['shop_id'] ?? null));

        if (! $shop || $shop->status === 'inactive') {
            throw new PushRejected('SHOP_INACTIVE', 'This shop is not active.');
        }

        $lines = (array) ($data['items'] ?? []);

        if (count($lines) === 0) {
            throw new PushRejected('VALIDATION', 'The order has no items.');
        }

        $products = Product::whereIn('id', array_column($lines, 'product_id'))->get()->keyBy('id');
        $flags = [];
        $subtotal = 0;
        $items = [];

        foreach ($lines as $line) {
            $product = $products->get($line['product_id'] ?? '');
            $qty = (int) ($line['qty'] ?? 0);

            if (! $product || ! $product->active) {
                throw new PushRejected('PRODUCT_INACTIVE', 'A product in this order is no longer sold.');
            }

            if ($qty <= 0) {
                continue;
            }

            $listPrice = $this->priceFor($shop, $product);
            $price = (int) ($line['unit_price'] ?? $listPrice);

            if ($price !== $listPrice && ! $this->user->hasPermission('order.edit_price')) {
                $flags[] = 'price_changed';
                $price = $listPrice;
            }

            $subtotal += $qty * $price;
            $items[] = ['id' => $line['id'] ?? null, 'product_id' => $product->id, 'qty' => $qty, 'unit_price' => $price, 'line_total' => $qty * $price];
        }

        $discount = $this->user->hasPermission('order.give_discount') ? max(0, (int) ($data['discount'] ?? 0)) : 0;

        if ($discount > $subtotal * $tenant->setting('maxDiscount') / 100) {
            throw new PushRejected('DISCOUNT_LIMIT', 'The discount is more than allowed.');
        }

        $total = $subtotal - $discount;
        $location = $this->checkLocation($data, $shop, $flags);

        if ($shop->credit_limit > 0 && $shop->due + $total > $shop->credit_limit) {
            if ($tenant->setting('creditMode') === 'block' && ! $this->user->hasPermission('order.over_credit_limit')) {
                throw new PushRejected('CREDIT_LIMIT', 'This order is over the shop\'s credit limit.');
            }

            $flags[] = 'over_credit';
        }

        $order ??= new Order(['id' => $id]);
        $order->id = $id;
        $number = (string) ($data['number'] ?? $id);

        if (Order::where('number', $number)->where('id', '!=', $id)->exists()) {
            $number .= '-'.substr($id, -4);
        }

        $auto = (bool) $tenant->setting('autoApprove');
        $order->fill([
            'number' => $number,
            'shop_id' => $shop->id,
            'sales_user_id' => $this->user->id,
            'status' => $auto ? 'approved' : 'pending',
            'ordered_at' => Carbon::parse($data['ordered_at'] ?? now()),
            'subtotal' => $subtotal,
            'discount' => $discount,
            'total' => $total,
            'note' => $data['note'] ?? null,
            'flags' => array_values(array_unique($flags)),
            'client_version' => $version,
            'device_id' => $data['device_id'] ?? null,
            'approved_at' => $auto ? now() : null,
            ...$location,
        ]);
        $order->save();

        $order->items()->delete();

        foreach ($items as $item) {
            $row = new OrderItem(Arr::except($item, 'id'));
            $row->id = $item['id'] ?: (string) Str::ulid();
            $row->order_id = $order->id;
            $row->save();
        }

        $shop->last_order_at = now();

        // Shop without a saved location: take it from a good order fix (spec §10.5).
        if ($shop->lat === null && $location['lat'] !== null && $tenant->setting('shopFromOrder')
            && ! $location['is_mock_location'] && ($location['location_accuracy_m'] ?? 999) <= $tenant->setting('maxAccuracy')) {
            $shop->lat = $location['lat'];
            $shop->lng = $location['lng'];
            $shop->location_accuracy_m = $location['location_accuracy_m'];
        }

        $shop->save();

        return $this->ok('order', $id, $this->orderServer($order->refresh()));
    }

    /**
     * Live-location rules for orders (spec §10.5). Adds flags; may reject.
     *
     * @param  array<mixed>  $data
     * @param  list<string>  $flags
     * @return LocationFix
     */
    private function checkLocation(array $data, Shop $shop, array &$flags): array
    {
        $tenant = TenantContext::get();
        $lat = isset($data['lat']) ? (float) $data['lat'] : null;
        $lng = isset($data['lng']) ? (float) $data['lng'] : null;
        // Accuracy columns are unsigned: a bad negative reading from the phone must not fail the insert.
        $accuracy = isset($data['accuracy_m']) ? max(0, (int) round((float) $data['accuracy_m'])) : null;
        $mock = (bool) ($data['is_mock'] ?? false);

        if ($lat === null || $lng === null) {
            if ($tenant->setting('locationMode') === 'required') {
                throw new PushRejected('LOCATION_REQUIRED', 'A GPS location is required to save an order.');
            }

            $flags[] = 'no_location';

            return ['lat' => null, 'lng' => null, 'location_accuracy_m' => null, 'location_at' => null, 'distance_from_shop_m' => null, 'is_mock_location' => false];
        }

        if ($mock) {
            if ($tenant->setting('blockMock')) {
                throw new PushRejected('MOCK_LOCATION', 'Fake GPS is not allowed.');
            }

            $flags[] = 'mock';
        }

        if ($accuracy !== null && $accuracy > $tenant->setting('maxAccuracy')) {
            $flags[] = 'low_accuracy';
        }

        $distance = $shop->lat !== null ? self::distanceM($lat, $lng, (float) $shop->lat, (float) $shop->lng) : null;

        if ($distance !== null && $distance > $tenant->setting('geofence')) {
            $flags[] = 'far_from_shop';
        }

        return [
            'lat' => $lat,
            'lng' => $lng,
            'location_accuracy_m' => $accuracy,
            'location_at' => isset($data['location_at']) ? Carbon::parse($data['location_at']) : now(),
            'distance_from_shop_m' => $distance,
            'is_mock_location' => $mock,
        ];
    }

    public static function distanceM(float $lat1, float $lng1, float $lat2, float $lng2): int
    {
        $r = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return (int) round($r * 2 * atan2(sqrt($a), sqrt(1 - $a)));
    }

    /** Price list resolution: shop type list → route list → default price. */
    public function priceFor(Shop $shop, Product $product): int
    {
        $lists = $this->priceLists ??= PriceList::with('items')->get();

        $route = $shop->route_id ? Area::find($shop->route_id)?->name : null;

        foreach ([['shop_category', $shop->category], ['area', $route]] as [$type, $target]) {
            $list = $lists->first(fn ($l) => $l->applies_to === $type && $l->target === $target);
            $item = $list?->items->firstWhere('product_id', $product->id);

            if ($item) {
                return (int) $item->unit_price;
            }
        }

        return (int) $product->price;
    }

    /** @return array<string, mixed> */
    private function orderServer(Order $order): array
    {
        return ['status' => $order->status, 'number' => $order->number, 'total' => (int) $order->total, 'flags' => $order->flags ?? []];
    }

    /* ------------------------------------------------------------------ */

    /**
     * @param  array<mixed>  $data
     * @return PushResult
     */
    private function visit(string $id, array $data): array
    {
        if (Visit::whereKey($id)->exists()) {
            return $this->ok('visit', $id, [], 'duplicate');
        }

        $visit = new Visit([
            'user_id' => $this->user->id,
            'shop_id' => $data['shop_id'],
            'outcome' => $data['outcome'] ?? 'no_order',
            'no_order_reason' => $data['no_order_reason'] ?? null,
            'lat' => $data['lat'] ?? null,
            'lng' => $data['lng'] ?? null,
            'accuracy_m' => isset($data['accuracy_m']) ? max(0, (int) $data['accuracy_m']) : null,
            'checked_in_at' => Carbon::parse($data['checked_in_at'] ?? now()),
        ]);
        $visit->id = $id;
        $visit->save();

        return $this->ok('visit', $id);
    }

    /**
     * Delivery man finished an order: delivered / partial / failed (spec §9.2).
     *
     * @param  array<mixed>  $data
     * @return PushResult
     */
    private function delivery(string $id, array $data): array
    {
        $this->can('delivery.complete');
        $order = Order::with('items', 'trip', 'shop')->find(self::key($data['order_id'] ?? $id));

        if (! $order || $order->trip?->delivery_user_id !== $this->user->id) {
            throw new PushRejected('PERMISSION_DENIED', 'This order is not on your trip.');
        }

        if (in_array($order->status, ['delivered', 'partially_delivered', 'failed'], true)) {
            return $this->ok('delivery', $id, ['status' => $order->status], 'duplicate');
        }

        $result = $data['result'] ?? 'delivered';

        if ($result === 'failed') {
            $order->update(['status' => 'failed', 'reject_reason' => $data['reason'] ?? null]);

            return $this->ok('delivery', $id, ['status' => 'failed']);
        }

        $delivered = collect((array) ($data['items'] ?? []))->pluck('delivered_qty', 'id');
        $value = 0;
        $partial = false;
        $warehouse = Warehouse::where('type', 'main')->value('id');

        foreach ($order->items as $item) {
            $qty = (int) ($delivered[$item->id] ?? $item->qty);
            $qty = max(0, min($qty, $item->qty));
            $partial = $partial || $qty < $item->qty;
            $item->update(['delivered_qty' => $qty]);
            $value += $qty * $item->unit_price;

            if ($warehouse && $qty > 0) {
                // Row is locked for this transaction; both columns are unsigned, so never go below 0.
                $level = StockLevel::where('warehouse_id', $warehouse)->where('product_id', $item->product_id)->lockForUpdate()->first();
                $level?->update([
                    'on_hand' => max(0, $level->on_hand - $qty),
                    'reserved' => max(0, $level->reserved - $qty),
                ]);
                StockMovement::create(['warehouse_id' => $warehouse, 'product_id' => $item->product_id, 'qty' => -$qty, 'type' => 'deliver', 'reference' => $order->number, 'user_id' => $this->user->id]);
            }
        }

        $order->update([
            'status' => $partial ? 'partially_delivered' : 'delivered',
            'total' => $value - min($order->discount, $value),
            'delivered_at' => Carbon::parse($data['at'] ?? now()),
        ]);
        $order->shop->increment('due', $order->total);

        return $this->ok('delivery', $id, ['status' => $order->status, 'total' => (int) $order->total]);
    }

    /**
     * @param  array<mixed>  $data
     * @return PushResult
     */
    private function collection(string $id, array $data): array
    {
        $this->can('collection.create');

        if (Collection::whereKey($id)->exists()) {
            return $this->ok('collection', $id, [], 'duplicate');
        }

        $amount = (int) ($data['amount'] ?? 0);
        $shop = Shop::find(self::key($data['shop_id'] ?? null));

        if ($amount <= 0 || ! $shop) {
            throw new PushRejected('VALIDATION', 'Amount and shop are required.');
        }

        $method = in_array($data['method'] ?? 'cash', ['cash', 'bkash', 'nagad', 'rocket', 'bank', 'cheque'], true) ? $data['method'] : 'cash';
        $number = (string) ($data['number'] ?? 'CL-'.substr($id, -8));

        if (Collection::where('number', $number)->exists()) {
            $number .= '-'.substr($id, -4);
        }

        $collection = new Collection([
            'number' => $number,
            'shop_id' => $shop->id,
            'order_id' => $data['order_id'] ?? null,
            'user_id' => $this->user->id,
            'method' => $method,
            'reference' => $data['reference'] ?? null,
            'amount' => $amount,
            'status' => 'pending',
            'collected_at' => Carbon::parse($data['collected_at'] ?? now()),
            'lat' => $data['lat'] ?? null,
            'lng' => $data['lng'] ?? null,
            'device_id' => $data['device_id'] ?? null,
        ]);
        $collection->id = $id;
        $collection->save();

        $shop->decrement('due', $amount);

        if ($collection->order_id) {
            Order::whereKey($collection->order_id)->increment('paid', $amount);
        }

        Trip::whereHas('orders', fn ($q) => $q->whereKey($collection->order_id))
            ->where('delivery_user_id', $this->user->id)
            ->increment('cash_collected', $method === 'cash' ? $amount : 0);

        return $this->ok('collection', $id, ['number' => $number, 'status' => 'pending']);
    }

    /**
     * @param  array<mixed>  $data
     * @return PushResult
     */
    private function tripStatus(string $id, array $data): array
    {
        $trip = Trip::where('delivery_user_id', $this->user->id)->find(self::key($data['trip_id'] ?? $id));
        $status = $data['status'] ?? '';

        if (! $trip || ! in_array($status, ['loaded', 'in_progress'], true)) {
            throw new PushRejected('VALIDATION', 'Unknown trip or status.');
        }

        if ($trip->status !== 'closed') {
            $trip->update(['status' => $status]);
        }

        return $this->ok('trip_status', $id, ['status' => $trip->status]);
    }

    /**
     * @param  array<mixed>  $data
     * @return PushResult
     */
    private function pings(string $id, array $data): array
    {
        foreach (array_slice((array) ($data['pings'] ?? []), 0, 500) as $p) {
            LocationPing::create([
                'user_id' => $this->user->id,
                'source' => $p['source'] ?? 'order',
                'ref_id' => $p['ref_id'] ?? null,
                'lat' => $p['lat'],
                'lng' => $p['lng'],
                'accuracy_m' => isset($p['accuracy_m']) ? max(0, (int) $p['accuracy_m']) : null,
                'is_mock' => (bool) ($p['is_mock'] ?? false),
                'recorded_at' => Carbon::parse($p['recorded_at'] ?? now()),
            ]);
        }

        return $this->ok('location_ping', $id);
    }
}
