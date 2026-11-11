/**
 * The admin panel's data store.
 *
 * Every page reads from this one store, so an action on one page (e.g.
 * approving an order) shows up everywhere (order detail, dashboard, sidebar
 * counts). The data comes from the server (GET /admin/state). Each action
 * updates the screen at once, then posts to /admin/actions/{name}; the
 * server's answer replaces the state, so what you see is what is saved.
 * If the server refuses, a toast explains why and the change is undone.
 *
 * New orders from the phones show up on the next refresh: every minute and
 * whenever the browser tab comes back into focus (no realtime, spec §2.3).
 */
import { toast } from 'sonner';
import type {
    Category,
    Movement,
    PriceList,
    Product,
    Warehouse,
} from '@/data/admin/catalog';
import type { Day, Shop, Zone } from '@/data/admin/customers';
import type {
    AgingBucket,
    Collection,
    Deposit,
    Order,
    OrderLine,
    ReturnRow,
    Trip,
} from '@/data/admin/sales';
import type { Staff } from '@/data/admin/team';
import type { Company, DashboardData } from '@/data/dashboard';
import i18n from '@/i18n';
import { api, ApiError } from '@/lib/api';
import { createStore, useStoreState } from '@/lib/store';

export type StockLevel = { onHand: number; reserved: number };

export type PriceChange = {
    id: string;
    listId: string;
    productId: string;
    from: number;
    to: number;
    minutesAgo: number;
};

export type RoleDef = {
    key: string;
    name?: string | null; // custom roles only — built-in roles are translated
    builtIn: boolean;
    grants: string[];
    users?: number;
};

export type NotificationKind =
    | 'order'
    | 'shop'
    | 'deposit'
    | 'stock'
    | 'location';

export type Notification = {
    id: string;
    kind: NotificationKind;
    text: Record<string, string>;
    href: string;
    minutesAgo: number;
    read: boolean;
};

export type CompanySettings = {
    name: string;
    phone: string;
    address: string;
    autoApprove: boolean;
    creditMode: 'warn' | 'block';
    maxDiscount: number;
    priceWindow: number;
    blockOverStock: boolean;
    locationMode: 'required' | 'flag';
    maxAccuracy: number;
    maxAge: number;
    wait: number;
    geofence: number;
    blockMock: boolean;
    shopFromOrder: boolean;
    requireStartDay: boolean;
    dutyTracking: boolean;
    dutyInterval: number;
    oneDevice: boolean;
    proof: 'none' | 'signature' | 'photo' | 'both';
};

export type AdminData = {
    /** false until the first answer from the server. */
    ready: boolean;
    /** Set when the server refused to load the data (e.g. 403). */
    loadError: string | null;
    orders: Order[];
    trips: Trip[];
    collections: Collection[];
    deposits: Deposit[];
    returns: ReturnRow[];
    shops: Shop[];
    zones: Zone[];
    categories: Category[];
    warehouses: Warehouse[];
    products: Product[];
    priceLists: PriceList[];
    prices: Record<string, Record<string, number>>;
    priceHistory: PriceChange[];
    stock: Record<string, Record<string, StockLevel>>;
    movements: (Movement & { warehouseId?: string })[];
    staff: Staff[];
    roles: RoleDef[];
    settings: CompanySettings;
    company: Company;
    aging: AgingBucket[];
    notifications: Notification[];
    dashboard: DashboardData | null;
};

/** The default price list is each product's own price. */
export const DEFAULT_LIST = 'default';

const empty: AdminData = {
    ready: false,
    loadError: null,
    orders: [],
    trips: [],
    collections: [],
    deposits: [],
    returns: [],
    shops: [],
    zones: [],
    categories: [],
    warehouses: [],
    products: [],
    priceLists: [],
    prices: {},
    priceHistory: [],
    stock: {},
    movements: [],
    staff: [],
    roles: [],
    settings: {
        name: '',
        phone: '',
        address: '',
        autoApprove: false,
        creditMode: 'warn',
        maxDiscount: 5,
        priceWindow: 48,
        blockOverStock: false,
        locationMode: 'required',
        maxAccuracy: 50,
        maxAge: 60,
        wait: 20,
        geofence: 150,
        blockMock: false,
        shopFromOrder: true,
        requireStartDay: false,
        dutyTracking: false,
        dutyInterval: 300,
        oneDevice: true,
        proof: 'none',
    },
    company: {
        name: '',
        code: '',
        plan: 'starter',
        staffUsed: 0,
        staffLimit: 25,
        smsUsed: 0,
        smsLimit: 500,
    },
    aging: [],
    notifications: [],
    dashboard: null,
};

const store = createStore<AdminData>(empty);

export const adminStore = store;

export function useAdminData(): AdminData {
    return useStoreState(store);
}

const set = store.set;
let seq = 100;
const nextId = (prefix: string) => `${prefix}tmp${++seq}`;

/* ------------------------------------------------------------------ */
/* Talking to the server                                               */
/* ------------------------------------------------------------------ */

type ServerState = Omit<AdminData, 'ready' | 'loadError'>;

function apply(state: ServerState) {
    set(() => ({ ...state, ready: true, loadError: null }));
}

let loading: Promise<void> | null = null;

/** Load (or reload) everything from the server. */
export function loadState(): Promise<void> {
    loading ??= api<{ state: ServerState }>('GET', '/admin/state')
        .then((r) => apply(r.state))
        .catch((e: unknown) => {
            if (!store.get().ready) {
                set((s) => ({
                    ...s,
                    loadError:
                        e instanceof ApiError && e.status === 403
                            ? 'forbidden'
                            : 'network',
                }));
            }
        })
        .finally(() => {
            loading = null;
        });

    return loading;
}

let started = false;

/** Called once by the app layout: first load + gentle polling. */
export function startSync() {
    if (started || typeof window === 'undefined') {
        return;
    }

    started = true;
    void loadState();
    window.setInterval(() => {
        if (document.visibilityState === 'visible' && pending === 0) {
            void loadState();
        }
    }, 60_000);
    window.addEventListener('focus', () => {
        if (pending === 0) {
            void loadState();
        }
    });
}

let pending = 0;

/**
 * Send one action. Resolves with the action's result (new id, password…),
 * or null when it failed — the toast has already told the user why.
 */
function send<T = unknown>(
    action: string,
    ...args: unknown[]
): Promise<T | null> {
    pending++;

    return api<{ result: T; state: ServerState }>(
        'POST',
        `/admin/actions/${action}`,
        { args },
    )
        .then((r) => {
            apply(r.state);

            return r.result;
        })
        .catch((e: unknown) => {
            const message =
                e instanceof ApiError && e.status === 0
                    ? i18n.t('admin.sync.offline')
                    : e instanceof ApiError && e.status === 419
                      ? i18n.t('admin.sync.expired')
                      : e instanceof Error && e.message !== 'server'
                        ? e.message
                        : i18n.t('admin.sync.failed');
            toast.error(message);
            void loadState(); // undo the optimistic change

            return null;
        })
        .finally(() => {
            pending--;
        });
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

const unknownStaff: Staff = {
    id: 0,
    code: '',
    name: '—',
    roles: [],
    phone: '',
    areas: [],
    status: 'inactive',
};

export function staffByCode(code: string | null | undefined): Staff {
    return (
        store.get().staff.find((s) => s.code === code) ?? {
            ...unknownStaff,
            code: code ?? '',
            name: code || '—',
        }
    );
}

export function shopById(id: string): Shop | undefined {
    return store.get().shops.find((s) => s.id === id);
}

export function productById(id: string): Product | undefined {
    return store.get().products.find((p) => p.id === id);
}

export function allRoutesOf(state: AdminData) {
    return state.zones.flatMap((z) => z.areas.flatMap((a) => a.routes));
}

export function priceFor(
    state: AdminData,
    listId: string,
    product: Product,
): number {
    if (listId === DEFAULT_LIST) {
        return product.price;
    }

    return state.prices[listId]?.[product.id] ?? product.price;
}

/** The order's real lines, joined with the product and split into ctn + pcs. */
export function linesForOrder(order: Order): OrderLine[] {
    return order.lines.flatMap((l) => {
        const product = productById(l.productId);

        if (!product) {
            return [];
        }

        const pack = Math.max(1, product.packSize);

        return [
            {
                product,
                ctn: Math.floor(l.qty / pack),
                pcs: l.qty % pack,
                qty: l.qty,
                unitPrice: l.unitPrice,
                discount: l.discount,
                total: l.total,
                deliveredQty: l.deliveredQty,
            },
        ];
    });
}

/* ------------------------------------------------------------------ */
/* Orders & trips                                                      */
/* ------------------------------------------------------------------ */

export function approveOrders(numbers: string[]) {
    set((s) => ({
        ...s,
        orders: s.orders.map((o) =>
            numbers.includes(o.number) && o.status === 'pending'
                ? { ...o, status: 'approved' }
                : o,
        ),
    }));
    void send('approveOrders', numbers);
}

export function rejectOrders(numbers: string[], reason: string) {
    set((s) => ({
        ...s,
        orders: s.orders.map((o) =>
            numbers.includes(o.number) && o.status === 'pending'
                ? { ...o, status: 'rejected', rejectReason: reason }
                : o,
        ),
    }));
    void send('rejectOrders', numbers, reason);
}

/** A failed delivery goes back to "approved" so it can be put on a new trip. */
export function rescheduleOrder(number: string) {
    set((s) => ({
        ...s,
        orders: s.orders.map((o) =>
            o.number === number && o.status === 'failed'
                ? { ...o, status: 'approved', trip: undefined }
                : o,
        ),
    }));
    void send('rescheduleOrder', number);
}

export function assignToTrip(numbers: string[], tripNumber: string) {
    set((s) => {
        const moving = s.orders.filter(
            (o) => numbers.includes(o.number) && o.status === 'approved',
        );
        const value = moving.reduce((sum, o) => sum + o.total, 0);

        return {
            ...s,
            orders: s.orders.map((o) =>
                moving.includes(o)
                    ? { ...o, trip: tripNumber, status: 'dispatched' }
                    : o,
            ),
            trips: s.trips.map((t) =>
                t.number === tripNumber
                    ? {
                          ...t,
                          orders: t.orders + moving.length,
                          cashExpected: t.cashExpected + value,
                          orderNumbers: [
                              ...(t.orderNumbers ?? []),
                              ...moving.map((o) => o.number),
                          ],
                      }
                    : t,
            ),
        };
    });
    void send('assignToTrip', numbers, tripNumber);
}

/** Resolves with the new trip number (made by the server). */
export function createTrip(input: {
    dm: string;
    route: string;
    vehicle: string;
    orderNumbers: string[];
}): Promise<string | null> {
    return send<string>('createTrip', input);
}

const nextTripStatus = { planned: 'loaded', loaded: 'in_progress' } as const;

export function advanceTrip(number: string) {
    set((s) => ({
        ...s,
        trips: s.trips.map((t) =>
            t.number === number &&
            (t.status === 'planned' || t.status === 'loaded')
                ? { ...t, status: nextTripStatus[t.status] }
                : t,
        ),
    }));
    void send('advanceTrip', number);
}

/** Close a trip: cash handed in becomes a deposit waiting for the office. */
export function closeTrip(number: string, cashHandedIn: number) {
    set((s) => ({
        ...s,
        trips: s.trips.map((t) =>
            t.number === number ? { ...t, status: 'closed' } : t,
        ),
    }));
    void send('closeTrip', number, cashHandedIn);
}

/* ------------------------------------------------------------------ */
/* Money & returns                                                     */
/* ------------------------------------------------------------------ */

export function confirmCollection(number: string) {
    set((s) => ({
        ...s,
        collections: s.collections.map((c) =>
            c.number === number ? { ...c, status: 'confirmed' } : c,
        ),
    }));
    void send('confirmCollection', number);
}

export function rejectCollection(number: string, reason: string) {
    set((s) => ({
        ...s,
        collections: s.collections.map((c) =>
            c.number === number
                ? { ...c, status: 'rejected', rejectReason: reason }
                : c,
        ),
    }));
    void send('rejectCollection', number, reason);
}

export function receiveDeposit(id: string, counted: number) {
    set((s) => ({
        ...s,
        deposits: s.deposits.map((d) =>
            d.id === id ? { ...d, status: 'confirmed', amount: counted } : d,
        ),
    }));
    void send('receiveDeposit', id, counted);
}

export function approveReturn(number: string, destination: 'main' | 'damage') {
    set((s) => ({
        ...s,
        returns: s.returns.map((r) =>
            r.number === number ? { ...r, status: 'approved', destination } : r,
        ),
    }));
    void send('approveReturn', number, destination);
}

export function rejectReturn(number: string, reason: string) {
    set((s) => ({
        ...s,
        returns: s.returns.map((r) =>
            r.number === number
                ? { ...r, status: 'rejected', rejectReason: reason }
                : r,
        ),
    }));
    void send('rejectReturn', number, reason);
}

/* ------------------------------------------------------------------ */
/* Shops & territory                                                   */
/* ------------------------------------------------------------------ */

export type ShopInput = Pick<
    Shop,
    | 'name'
    | 'name_bn'
    | 'owner'
    | 'phone'
    | 'route'
    | 'category'
    | 'creditLimit'
>;

export function saveShop(id: string | null, input: ShopInput) {
    set((s) => {
        if (id) {
            return {
                ...s,
                shops: s.shops.map((sh) =>
                    sh.id === id ? { ...sh, ...input } : sh,
                ),
            };
        }

        return {
            ...s,
            shops: [
                {
                    ...input,
                    id: nextId('s'),
                    code: '…',
                    due: 0,
                    lastOrderDays: null,
                    hasLocation: false,
                    status: 'active',
                },
                ...s.shops,
            ],
        };
    });
    void send('saveShop', id, input);
}

export function importShops(rows: ShopInput[]) {
    void send('importShops', rows);
}

export function setShopStatus(ids: string[], status: Shop['status']) {
    set((s) => ({
        ...s,
        shops: s.shops.map((sh) =>
            ids.includes(sh.id) ? { ...sh, status } : sh,
        ),
    }));
    void send('setShopStatus', ids, status);
}

export function moveShops(ids: string[], route: string) {
    set((s) => ({
        ...s,
        shops: s.shops.map((sh) =>
            ids.includes(sh.id) ? { ...sh, route } : sh,
        ),
    }));
    void send('moveShops', ids, route);
}

export function addArea(zoneId: string, name: string) {
    set((s) => ({
        ...s,
        zones: s.zones.map((z) =>
            z.id === zoneId
                ? {
                      ...z,
                      areas: [
                          ...z.areas,
                          { id: nextId('a'), name, routes: [] },
                      ],
                  }
                : z,
        ),
    }));
    void send('addArea', zoneId, name);
}

export type RouteInput = {
    name: string;
    code: string;
    visitDays: Day[];
    sr?: string;
    dm?: string;
};

/** Resolves with the route id (made by the server for a new route). */
export function saveRoute(
    areaId: string,
    routeId: string | null,
    input: RouteInput,
): Promise<string | null> {
    return send<string>('saveRoute', areaId, routeId, input);
}

export function deleteRoute(routeId: string) {
    set((s) => ({
        ...s,
        zones: s.zones.map((z) => ({
            ...z,
            areas: z.areas.map((a) => ({
                ...a,
                routes: a.routes.filter((r) => r.id !== routeId),
            })),
        })),
    }));
    void send('deleteRoute', routeId);
}

/* ------------------------------------------------------------------ */
/* Catalog, prices & stock                                             */
/* ------------------------------------------------------------------ */

export type ProductInput = Pick<
    Product,
    | 'sku'
    | 'name'
    | 'name_bn'
    | 'brand'
    | 'category'
    | 'packSize'
    | 'mrp'
    | 'price'
    | 'reorderAt'
>;

export function saveProduct(id: string | null, input: ProductInput) {
    set((s) => {
        if (id) {
            return {
                ...s,
                products: s.products.map((p) =>
                    p.id === id ? { ...p, ...input } : p,
                ),
            };
        }

        return {
            ...s,
            products: [
                ...s.products,
                {
                    ...input,
                    id: nextId('p'),
                    onHand: 0,
                    reserved: 0,
                    active: true,
                    hue: (seq * 47) % 360,
                },
            ],
        };
    });
    void send('saveProduct', id, input);
}

export function setProductActive(id: string, active: boolean) {
    set((s) => ({
        ...s,
        products: s.products.map((p) => (p.id === id ? { ...p, active } : p)),
    }));
    void send('setProductActive', id, active);
}

export function setPrice(listId: string, productId: string, price: number) {
    set((s) =>
        listId === DEFAULT_LIST
            ? {
                  ...s,
                  products: s.products.map((p) =>
                      p.id === productId ? { ...p, price } : p,
                  ),
              }
            : {
                  ...s,
                  prices: {
                      ...s.prices,
                      [listId]: { ...s.prices[listId], [productId]: price },
                  },
              },
    );
    void send('setPrice', listId, productId, price);
}

export function bulkUpdatePrices(
    listId: string,
    category: string,
    percent: number,
) {
    void send('bulkUpdatePrices', listId, category, percent);
}

/** Resolves with the new list's id. */
export function addPriceList(
    input: Pick<PriceList, 'name' | 'name_bn' | 'appliesTo' | 'target'>,
): Promise<string | null> {
    return send<string>('addPriceList', input);
}

function addStock(
    stock: AdminData['stock'],
    warehouseId: string,
    productId: string,
    qty: number,
) {
    const level = stock[warehouseId]?.[productId] ?? { onHand: 0, reserved: 0 };

    return {
        ...stock,
        [warehouseId]: {
            ...stock[warehouseId],
            [productId]: { ...level, onHand: Math.max(0, level.onHand + qty) },
        },
    };
}

export function adjustStock(
    warehouseId: string,
    productId: string,
    qty: number,
    reference: string,
) {
    set((s) => ({
        ...s,
        stock: addStock(s.stock, warehouseId, productId, qty),
    }));
    void send('adjustStock', warehouseId, productId, qty, reference);
}

export function transferStock(
    from: string,
    to: string,
    productId: string,
    qty: number,
) {
    set((s) => ({
        ...s,
        stock: addStock(
            addStock(s.stock, from, productId, -qty),
            to,
            productId,
            qty,
        ),
    }));
    void send('transferStock', from, to, productId, qty);
}

/* ------------------------------------------------------------------ */
/* Staff, roles, settings, notifications                               */
/* ------------------------------------------------------------------ */

export type StaffInput = Pick<
    Staff,
    'name' | 'phone' | 'code' | 'roles' | 'areas'
>;

/** Invites by SMS. Resolves with the password (shown once), or null. */
export function inviteStaff(input: StaffInput): Promise<string | null> {
    return send<string>('inviteStaff', input);
}

export function updateStaff(code: string, input: Partial<StaffInput>) {
    set((s) => ({
        ...s,
        staff: s.staff.map((p) => (p.code === code ? { ...p, ...input } : p)),
    }));
    void send('updateStaff', code, input);
}

export function setStaffStatus(code: string, status: Staff['status']) {
    set((s) => ({
        ...s,
        staff: s.staff.map((p) => (p.code === code ? { ...p, status } : p)),
    }));
    void send('setStaffStatus', code, status);
}

/** Sign the person out of their phone (revokes the device token). */
export function revokeDevice(code: string) {
    set((s) => ({
        ...s,
        staff: s.staff.map((p) =>
            p.code === code ? { ...p, device: null, lastSyncMin: null } : p,
        ),
    }));
    void send('revokeDevice', code);
}

/** New password by SMS (also signs the phone out). Resolves with the password. */
export function resetPassword(code: string): Promise<string | null> {
    return send<string>('resetPassword', code);
}

export function saveRole(key: string, grants: string[]) {
    set((s) => ({
        ...s,
        roles: s.roles.map((r) => (r.key === key ? { ...r, grants } : r)),
    }));
    void send('saveRole', key, grants);
}

/** Resolves with the new role's key. */
export function addRole(
    name: string,
    copyFrom: string,
): Promise<string | null> {
    return send<string>('addRole', name, copyFrom);
}

export function deleteRole(key: string) {
    set((s) => ({
        ...s,
        roles: s.roles.filter((r) => r.key !== key || r.builtIn),
    }));
    void send('deleteRole', key);
}

export function saveSettings(settings: CompanySettings) {
    set((s) => ({ ...s, settings }));
    void send('saveSettings', settings);
}

export function markNotificationsRead() {
    set((s) => ({
        ...s,
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
    }));
    void send('markNotificationsRead');
}

/** Id of the main godown (its stock is what the phones can sell). */
export function mainWarehouseId(state: AdminData): string {
    return state.warehouses.find((w) => w.type === 'main')?.id ?? '';
}
