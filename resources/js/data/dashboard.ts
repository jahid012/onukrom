/**
 * Dashboard data types. The numbers are computed on the server
 * (app/Admin/DashboardStats.php) and arrive in `state.dashboard`.
 * Labels are translated in the components; names entered by the company
 * stay as entered.
 */

export const periods = ['7d', '30d', '12m'] as const;
export type Period = (typeof periods)[number];

/** `date` is an ISO day (daily series) or the first day of the month (12m). */
export type TrendPoint = {
    date: string;
    ordered: number;
    delivered: number;
};

export type KpiKey = 'sales' | 'orders' | 'collections' | 'dues';

export type Kpi = {
    key: KpiKey;
    value: number;
    money: boolean;
    change: number; // % vs previous period
    goodWhenUp: boolean;
    spark: number[];
};

export type KpiFacts = {
    avgOrder: number;
    collectedShare: number;
    shopsWithDue: number;
    overLimit: number;
};

export type SalesRep = {
    name: string;
    code: string;
    route: string;
    visited: number;
    planned: number;
    orders: number;
    sales: number;
    lastSyncMin: number;
};

export type DeliveryMan = {
    name: string;
    code: string;
    trip: string;
    delivered: number;
    total: number;
    cash: number;
    lastSyncMin: number;
};

export type FieldToday = {
    onDuty: number;
    staff: number;
    visited: number;
    planned: number;
    ordersFromVisits: number;
    avgOrder: number;
};

export type TopProduct = {
    name: string;
    name_bn: string;
    sku: string;
    sales: number;
    cartons: number;
};

export type CollectionMethod = {
    key: 'cash' | 'bkash' | 'nagad' | 'bank';
    amount: number;
    color: string;
};

export type ShopHealthData = {
    total: number;
    active30d: number;
    noOrder30d: number;
    withDue: number;
    overLimit: number;
    newThisMonth: number;
    pendingApproval: number;
};

export type DashboardData = {
    trends: Record<Period, TrendPoint[]>;
    kpis: Record<Period, Kpi[]>;
    kpiFacts: KpiFacts;
    salesReps: SalesRep[];
    deliveryMen: DeliveryMan[];
    fieldToday: FieldToday;
    topProducts: TopProduct[];
    collectionsByMethod: CollectionMethod[];
    cashWithStaff: number;
    shopHealth: ShopHealthData;
};

export type Company = {
    name: string;
    code: string;
    plan: string;
    staffUsed: number;
    staffLimit: number;
    smsUsed: number;
    smsLimit: number;
};
