<?php

namespace App\Support;

/** Permission catalogue and default roles (spec §5). */
class Permissions
{
    public const GROUPS = [
        'app' => ['app.sales', 'app.delivery', 'app.collection'],
        'shops' => ['shop.view_assigned', 'shop.view_all', 'shop.create', 'shop.edit', 'shop.approve', 'shop.edit_location'],
        'products' => ['product.view', 'product.manage', 'price.manage'],
        'orders' => ['order.create', 'order.edit_own_pending', 'order.cancel_own_pending', 'order.edit_price', 'order.give_discount', 'order.view_all', 'order.approve', 'order.over_credit_limit', 'order.over_stock'],
        'delivery' => ['delivery.view_assigned', 'delivery.assign', 'delivery.complete', 'delivery.partial'],
        'collections' => ['collection.create', 'collection.view_all', 'collection.approve_deposit'],
        'returns' => ['return.create', 'return.approve'],
        'stock' => ['stock.view', 'stock.adjust', 'stock.transfer'],
        'gps' => ['tracking.view_live_map'],
        'reports' => ['report.view_own', 'report.view_all', 'report.export'],
        'admin' => ['staff.manage', 'role.manage', 'area.manage', 'settings.manage', 'device.revoke'],
    ];

    /** @return list<string> */
    public static function all(): array
    {
        return array_merge(...array_values(self::GROUPS));
    }

    /** @return array<string, list<string>> */
    public static function defaults(): array
    {
        $all = self::all();

        return [
            'owner' => $all,
            'manager' => array_values(array_filter($all, fn ($p) => ! in_array($p, ['settings.manage', 'role.manage'], true) && ! str_starts_with($p, 'app.'))),
            'sr' => ['app.sales', 'shop.view_assigned', 'shop.create', 'order.create', 'order.edit_own_pending', 'order.cancel_own_pending', 'collection.create', 'return.create', 'report.view_own', 'product.view'],
            'dm' => ['app.delivery', 'app.collection', 'delivery.view_assigned', 'delivery.complete', 'delivery.partial', 'collection.create', 'return.create', 'report.view_own', 'product.view'],
        ];
    }
}
