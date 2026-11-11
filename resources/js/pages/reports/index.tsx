import { Head } from '@inertiajs/react';
import {
    BarChart3,
    Download,
    HandCoins,
    MapPinned,
    Package,
    Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Person } from '@/components/admin/bits';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { Meter, Panel, PanelHeader } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { linesForOrder, useAdminData } from '@/data/admin/store';
import type { AdminData } from '@/data/admin/store';
import { staffByCode } from '@/data/admin/store';
import { useAdmin } from '@/hooks/use-admin';
import { downloadCsv } from '@/lib/csv';
import { locationFlags } from '@/lib/order-status';
import { cn } from '@/lib/utils';
import { index as reportsIndex } from '@/routes/reports';

type ReportKey =
    | 'bySr'
    | 'byArea'
    | 'byProduct'
    | 'byShop'
    | 'visits'
    | 'location'
    | 'trips'
    | 'failed'
    | 'collections'
    | 'dues'
    | 'cashWithStaff'
    | 'stockLevels'
    | 'returns';

const groups: { key: string; icon: LucideIcon; reports: ReportKey[] }[] = [
    {
        key: 'sales',
        icon: BarChart3,
        reports: ['bySr', 'byArea', 'byProduct', 'byShop'],
    },
    { key: 'field', icon: MapPinned, reports: ['visits', 'location'] },
    { key: 'delivery', icon: Truck, reports: ['trips', 'failed'] },
    {
        key: 'money',
        icon: HandCoins,
        reports: ['collections', 'dues', 'cashWithStaff'],
    },
    { key: 'stock', icon: Package, reports: ['stockLevels', 'returns'] },
];

const targets: Record<string, number> = {
    SR07: 15_00_000,
    SR03: 12_00_000,
    SR15: 11_00_000,
    SR09: 9_00_000,
    SR12: 8_00_000,
};
const monthSales: Record<string, number> = {
    SR07: 13_84_200,
    SR03: 12_10_900,
    SR15: 8_62_300,
    SR09: 6_41_800,
    SR12: 2_95_400,
};

/** Build the rows for one report from the current data. */
function buildReport(
    key: ReportKey,
    s: AdminData,
    shopName: (id: string) => string,
): { header: string[]; rows: (string | number)[][] } {
    const live = s.orders.filter(
        (o) => !['rejected', 'cancelled'].includes(o.status),
    );
    const group = <K extends string>(
        keyOf: (o: (typeof live)[number]) => K,
    ) => {
        const map = new Map<K, { orders: number; value: number }>();
        live.forEach((o) => {
            const k = keyOf(o);
            const g = map.get(k) ?? { orders: 0, value: 0 };
            map.set(k, { orders: g.orders + 1, value: g.value + o.total });
        });

        return [...map.entries()];
    };
    const route = (shopId: string) =>
        s.shops.find((x) => x.id === shopId)?.route ?? '';

    switch (key) {
        case 'bySr':
            return {
                header: ['sr_code', 'name', 'orders', 'value'],
                rows: group((o) => o.sr).map(([k, g]) => [
                    k,
                    staffByCode(k).name,
                    g.orders,
                    g.value,
                ]),
            };
        case 'byArea':
            return {
                header: ['route', 'orders', 'value'],
                rows: group((o) => route(o.shopId)).map(([k, g]) => [
                    k,
                    g.orders,
                    g.value,
                ]),
            };
        case 'byProduct': {
            const map = new Map<string, { qty: number; value: number }>();
            live.flatMap(linesForOrder).forEach((l) => {
                const g = map.get(l.product.sku) ?? { qty: 0, value: 0 };
                map.set(l.product.sku, {
                    qty: g.qty + l.qty,
                    value: g.value + l.total,
                });
            });

            return {
                header: ['sku', 'name', 'qty_pcs', 'value'],
                rows: [...map.entries()].map(([sku, g]) => [
                    sku,
                    s.products.find((p) => p.sku === sku)?.name ?? sku,
                    g.qty,
                    g.value,
                ]),
            };
        }
        case 'byShop':
            return {
                header: ['shop', 'orders', 'value'],
                rows: group((o) => o.shopId).map(([k, g]) => [
                    shopName(k),
                    g.orders,
                    g.value,
                ]),
            };
        case 'visits':
            return {
                header: [
                    'sr_code',
                    'name',
                    'route',
                    'planned',
                    'visited',
                    'orders',
                    'strike_rate_%',
                ],
                rows: (s.dashboard?.salesReps ?? []).map((r) => [
                    r.code,
                    r.name,
                    r.route,
                    r.planned,
                    r.visited,
                    r.orders,
                    Math.round((r.orders / Math.max(1, r.visited)) * 100),
                ]),
            };
        case 'location':
            return {
                header: [
                    'order',
                    'shop',
                    'sr',
                    'distance_m',
                    'accuracy_m',
                    'flags',
                ],
                rows: s.orders
                    .filter((o) =>
                        o.flags.some((fl) => locationFlags.includes(fl)),
                    )
                    .map((o) => [
                        o.number,
                        shopName(o.shopId),
                        o.sr,
                        o.distanceM,
                        o.accuracyM,
                        o.flags.join(' '),
                    ]),
            };
        case 'trips':
            return {
                header: [
                    'trip',
                    'dm',
                    'route',
                    'orders',
                    'delivered',
                    'failed',
                    'cash_expected',
                    'cash_collected',
                    'status',
                ],
                rows: s.trips.map((x) => [
                    x.number,
                    staffByCode(x.dm).name,
                    x.route,
                    x.orders,
                    x.delivered,
                    x.failed,
                    x.cashExpected,
                    x.cashCollected,
                    x.status,
                ]),
            };
        case 'failed':
            return {
                header: ['order', 'shop', 'sr', 'value'],
                rows: s.orders
                    .filter((o) => o.status === 'failed')
                    .map((o) => [o.number, shopName(o.shopId), o.sr, o.total]),
            };
        case 'collections':
            return {
                header: [
                    'number',
                    'shop',
                    'collected_by',
                    'method',
                    'reference',
                    'amount',
                    'status',
                ],
                rows: s.collections.map((c) => [
                    c.number,
                    shopName(c.shopId),
                    staffByCode(c.by).name,
                    c.method,
                    c.reference ?? '',
                    c.amount,
                    c.status,
                ]),
            };
        case 'dues':
            return {
                header: ['code', 'shop', 'route', 'due', 'credit_limit'],
                rows: s.shops
                    .filter((x) => x.due > 0)
                    .map((x) => [
                        x.code,
                        x.name,
                        x.route,
                        x.due,
                        x.creditLimit,
                    ]),
            };
        case 'cashWithStaff':
            return {
                header: ['deposit', 'staff', 'amount', 'payments'],
                rows: s.deposits
                    .filter((d) => d.status === 'waiting')
                    .map((d) => [
                        d.id,
                        staffByCode(d.staff).name,
                        d.amount,
                        d.collections,
                    ]),
            };
        case 'stockLevels':
            return {
                header: [
                    'warehouse',
                    'sku',
                    'product',
                    'on_hand_pcs',
                    'reserved_pcs',
                ],
                rows: s.warehouses.flatMap((w) =>
                    s.products.map((p) => [
                        w.name,
                        p.sku,
                        p.name,
                        s.stock[w.id]?.[p.id]?.onHand ?? 0,
                        s.stock[w.id]?.[p.id]?.reserved ?? 0,
                    ]),
                ),
            };
        case 'returns':
            return {
                header: ['return', 'shop', 'type', 'reason', 'value', 'status'],
                rows: s.returns.map((r) => [
                    r.number,
                    shopName(r.shopId),
                    r.type,
                    r.reason,
                    r.value,
                    r.status,
                ]),
            };
    }
}

export default function ReportsIndex() {
    const { t, f, name } = useAdmin();
    const state = useAdminData();
    const shopName = (id: string) => {
        const shop = state.shops.find((x) => x.id === id);

        return shop ? name(shop) : id;
    };

    const download = (key: ReportKey) => {
        const { header, rows } = buildReport(key, state, shopName);

        if (rows.length === 0) {
            toast(t('reports.empty'));

            return;
        }

        downloadCsv(`report-${key}`, header, rows);
        toast.success(
            t('reports.downloaded', {
                name: t(`reports.items.${key}.title`),
                n: f.num(rows.length),
            }),
        );
    };

    return (
        <>
            <Head title={t('reports.title')} />
            <PageBody>
                <PageHeader
                    title={t('reports.title')}
                    description={t('reports.description')}
                />

                <Panel>
                    <PanelHeader
                        title={t('reports.perfTitle')}
                        subtitle={t('reports.perfSubtitle')}
                        action={
                            <Button
                                size="sm"
                                variant="outline"
                                className="bg-card"
                                onClick={() => download('visits')}
                            >
                                <Download className="size-3.5" />
                                {t('reports.download')}
                            </Button>
                        }
                    />
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-sm">
                            <thead className="border-b bg-background text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium">
                                        {t('reports.cols.sr')}
                                    </th>
                                    <th className="w-72 px-4 py-2 text-left font-medium">
                                        {t('reports.cols.target')}
                                    </th>
                                    <th className="px-4 py-2 text-right font-medium">
                                        {t('reports.cols.sales')}
                                    </th>
                                    <th className="px-4 py-2 text-right font-medium">
                                        {t('reports.cols.visits')}
                                    </th>
                                    <th className="px-4 py-2 text-right font-medium">
                                        {t('reports.cols.strike')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {(state.dashboard?.salesReps ?? []).map((r) => {
                                    const sales = monthSales[r.code] ?? r.sales;
                                    const target = targets[r.code] ?? sales;
                                    const pct = (sales / target) * 100;

                                    return (
                                        <tr
                                            key={r.code}
                                            className="hover:bg-muted/60"
                                        >
                                            <td className="px-4 py-2.5">
                                                <Person
                                                    name={r.name}
                                                    sub={`${r.code} · ${r.route}`}
                                                    size="sm"
                                                />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <Meter
                                                        value={sales}
                                                        max={target}
                                                        tone={
                                                            pct >= 90
                                                                ? 'primary'
                                                                : pct >= 60
                                                                  ? 'warning'
                                                                  : 'danger'
                                                        }
                                                        label={t(
                                                            'reports.cols.target',
                                                        )}
                                                    />
                                                    <span
                                                        className={cn(
                                                            'w-12 shrink-0 text-right text-xs font-medium tabular-nums',
                                                            pct < 60 &&
                                                                'text-danger-ink',
                                                        )}
                                                    >
                                                        {f.percent(pct)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                                                    {t('reports.ofTarget', {
                                                        target: f.taka(target),
                                                    })}
                                                </p>
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                                                {f.taka(sales)}
                                            </td>
                                            <td className="px-4 py-2.5 text-right tabular-nums">
                                                {f.num(r.visited)}/
                                                {f.num(r.planned)}
                                            </td>
                                            <td className="px-4 py-2.5 text-right tabular-nums">
                                                {f.percent(
                                                    (r.orders /
                                                        Math.max(
                                                            1,
                                                            r.visited,
                                                        )) *
                                                        100,
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Panel>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {groups.map((g) => (
                        <Panel key={g.key}>
                            <PanelHeader
                                title={t(`reports.groups.${g.key}`)}
                                action={
                                    <g.icon
                                        className="size-4 text-muted-foreground"
                                        aria-hidden
                                    />
                                }
                            />
                            <ul className="divide-y">
                                {g.reports.map((r) => (
                                    <li
                                        key={r}
                                        className="flex items-center gap-3 px-4 py-2.5"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium">
                                                {t(`reports.items.${r}.title`)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {t(`reports.items.${r}.text`)}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="shrink-0 bg-card"
                                            onClick={() => download(r)}
                                        >
                                            <Download className="size-3.5" />
                                            CSV
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    ))}
                </div>
            </PageBody>
        </>
    );
}

ReportsIndex.layout = {
    breadcrumbs: [{ title: 'nav.reports', href: reportsIndex() }],
};
