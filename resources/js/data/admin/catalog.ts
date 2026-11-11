/**
 * Catalog types (products, pricing, stock) as received from /admin/state.
 * Money in taka, quantities in base units (pcs).
 */

export type Category = { key: string; name: string; name_bn: string };

export type Product = {
    id: string;
    sku: string;
    name: string;
    name_bn: string;
    brand: string;
    category: string;
    packSize: number;
    mrp: number; // per pc
    price: number; // default price list, per pc
    onHand: number; // pcs, main godown
    reserved: number;
    reorderAt: number;
    active: boolean;
    hue: number;
};

export type PriceList = {
    id: string;
    name: string;
    name_bn: string;
    appliesTo: 'default' | 'shop_category' | 'area';
    target?: string | null;
    products: number;
    shops: number;
    updatedDaysAgo: number;
    /** Kept for the store's fallback; lists have explicit prices. */
    delta: number;
};

export type Warehouse = {
    id: string;
    name: string;
    name_bn: string;
    type: 'main' | 'van' | 'damage';
    factor: number;
};

export type Movement = {
    id: string;
    productId: string;
    qty: number; // + in, − out (pcs)
    type: 'purchase' | 'reserve' | 'deliver' | 'return' | 'adjust' | 'transfer';
    reference: string;
    minutesAgo: number;
};
