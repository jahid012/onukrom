import { Head } from '@inertiajs/react';
import {
    BarChart3,
    Download,
    FileDown,
    HandCoins,
    MapPinned,
    Package,
    Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Person } from '@/components/admin/bits';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import { SalesTrendChart } from '@/components/dashboard/sales-trend-chart';
import { TopProducts } from '@/components/dashboard/top-products';
import { DuesAgingChart } from '@/components/reports/dues-aging-chart';
import { SharePie } from '@/components/reports/share-pie';
import type { PieSlice } from '@/components/reports/share-pie';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { linesForOrder, useAdminData } from '@/data/admin/store';
import type { AdminData } from '@/data/admin/store';
import { staffByCode } from '@/data/admin/store';
import { periods } from '@/data/dashboard';
import type { Period } from '@/data/dashboard';
import { useAdmin } from '@/hooks/use-admin';
import { downloadCsv } from '@/lib/csv';
import { locationFlags } from '@/lib/order-status';
import { printReport } from '@/lib/print-report';
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

/** Order value per group, from live (not rejected/cancelled) orders. */
function salesBy(
    s: AdminData,
    keyOf: (o: AdminData['orders'][number]) => string,
): [string, number][] {
    const map = new Map<string, number>();
    s.orders
        .filter((o) => !['rejected', 'cancelled'].includes(o.status))
        .forEach((o) => {
            const k = keyOf(o);
            map.set(k, (map.get(k) ?? 0) + o.total);
        });

    return [...map.entries()];
}

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

/** CSV columns that hold taka amounts (formatted as money in the PDF). */
const moneyColumns = new Set([
    'value',
    'amount',
    'due',
    'credit_limit',
    'cash_expected',
    'cash_collected',
]);

export default function ReportsIndex() {
    const { t, f, name } = useAdmin();
    const state = useAdminData();
    const [period, setPeriod] = useState<Period>('30d');
    const shopName = (id: string) => {
        const shop = state.shops.find((x) => x.id === id);

        return shop ? name(shop) : id;
    };
    const routeOf = (shopId: string) =>
        state.shops.find((x) => x.id === shopId)?.route ?? '';
    const bySr: PieSlice[] = salesBy(state, (o) => o.sr).map(
        ([code, value]) => ({
            key: code,
            label: staffByCode(code).name,
            value,
        }),
    );
    const byRoute: PieSlice[] = salesBy(state, (o) => routeOf(o.shopId)).map(
        ([route, value]) => ({
            key: route || '-',
            label: route || t('reports.charts.noRoute'),
            value,
        }),
    );
    const byMethod: PieSlice[] = (
        state.dashboard?.collectionsByMethod ?? []
    ).map((m) => ({
        key: m.key,
        label: t(`dashboard.collections.methods.${m.key}`),
        value: m.amount,
    }));
    const trend = state.dashboard?.trends[period] ?? [];
    const topProducts = state.dashboard?.topProducts ?? [];
    const salesReps = state.dashboard?.salesReps ?? [];
    const printedAt = t('reports.printedAt', {
        date: f.date(new Date(), {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }),
    });

    const report = (key: ReportKey) => {
        const built = buildReport(key, state, shopName);

        if (built.rows.length === 0) {
            toast(t('reports.empty'));

            return null;
        }

        return built;
    };

    const download = (key: ReportKey) => {
        const built = report(key);

        if (!built) {
            return;
        }

        downloadCsv(`report-${key}`, built.header, built.rows);
        toast.success(
            t('reports.downloaded', {
                name: t(`reports.items.${key}.title`),
                n: f.num(built.rows.length),
            }),
        );
    };

    const pdf = (key: ReportKey) => {
        const built = report(key);

        if (!built) {
            return;
        }

        const numeric = built.header
            .map((_, i) => (typeof built.rows[0][i] === 'number' ? i : -1))
            .filter((i) => i >= 0);
        const opened = printReport({
            title: t(`reports.items.${key}.title`),
            company: state.company.name,
            meta: printedAt,
            header: built.header,
            rows: built.rows,
            numeric,
            format: (v, i) =>
                typeof v !== 'number'
                    ? v
                    : moneyColumns.has(built.header[i])
                      ? f.taka(v)
                      : f.num(v),
        });

        if (!opened) {
            toast.error(t('reports.popupBlocked'));
        }
    };

    const empty = (text: string) => (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {text}
        </p>
    );

    return (
        <>
            <Head title={t('reports.title')} />
            <PageBody className="print-area print-landscape">
                <PageHeader
                    title={t('reports.title')}
                    description={t('reports.description')}
                    actions={
                        <div className="flex flex-wrap items-center gap-2 print:hidden">
                            <ToggleGroup
                                type="single"
                                variant="outline"
                                size="sm"
                                value={period}
                                onValueChange={(v) =>
                                    v && setPeriod(v as Period)
                                }
                                aria-label={t('dashboard.periodLabel')}
                                className="bg-card"
                            >
                                {periods.map((p) => (
                                    <ToggleGroupItem
                                        key={p}
                                        value={p}
                                        className="px-3"
                                    >
                                        {t(`period.${p}`)}
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>
                            <Button size="sm" onClick={() => window.print()}>
                                <FileDown className="size-3.5" />
                                {t('reports.pdf')}
                            </Button>
                        </div>
                    }
                />

                {/* Print-only line under the title: which company, when. */}
                <p className="hidden text-sm text-muted-foreground print:block">
                    {state.company.name} · {printedAt}
                </p>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 print:grid-cols-3">
                    {trend.length > 0 ? (
                        <SalesTrendChart data={trend} period={period} />
                    ) : (
                        <Panel className="lg:col-span-2">
                            <PanelHeader title={t('dashboard.trend.title')} />
                            {empty(t('reports.charts.empty'))}
                        </Panel>
                    )}
                    <DuesAgingChart aging={state.aging} />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-3">
                    <SharePie
                        title={t('reports.charts.bySr.title')}
                        subtitle={t('reports.charts.bySr.subtitle')}
                        slices={bySr}
                    />
                    <SharePie
                        title={t('reports.charts.byRoute.title')}
                        subtitle={t('reports.charts.byRoute.subtitle')}
                        slices={byRoute}
                    />
                    <SharePie
                        title={t('reports.charts.byMethod.title')}
                        subtitle={t('reports.charts.byMethod.subtitle')}
                        slices={byMethod}
                        keepOrder
                    />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 print:grid-cols-3">
                    <Panel className="lg:col-span-2 print:col-span-2">
                        <PanelHeader
                            title={t('reports.perfTitle')}
                            subtitle={t('reports.perfSubtitle')}
                            action={
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-card print:hidden"
                                    onClick={() => download('visits')}
                                >
                                    <Download className="size-3.5" />
                                    {t('reports.download')}
                                </Button>
                            }
                        />
                        {salesReps.length === 0 ? (
                            empty(t('reports.charts.noReps'))
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[560px] text-sm">
                                    <thead className="border-b bg-background text-xs text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium">
                                                {t('reports.cols.sr')}
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
                                        {salesReps.map((r) => (
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
                                                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                                                    {f.taka(r.sales)}
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
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>
                    {topProducts.length > 0 ? (
                        <TopProducts products={topProducts} />
                    ) : (
                        <Panel>
                            <PanelHeader
                                title={t('dashboard.products.title')}
                            />
                            {empty(t('reports.charts.empty'))}
                        </Panel>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 print:hidden">
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
                                        <div className="flex shrink-0 gap-1.5">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="bg-card"
                                                onClick={() => pdf(r)}
                                                aria-label={`${t(`reports.items.${r}.title`)} PDF`}
                                            >
                                                <FileDown className="size-3.5" />
                                                PDF
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="bg-card"
                                                onClick={() => download(r)}
                                                aria-label={`${t(`reports.items.${r}.title`)} CSV`}
                                            >
                                                <Download className="size-3.5" />
                                                CSV
                                            </Button>
                                        </div>
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
