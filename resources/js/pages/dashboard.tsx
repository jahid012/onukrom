import { Head, usePage } from '@inertiajs/react';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AttentionList } from '@/components/dashboard/attention-list';
import { CollectionsBreakdown } from '@/components/dashboard/collections-breakdown';
import { FieldActivity } from '@/components/dashboard/field-activity';
import { FieldTeam } from '@/components/dashboard/field-team';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { OrderPipeline } from '@/components/dashboard/order-pipeline';
import { SalesTrendChart } from '@/components/dashboard/sales-trend-chart';
import { ShopHealth } from '@/components/dashboard/shop-health';
import { TopProducts } from '@/components/dashboard/top-products';
import { GettingStarted } from '@/components/tour/getting-started';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Period } from '@/data/dashboard';
import { periods } from '@/data/dashboard';
import { loadState, useAdminData } from '@/data/admin/store';
import { useFormat } from '@/hooks/use-format';
import { dashboard } from '@/routes';

function greetingKey(date: Date) {
    const h = date.getHours();

    if (h < 12) {
        return 'dashboard.greeting.morning';
    }

    if (h < 17) {
        return 'dashboard.greeting.afternoon';
    }

    return 'dashboard.greeting.evening';
}

export default function Dashboard() {
    const { auth } = usePage().props;
    const { t, f } = useFormat();
    const { company, dashboard: data } = useAdminData();
    const [period, setPeriod] = useState<Period>('30d');
    const [updatedAt, setUpdatedAt] = useState(() => new Date());

    const today = f.date(updatedAt, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    const time = f.date(updatedAt, { hour: 'numeric', minute: '2-digit' });

    return (
        <>
            <Head title={t('dashboard.title')} />

            <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
                {/* Page header */}
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">
                            {t(greetingKey(updatedAt), {
                                name: auth.user.name.split(' ')[0],
                            })}
                        </h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            {company.name} · {today}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            size="sm"
                            value={period}
                            onValueChange={(v) => v && setPeriod(v as Period)}
                            aria-label={t('dashboard.periodLabel')}
                            className="bg-card"
                        >
                            {periods.map((p) => (
                                <ToggleGroupItem
                                    key={p}
                                    value={p}
                                    className="px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                                >
                                    {t(`period.${p}`)}
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-card"
                            onClick={() => {
                                void loadState().then(() => {
                                    setUpdatedAt(new Date());
                                    toast.success(t('dashboard.refreshed'));
                                });
                            }}
                        >
                            <RefreshCw className="size-3.5" />
                            {t('dashboard.updated', { time })}
                        </Button>
                    </div>
                </div>

                {/* KPIs */}
                <GettingStarted />

                <div
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
                    data-tour="kpis"
                >
                    {data?.kpis[period].map((k) => (
                        <KpiCard key={k.key} kpi={k} period={period} />
                    ))}
                </div>

                {/* Trend + what needs action */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <SalesTrendChart
                        data={data?.trends[period] ?? []}
                        period={period}
                    />
                    <AttentionList />
                </div>

                {/* Order flow */}
                <OrderPipeline />

                {/* Team */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <FieldTeam
                        salesReps={data?.salesReps ?? []}
                        deliveryMen={data?.deliveryMen ?? []}
                    />
                    {data && <FieldActivity {...data.fieldToday} />}
                </div>

                {/* Catalog, money, customers */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <TopProducts products={data?.topProducts ?? []} />
                    <CollectionsBreakdown
                        methods={data?.collectionsByMethod ?? []}
                        cashWithStaff={data?.cashWithStaff ?? 0}
                    />
                    {data && <ShopHealth {...data.shopHealth} />}
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'nav.dashboard',
            href: dashboard(),
        },
    ],
};
