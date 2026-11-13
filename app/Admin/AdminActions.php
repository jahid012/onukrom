<?php

namespace App\Admin;

use App\Models\Area;
use App\Models\Category;
use App\Models\Collection;
use App\Models\Deposit;
use App\Models\Order;
use App\Models\PriceChange;
use App\Models\PriceList;
use App\Models\PriceListItem;
use App\Models\Product;
use App\Models\Role;
use App\Models\Shop;
use App\Models\ShopReturn;
use App\Models\StockLevel;
use App\Models\StockMovement;
use App\Models\Tenant;
use App\Models\Trip;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Billing\Billing;
use App\Support\Permissions;
use App\Support\Phone;
use App\Support\Sms;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Every button in the admin panel ends up here (one method per store action
 * in resources/js/data/demo/store.ts). Arguments arrive exactly as the store
 * passes them: money in taka, shops/products by id, staff by code, trips and
 * orders by number. Each method checks its permission first.
 */
class AdminActions
{
    public function __construct(private readonly User $user) {}

    /**
     * @param  array<int|string, mixed>  $args
     * @return mixed the value the store action returns (new id, password…)
     */
    public function run(string $action, array $args): mixed
    {
        // Only the protected methods below are actions; helpers are private.
        $ref = new \ReflectionClass($this);

        if (! $ref->hasMethod($action) || ! $ref->getMethod($action)->isProtected()) {
            throw new AdminError('Unknown action.', 404);
        }

        return DB::transaction(fn () => $this->{$action}(...array_values($args)));
    }

    private function can(string $permission): void
    {
        if (! $this->user->hasPermission($permission)) {
            throw new AdminError('You are not allowed to do this.', 403);
        }
    }

    private static function paisa(int|float|string|null $taka): int
    {
        return (int) round(((float) $taka) * 100);
    }

    private function staffId(?string $code): ?int
    {
        return $code ? User::where('employee_code', $code)->value('id') : null;
    }

    private function routeByName(string $name): ?Area
    {
        return Area::where('type', 'route')->where('name', $name)->first();
    }

    private function mainWarehouse(): Warehouse
    {
        return Warehouse::where('type', 'main')->firstOrFail();
    }

    private function moveStock(string $warehouseId, string $productId, int $qty, string $type, ?string $reference, int $reserve = 0): void
    {
        $level = StockLevel::firstOrCreate(['warehouse_id' => $warehouseId, 'product_id' => $productId], ['on_hand' => 0, 'reserved' => 0]);
        $level->update([
            'on_hand' => max(0, $level->on_hand + $qty),
            'reserved' => max(0, $level->reserved + $reserve),
        ]);
        StockMovement::create([
            'warehouse_id' => $warehouseId, 'product_id' => $productId, 'qty' => $qty !== 0 ? $qty : -$reserve,
            'type' => $type, 'reference' => $reference, 'user_id' => $this->user->id,
        ]);
    }

    /* ---------------------------- orders & trips ---------------------------- */

    /** @param  list<string>  $numbers */
    protected function approveOrders(array $numbers): void
    {
        $this->can('order.approve');
        $main = $this->mainWarehouse();

        foreach (Order::with('items')->whereIn('number', $numbers)->where('status', 'pending')->get() as $order) {
            $order->update(['status' => 'approved', 'approved_by' => $this->user->id, 'approved_at' => now()]);

            foreach ($order->items as $item) {
                $this->moveStock($main->id, $item->product_id, 0, 'reserve', $order->number, $item->qty);
            }
        }
    }

    /** @param  list<string>  $numbers */
    protected function rejectOrders(array $numbers, string $reason): void
    {
        $this->can('order.approve');
        Order::whereIn('number', $numbers)->where('status', 'pending')->update(['status' => 'rejected', 'reject_reason' => Str::limit($reason, 250)]);
    }

    protected function rescheduleOrder(string $number): void
    {
        $this->can('delivery.assign');
        Order::where('number', $number)->where('status', 'failed')->update(['status' => 'approved', 'trip_id' => null]);
    }

    /** @param  list<string>  $numbers */
    protected function assignToTrip(array $numbers, string $tripNumber): void
    {
        $this->can('delivery.assign');
        $trip = Trip::where('number', $tripNumber)->where('status', '!=', 'closed')->first()
            ?? throw new AdminError('Trip not found or already closed.');
        Order::whereIn('number', $numbers)->where('status', 'approved')->update(['trip_id' => $trip->id, 'status' => 'dispatched']);
    }

    /** @param  array<string, mixed>  $input */
    protected function createTrip(array $input): string
    {
        $this->can('delivery.assign');
        $dm = $this->staffId($input['dm'] ?? null) ?? throw new AdminError('Choose a delivery man.');
        $max = Trip::pluck('number')->map(fn ($n) => (int) preg_replace('/\D/', '', $n))->max() ?? 1000;
        $number = 'T-'.($max + 1);

        $trip = Trip::create([
            'number' => $number,
            'delivery_user_id' => $dm,
            'route_id' => $this->routeByName((string) ($input['route'] ?? ''))?->id,
            'vehicle' => $input['vehicle'] ?? null,
            'status' => 'planned',
        ]);
        Order::whereIn('number', $input['orderNumbers'] ?? [])->where('status', 'approved')->update(['trip_id' => $trip->id, 'status' => 'dispatched']);

        return $number;
    }

    protected function advanceTrip(string $number): void
    {
        $this->can('delivery.assign');
        $trip = Trip::where('number', $number)->firstOrFail();
        $next = ['planned' => 'loaded', 'loaded' => 'in_progress'][$trip->status] ?? null;

        if ($next) {
            $trip->update(['status' => $next]);
        }
    }

    /** Close a trip: the cash handed in becomes a deposit for the office to count. */
    protected function closeTrip(string $number, int|float $cashHandedIn): void
    {
        $this->can('delivery.assign');
        $trip = Trip::with('orders')->where('number', $number)->firstOrFail();

        if ($trip->status === 'closed') {
            return;
        }

        $trip->update(['status' => 'closed', 'closed_at' => now()]);
        // Orders still out for delivery come back to the office as failed.
        $trip->orders()->where('status', 'dispatched')->update(['status' => 'failed', 'reject_reason' => 'Trip closed']);

        if ($cashHandedIn > 0) {
            $cash = Collection::where('user_id', $trip->delivery_user_id)->where('method', 'cash')
                ->whereNull('deposit_id')->where('status', '!=', 'rejected')
                ->whereIn('order_id', $trip->orders->pluck('id'));
            $deposit = Deposit::create([
                'number' => 'D-'.(Deposit::count() + 101),
                'user_id' => $trip->delivery_user_id,
                'amount' => self::paisa($cashHandedIn),
                'collections_count' => (clone $cash)->count(),
                'status' => 'waiting',
            ]);
            $cash->update(['deposit_id' => $deposit->id]);
        }
    }

    /* ---------------------------- money & returns --------------------------- */

    protected function confirmCollection(string $number): void
    {
        $this->can('collection.approve_deposit');
        Collection::where('number', $number)->where('status', 'pending')->update(['status' => 'confirmed']);
    }

    /** A refused payment goes back onto the shop's dues. */
    protected function rejectCollection(string $number, string $reason): void
    {
        $this->can('collection.approve_deposit');
        $c = Collection::where('number', $number)->where('status', '!=', 'rejected')->first();

        if (! $c) {
            return;
        }

        $c->update(['status' => 'rejected', 'reject_reason' => Str::limit($reason, 250)]);
        Shop::whereKey($c->shop_id)->increment('due', $c->amount);

        if ($c->order_id) {
            Order::whereKey($c->order_id)->decrement('paid', $c->amount);
        }
    }

    protected function receiveDeposit(string $id, int|float $counted): void
    {
        $this->can('collection.approve_deposit');
        $deposit = Deposit::findOrFail($id);
        $deposit->update(['status' => 'confirmed', 'amount' => self::paisa($counted), 'received_by' => $this->user->id, 'received_at' => now()]);
        Collection::where('deposit_id', $deposit->id)->where('status', 'pending')->update(['status' => 'confirmed']);
    }

    protected function approveReturn(string $number, string $destination): void
    {
        $this->can('return.approve');
        $ret = ShopReturn::with('items')->where('number', $number)->where('status', 'pending')->first();

        if (! $ret) {
            return;
        }

        $warehouse = Warehouse::where('type', $destination === 'damage' ? 'damage' : 'main')->first() ?? $this->mainWarehouse();

        foreach ($ret->items as $item) {
            $this->moveStock($warehouse->id, $item->product_id, (int) $item->qty, 'return', $ret->number);
        }

        $ret->update(['status' => 'approved', 'destination' => $destination === 'damage' ? 'damage' : 'main']);
        // The shop gets credit for what came back.
        Shop::whereKey($ret->shop_id)->decrement('due', $ret->value);
    }

    protected function rejectReturn(string $number, string $reason): void
    {
        $this->can('return.approve');
        ShopReturn::where('number', $number)->where('status', 'pending')->update(['status' => 'rejected', 'reject_reason' => Str::limit($reason, 250)]);
    }

    /* ---------------------------- shops & territory ------------------------- */

    /** @param  array<string, mixed>  $input */
    protected function saveShop(?string $id, array $input): string
    {
        $this->can('shop.edit');
        $name = trim((string) ($input['name'] ?? ''));

        if ($name === '' && trim((string) ($input['name_bn'] ?? '')) === '') {
            throw new AdminError('Shop name is required.', 422);
        }

        $fields = [
            'name' => $name !== '' ? $name : trim((string) $input['name_bn']),
            'name_bn' => trim((string) ($input['name_bn'] ?? '')) ?: null,
            'owner_name' => trim((string) ($input['owner'] ?? '')) ?: null,
            'phone' => ($input['phone'] ?? '') !== '' ? Phone::normalize($input['phone']) : null,
            'route_id' => $this->routeByName((string) ($input['route'] ?? ''))?->id,
            'category' => in_array($input['category'] ?? null, ['grocery', 'pharmacy', 'wholesale', 'tea_stall'], true) ? $input['category'] : 'grocery',
            'credit_limit' => self::paisa($input['creditLimit'] ?? 0),
        ];

        if ($id) {
            $shop = Shop::findOrFail($id);
            $shop->update($fields);

            return $shop->id;
        }

        $shop = new Shop([...$fields, 'status' => 'active', 'created_by' => $this->user->id]);
        $shop->id = (string) Str::ulid();
        $shop->code = $this->nextShopCode();
        $shop->save();

        return $shop->id;
    }

    private function nextShopCode(): string
    {
        $max = Shop::withTrashed()->pluck('code')->map(fn ($c) => (int) preg_replace('/\D/', '', $c))->max() ?? 5000;

        return 'SH-'.str_pad((string) ($max + 1), 5, '0', STR_PAD_LEFT);
    }

    /** @param  list<array<string, mixed>>  $rows */
    protected function importShops(array $rows): int
    {
        foreach ($rows as $row) {
            $this->saveShop(null, $row);
        }

        return count($rows);
    }

    /** @param  list<string>  $ids */
    protected function setShopStatus(array $ids, string $status): void
    {
        $this->can($status === 'active' ? 'shop.approve' : 'shop.edit');

        if (! in_array($status, ['active', 'inactive', 'pending_approval'], true)) {
            throw new AdminError('Unknown status.', 422);
        }

        Shop::whereIn('id', $ids)->get()->each->update(['status' => $status]);
    }

    /** @param  list<string>  $ids */
    protected function moveShops(array $ids, string $route): void
    {
        $this->can('shop.edit');
        $routeId = $this->routeByName($route)->id ?? throw new AdminError('Route not found.', 422);
        Shop::whereIn('id', $ids)->get()->each->update(['route_id' => $routeId]);
    }

    /** Top level of the territory tree; a new company starts with none. */
    protected function addZone(string $name): string
    {
        $this->can('area.manage');
        $name = trim($name);

        if ($name === '' || Area::where('type', 'zone')->where('name', $name)->exists()) {
            throw new AdminError('Zone name is empty or already used.', 422);
        }

        return Area::create(['type' => 'zone', 'name' => $name, 'sort' => Area::max('sort') + 1])->id;
    }

    protected function addArea(string $zoneId, string $name): string
    {
        $this->can('area.manage');
        $zone = Area::where('type', 'zone')->findOrFail($zoneId);

        return Area::create(['type' => 'area', 'parent_id' => $zone->id, 'name' => trim($name), 'sort' => Area::max('sort') + 1])->id;
    }

    /** @param  array<string, mixed>  $input */
    protected function saveRoute(string $areaId, ?string $routeId, array $input): string
    {
        $this->can('area.manage');
        $area = Area::where('type', 'area')->findOrFail($areaId);
        $name = trim((string) ($input['name'] ?? ''));

        if ($name === '' || Area::where('type', 'route')->where('name', $name)->when($routeId, fn ($q) => $q->whereKeyNot($routeId))->exists()) {
            throw new AdminError('Route name is empty or already used.', 422);
        }

        $fields = [
            'parent_id' => $area->id,
            'name' => $name,
            'code' => $input['code'] ?? null,
            'visit_days' => array_values(array_intersect($input['visitDays'] ?? [], ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'])),
            'sr_id' => $this->staffId($input['sr'] ?? null),
            'dm_id' => $this->staffId($input['dm'] ?? null),
        ];

        $route = $routeId ? tap(Area::where('type', 'route')->findOrFail($routeId))->update($fields)
            : Area::create([...$fields, 'type' => 'route', 'sort' => Area::max('sort') + 1]);

        foreach (array_filter([$fields['sr_id'], $fields['dm_id']]) as $uid) {
            User::find($uid)?->routes()->syncWithoutDetaching([$route->id]);
        }

        return $route->id;
    }

    protected function deleteRoute(string $routeId): void
    {
        $this->can('area.manage');
        $route = Area::where('type', 'route')->findOrFail($routeId);
        Shop::where('route_id', $route->id)->get()->each->update(['route_id' => null]);
        $route->users()->detach();
        $route->delete();
    }

    /* ---------------------------- catalog, prices, stock -------------------- */

    /** @param  array<string, mixed>  $input */
    protected function saveProduct(?string $id, array $input): string
    {
        $this->can('product.manage');
        $sku = strtoupper(trim((string) ($input['sku'] ?? '')));

        if ($sku === '' || Product::where('sku', $sku)->when($id, fn ($q) => $q->whereKeyNot($id))->exists()) {
            throw new AdminError('The SKU is empty or already used.', 422);
        }

        $fields = [
            'sku' => $sku,
            'name' => trim((string) $input['name']),
            'name_bn' => trim((string) ($input['name_bn'] ?? '')) ?: null,
            'brand' => trim((string) ($input['brand'] ?? '')) ?: null,
            'category_id' => Category::where('key', $input['category'] ?? '')->value('id'),
            'pack_size' => max(1, (int) ($input['packSize'] ?? 1)),
            'mrp' => self::paisa($input['mrp'] ?? 0),
            'reorder_level' => max(0, (int) ($input['reorderAt'] ?? 0)),
        ];
        $price = self::paisa($input['price'] ?? 0);

        if ($id) {
            $product = Product::findOrFail($id);

            if ($product->price !== $price) {
                PriceChange::create(['product_id' => $product->id, 'from_price' => $product->price, 'to_price' => $price, 'user_id' => $this->user->id]);
            }

            $product->update([...$fields, 'price' => $price]);

            return $product->id;
        }

        $product = Product::create([...$fields, 'price' => $price, 'active' => true, 'hue' => random_int(0, 359)]);

        foreach (Warehouse::pluck('id') as $w) {
            StockLevel::create(['warehouse_id' => $w, 'product_id' => $product->id, 'on_hand' => 0, 'reserved' => 0]);
        }

        return $product->id;
    }

    protected function setProductActive(string $id, bool $active): void
    {
        $this->can('product.manage');
        Product::findOrFail($id)->update(['active' => $active]);
    }

    protected function setPrice(string $listId, string $productId, int|float $price): void
    {
        $this->can('price.manage');
        $product = Product::findOrFail($productId);
        $to = self::paisa($price);

        if ($to < 0) {
            throw new AdminError('Price cannot be negative.', 422);
        }

        if ($listId === AdminState::DEFAULT_LIST) {
            if ($product->price !== $to) {
                PriceChange::create(['product_id' => $product->id, 'from_price' => $product->price, 'to_price' => $to, 'user_id' => $this->user->id]);
                $product->update(['price' => $to]);
            }

            return;
        }

        $list = PriceList::findOrFail($listId);
        $item = PriceListItem::firstOrNew(['price_list_id' => $list->id, 'product_id' => $product->id]);
        $from = $item->exists ? (int) $item->unit_price : (int) $product->price;

        if (! $item->exists || $from !== $to) {
            $item->unit_price = $to;
            $item->save();
            PriceChange::create(['price_list_id' => $list->id, 'product_id' => $product->id, 'from_price' => $from, 'to_price' => $to, 'user_id' => $this->user->id]);
        }
    }

    protected function bulkUpdatePrices(string $listId, string $category, int|float $percent): void
    {
        $this->can('price.manage');
        $categoryId = $category === 'all' ? null : Category::where('key', $category)->value('id');
        $items = $listId === AdminState::DEFAULT_LIST ? collect() : PriceListItem::where('price_list_id', $listId)->get()->keyBy('product_id');

        Product::where('active', true)->when($categoryId, fn ($q) => $q->where('category_id', $categoryId))->get()
            ->each(function (Product $p) use ($listId, $percent, $items) {
                $current = ($items[$p->id]->unit_price ?? $p->price) / 100;
                $this->setPrice($listId, $p->id, round($current * (1 + $percent / 100), 2));
            });
    }

    /** @param  array<string, mixed>  $input */
    protected function addPriceList(array $input): string
    {
        $this->can('price.manage');
        $applies = in_array($input['appliesTo'] ?? null, ['shop_category', 'area'], true) ? $input['appliesTo'] : 'shop_category';
        $list = PriceList::create([
            'name' => trim((string) $input['name']),
            'name_bn' => trim((string) ($input['name_bn'] ?? '')) ?: null,
            'applies_to' => $applies,
            'target' => (string) ($input['target'] ?? ''),
        ]);

        // Starts as a copy of the default prices; edit from there.
        foreach (Product::where('active', true)->get() as $p) {
            PriceListItem::create(['price_list_id' => $list->id, 'product_id' => $p->id, 'unit_price' => $p->price]);
        }

        return $list->id;
    }

    protected function adjustStock(string $warehouseId, string $productId, int $qty, string $reference): void
    {
        $this->can('stock.adjust');
        Warehouse::findOrFail($warehouseId);
        Product::findOrFail($productId);
        $this->moveStock($warehouseId, $productId, $qty, $qty > 0 ? 'purchase' : 'adjust', $reference ?: null);
    }

    protected function transferStock(string $from, string $to, string $productId, int $qty): void
    {
        $this->can('stock.transfer');

        if ($qty <= 0 || $from === $to) {
            throw new AdminError('Choose two different stores and a quantity.', 422);
        }

        $available = (int) StockLevel::where('warehouse_id', $from)->where('product_id', $productId)->value('on_hand');

        if ($qty > $available) {
            throw new AdminError('Not enough stock in that store.', 422);
        }

        $ref = 'TR-'.(StockMovement::where('type', 'transfer')->count() / 2 + 32);
        $this->moveStock($from, $productId, -$qty, 'transfer', $ref);
        $this->moveStock($to, $productId, $qty, 'transfer', $ref);
    }

    /* ---------------------------- staff, roles, settings -------------------- */

    /** @param  array<string, mixed>  $input */
    private function syncPerson(User $person, array $input): void
    {
        if (isset($input['roles'])) {
            $person->roles()->sync(Role::whereIn('key', (array) $input['roles'])->pluck('id'));
        }

        if (isset($input['areas'])) {
            $person->routes()->sync(Area::where('type', 'route')->whereIn('name', (array) $input['areas'])->pluck('id'));
        }
    }

    /**
     * Invite by phone: an 8-character password goes out by SMS and is shown once.
     *
     * @param  array<string, mixed>  $input
     */
    protected function inviteStaff(array $input): string
    {
        $this->can('staff.manage');
        $tenant = TenantContext::get();
        $limit = $tenant->currentPlan()->staff_limit;

        if (Billing::staffUsed($tenant) >= $limit) {
            throw new AdminError("Your plan allows {$limit} staff. Choose a bigger plan under Billing, or switch someone off first.", 422);
        }

        $phone = Phone::normalize((string) ($input['phone'] ?? ''));
        $code = strtoupper(trim((string) ($input['code'] ?? '')));

        if (! Phone::isValid($phone)) {
            throw new AdminError('Enter a valid mobile number (01XXXXXXXXX).', 422);
        }

        if (User::where('phone', $phone)->exists() || ($code !== '' && User::where('employee_code', $code)->exists())) {
            throw new AdminError('This phone number or staff code is already used.', 422);
        }

        $password = Sms::password();
        $person = User::create([
            'name' => trim((string) $input['name']),
            'phone' => $phone,
            'employee_code' => $code ?: null,
            'password' => $password,
            'status' => 'invited',
        ]);
        $this->syncPerson($person, $input);

        $tenant = TenantContext::get();
        Sms::send($person, 'invite', "{$tenant->name}: Onukrom app-e login korun. Company code: {$tenant->code}, phone: {$phone}, password: {$password}", $password);

        return $password;
    }

    /** @param  array<string, mixed>  $input */
    protected function updateStaff(string $code, array $input): void
    {
        $this->can('staff.manage');
        $person = User::where('employee_code', $code)->firstOrFail();
        $fields = array_filter([
            'name' => isset($input['name']) ? trim((string) $input['name']) : null,
            'phone' => isset($input['phone']) ? Phone::normalize((string) $input['phone']) : null,
            'employee_code' => isset($input['code']) ? strtoupper(trim((string) $input['code'])) : null,
        ]);

        if (isset($fields['phone']) && User::where('phone', $fields['phone'])->whereKeyNot($person->id)->exists()) {
            throw new AdminError('This phone number is already used.', 422);
        }

        $person->update($fields);
        $this->syncPerson($person, $input);
    }

    protected function setStaffStatus(string $code, string $status): void
    {
        $this->can('staff.manage');
        $person = User::where('employee_code', $code)->firstOrFail();

        if ($person->id === $this->user->id) {
            throw new AdminError('You cannot turn off your own account.', 422);
        }

        $person->update(['status' => in_array($status, ['active', 'inactive', 'invited'], true) ? $status : 'inactive']);

        if ($status === 'inactive') {
            $person->tokens()->delete();
        }
    }

    /** Sign the person out of their phone. */
    protected function revokeDevice(string $code): void
    {
        $this->can('device.revoke');
        $person = User::where('employee_code', $code)->firstOrFail();
        $person->tokens()->delete();
        $person->devices()->delete();
    }

    protected function resetPassword(string $code): string
    {
        $this->can('staff.manage');
        $person = User::where('employee_code', $code)->firstOrFail();
        $password = Sms::password();
        $person->forceFill(['password' => $password, 'password_changed_at' => null])->save();
        $person->tokens()->delete();

        $tenant = TenantContext::get();
        Sms::send($person, 'password_reset', "{$tenant->name}: apnar notun Onukrom password: {$password}", $password);

        return $password;
    }

    /** @param  list<string>  $grants */
    protected function saveRole(string $key, array $grants): void
    {
        $this->can('role.manage');
        $role = Role::where('key', $key)->firstOrFail();

        if ($role->key === 'owner') {
            throw new AdminError('The owner role always has every permission.', 422);
        }

        $role->update(['permissions' => array_values(array_intersect($grants, Permissions::all()))]);
    }

    protected function addRole(string $name, string $copyFrom): string
    {
        $this->can('role.manage');
        $key = 'custom-'.Str::slug($name).'-'.Str::lower(Str::random(4));
        Role::create([
            'key' => $key,
            'name' => trim($name),
            'built_in' => false,
            'permissions' => Role::where('key', $copyFrom)->value('permissions') ?? [],
        ]);

        return $key;
    }

    protected function deleteRole(string $key): void
    {
        $this->can('role.manage');
        $role = Role::where('key', $key)->where('built_in', false)->first();

        if ($role) {
            $role->users()->detach();
            $role->delete();
        }
    }

    /** @param  array<string, mixed>  $settings */
    protected function saveSettings(array $settings): void
    {
        $this->can('settings.manage');
        /** @var Tenant $tenant */
        $tenant = TenantContext::get();
        $rules = array_intersect_key($settings, Tenant::DEFAULT_SETTINGS);

        foreach ($rules as $k => $v) {
            $default = Tenant::DEFAULT_SETTINGS[$k];
            $rules[$k] = match (true) {
                is_bool($default) => (bool) $v,
                is_int($default) => (int) $v,
                default => (string) $v,
            };
        }

        $tenant->update([
            'name' => trim((string) ($settings['name'] ?? $tenant->name)) ?: $tenant->name,
            'phone' => $settings['phone'] ?? $tenant->phone,
            'address' => $settings['address'] ?? $tenant->address,
            'settings' => [...($tenant->settings ?? []), ...$rules],
        ]);
    }

    protected function markNotificationsRead(): void
    {
        $this->user->forceFill(['notifications_read_at' => now()])->save();
    }
}
