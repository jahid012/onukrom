/**
 * Orders, trips, money and returns as the admin panel receives them from
 * /admin/state (app/Admin/AdminState.php). Money in taka, quantities in pcs.
 * Order numbers follow the offline format: {SR code}-{yyMMdd}-{seq}.
 */
import type { Product } from '@/data/admin/catalog';

export type OrderStatus =
    | 'pending'
    | 'approved'
    | 'dispatched'
    | 'delivered'
    | 'partially_delivered'
    | 'failed'
    | 'cancelled'
    | 'rejected';

export type OrderFlag =
    | 'far_from_shop'
    | 'low_accuracy'
    | 'mock'
    | 'no_location'
    | 'price_changed'
    | 'over_credit'
    | 'over_stock';

/** One order line as stored. */
export type OrderItem = {
    productId: string;
    qty: number;
    unitPrice: number;
    discount: number;
    total: number;
    deliveredQty: number | null;
};

export type Order = {
    id: string;
    number: string;
    minutesAgo: number;
    shopId: string;
    sr: string;
    items: number;
    subtotal: number;
    discount: number;
    total: number;
    paid: number;
    status: OrderStatus;
    flags: OrderFlag[];
    distanceM: number;
    accuracyM: number;
    lat: number | null;
    lng: number | null;
    shopLat: number | null;
    shopLng: number | null;
    trip?: string | null;
    note?: string | null;
    rejectReason?: string | null;
    lines: OrderItem[];
};

/** An order line joined with its product, split into cartons + pieces. */
export type OrderLine = {
    product: Product;
    ctn: number;
    pcs: number;
    qty: number; // base units
    unitPrice: number;
    discount: number;
    total: number;
    deliveredQty: number | null;
};

export type TripStatus = 'planned' | 'loaded' | 'in_progress' | 'closed';

export type Trip = {
    id: string;
    number: string;
    dm: string;
    route: string;
    vehicle: string;
    orders: number;
    delivered: number;
    failed: number;
    cashExpected: number;
    cashCollected: number;
    status: TripStatus;
    orderNumbers?: string[];
};

export type CollectionStatus = 'pending' | 'confirmed' | 'rejected';
export type Method = 'cash' | 'bkash' | 'nagad' | 'rocket' | 'bank' | 'cheque';

export type Collection = {
    number: string;
    shopId: string;
    by: string;
    method: Method;
    reference?: string | null;
    amount: number;
    status: CollectionStatus;
    minutesAgo: number;
    orderNumber?: string | null;
    rejectReason?: string | null;
};

export type Deposit = {
    id: string;
    number: string;
    staff: string;
    amount: number;
    collections: number;
    minutesAgo: number;
    status: 'waiting' | 'confirmed';
};

/** Outstanding dues by age (taka). */
export type AgingBucket = {
    key: '0_30' | '31_60' | '60_plus';
    amount: number;
    shops: number;
};

export type ReturnRow = {
    number: string;
    shopId: string;
    type: 'at_delivery' | 'market';
    items: number;
    value: number;
    reason: 'damaged' | 'expired' | 'wrong_item' | 'not_needed' | 'other';
    condition: 'good' | 'damaged';
    by: string;
    status: 'pending' | 'approved' | 'rejected';
    minutesAgo: number;
    destination?: 'main' | 'damage' | null;
    rejectReason?: string | null;
    lines: { productId: string; qty: number; unitPrice: number }[];
};
