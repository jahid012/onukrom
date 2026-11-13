/**
 * Step-by-step page guides. A step points at an element marked
 * `data-tour="<target>"`; steps whose element is not on the page are
 * skipped, so the shared steps (title, actions, help) work everywhere.
 * Texts live in locales/<lang>/tour.json under tour.<page>.*.
 */
export type TourStep = {
    /** data-tour value of the element to highlight; null = centered card. */
    target: string | null;
    /** Key under tour.* for the heading and the text. */
    title: string;
    body: string;
};

export type TourId =
    | 'dashboard'
    | 'orders'
    | 'deliveries'
    | 'collections'
    | 'returns'
    | 'shops'
    | 'areas'
    | 'products'
    | 'pricing'
    | 'stock'
    | 'staff'
    | 'roles'
    | 'settings'
    | 'reports'
    | 'billing'
    | 'support';

/** Title + actions + (page extra) + "open again", the shape most pages share. */
function pageTour(id: TourId, extra?: string): TourStep[] {
    return [
        { target: 'page-title', title: `${id}.title`, body: `${id}.intro` },
        {
            target: 'page-actions',
            title: 'common.actionsTitle',
            body: `${id}.actions`,
        },
        ...(extra
            ? [
                  {
                      target: extra,
                      title: `${id}.extraTitle`,
                      body: `${id}.extra`,
                  },
              ]
            : []),
        {
            target: 'help-button',
            title: 'common.helpTitle',
            body: 'common.help',
        },
    ];
}

export const tours: Record<TourId, TourStep[]> = {
    dashboard: [
        {
            target: null,
            title: 'dashboard.welcomeTitle',
            body: 'dashboard.welcome',
        },
        {
            target: 'getting-started',
            title: 'dashboard.setupTitle',
            body: 'dashboard.setup',
        },
        {
            target: 'sidebar',
            title: 'dashboard.menuTitle',
            body: 'dashboard.menu',
        },
        {
            target: 'kpis',
            title: 'dashboard.kpisTitle',
            body: 'dashboard.kpis',
        },
        {
            target: 'notifications',
            title: 'dashboard.bellTitle',
            body: 'dashboard.bell',
        },
        {
            target: 'help-button',
            title: 'common.helpTitle',
            body: 'common.help',
        },
    ],
    orders: pageTour('orders', 'page-tabs'),
    deliveries: pageTour('deliveries'),
    collections: pageTour('collections', 'page-tabs'),
    returns: pageTour('returns'),
    shops: pageTour('shops', 'page-tabs'),
    areas: pageTour('areas', 'areas-tree'),
    products: pageTour('products'),
    pricing: pageTour('pricing'),
    stock: pageTour('stock', 'page-tabs'),
    staff: pageTour('staff'),
    roles: pageTour('roles'),
    settings: pageTour('settings'),
    reports: pageTour('reports'),
    billing: pageTour('billing', 'billing-plans'),
    support: pageTour('support'),
};

/** Which guide belongs to the page at this path. */
export function tourForPath(path: string): TourId | null {
    const first = path.replace(/^\/+/, '').split('/')[0] ?? '';
    const map: Record<string, TourId> = {
        dashboard: 'dashboard',
        orders: 'orders',
        deliveries: 'deliveries',
        collections: 'collections',
        returns: 'returns',
        shops: 'shops',
        areas: 'areas',
        products: 'products',
        pricing: 'pricing',
        stock: 'stock',
        staff: 'staff',
        roles: 'roles',
        company: 'settings',
        reports: 'reports',
        billing: 'billing',
        support: 'support',
    };

    return map[first] ?? null;
}
