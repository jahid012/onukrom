/** Staff, roles and permissions (spec §5) as received from /admin/state. */

export type RoleKey = 'owner' | 'manager' | 'sr' | 'dm';

export type Staff = {
    id: number;
    code: string;
    name: string;
    roles: string[];
    phone: string;
    email?: string | null;
    areas: string[]; // route names
    device?: { model: string; app: string } | null;
    lastSyncMin?: number | null;
    status: 'active' | 'invited' | 'inactive';
};

/** Permission groups and keys from spec §5.3. */
export const permissionGroups: { key: string; permissions: string[] }[] = [
    {
        key: 'app',
        permissions: ['app.sales', 'app.delivery', 'app.collection'],
    },
    {
        key: 'shops',
        permissions: [
            'shop.view_assigned',
            'shop.view_all',
            'shop.create',
            'shop.edit',
            'shop.approve',
            'shop.edit_location',
        ],
    },
    {
        key: 'products',
        permissions: ['product.view', 'product.manage', 'price.manage'],
    },
    {
        key: 'orders',
        permissions: [
            'order.create',
            'order.edit_own_pending',
            'order.cancel_own_pending',
            'order.edit_price',
            'order.give_discount',
            'order.view_all',
            'order.approve',
            'order.over_credit_limit',
            'order.over_stock',
        ],
    },
    {
        key: 'delivery',
        permissions: [
            'delivery.view_assigned',
            'delivery.assign',
            'delivery.complete',
            'delivery.partial',
        ],
    },
    {
        key: 'collections',
        permissions: [
            'collection.create',
            'collection.view_all',
            'collection.approve_deposit',
        ],
    },
    { key: 'returns', permissions: ['return.create', 'return.approve'] },
    {
        key: 'stock',
        permissions: ['stock.view', 'stock.adjust', 'stock.transfer'],
    },
    { key: 'gps', permissions: ['tracking.view_live_map'] },
    {
        key: 'reports',
        permissions: ['report.view_own', 'report.view_all', 'report.export'],
    },
    {
        key: 'admin',
        permissions: [
            'staff.manage',
            'role.manage',
            'area.manage',
            'settings.manage',
            'device.revoke',
        ],
    },
];
