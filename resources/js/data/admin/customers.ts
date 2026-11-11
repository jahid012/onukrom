/**
 * Territory and shops as received from /admin/state.
 * Area / route names are entered by the company, so they stay as entered;
 * shops carry a Bangla name (`name_bn`) as in the spec.
 */

export type Day = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

export type Route = {
    id: string;
    name: string;
    code: string;
    visitDays: Day[];
    sr?: string | null; // staff code
    dm?: string | null;
    shops: number;
};

export type Area = { id: string; name: string; routes: Route[] };
export type Zone = { id: string; name: string; areas: Area[] };

export type ShopCategory = 'grocery' | 'pharmacy' | 'wholesale' | 'tea_stall';

export type Shop = {
    id: string;
    code: string;
    name: string;
    name_bn: string;
    owner: string;
    phone: string;
    route: string; // route name
    category: ShopCategory;
    due: number;
    creditLimit: number;
    lastOrderDays: number | null;
    hasLocation: boolean;
    lat?: number | null;
    lng?: number | null;
    status: 'active' | 'pending_approval' | 'inactive';
    addedBy?: string | null;
};
