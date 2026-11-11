import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Delta, Panel } from '@/components/dashboard/primitives';
import type { Kpi, Period } from '@/data/dashboard';
import { useAdminData } from '@/data/admin/store';
import { useFormat } from '@/hooks/use-format';

export function KpiCard({ kpi, period }: { kpi: Kpi; period: Period }) {
    const { t, f } = useFormat();
    const kpiFacts = useAdminData().dashboard?.kpiFacts ?? {
        avgOrder: 0,
        collectedShare: 0,
        shopsWithDue: 0,
        overLimit: 0,
    };
    const data = kpi.spark.map((v, i) => ({ i, v }));
    const show = (v: number) => (kpi.money ? f.taka(v) : f.num(v));

    const hint = {
        sales: t('dashboard.kpi.salesHint', { period: t(`period.${period}`) }),
        orders: t('dashboard.kpi.ordersHint', {
            amount: f.taka(kpiFacts.avgOrder),
        }),
        collections: t('dashboard.kpi.collectionsHint', {
            pct: f.percent(kpiFacts.collectedShare),
        }),
        dues: t('dashboard.kpi.duesHint', {
            shops: f.num(kpiFacts.shopsWithDue),
            over: f.num(kpiFacts.overLimit),
        }),
    }[kpi.key];

    return (
        <Panel className="gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                    {t(`dashboard.kpi.${kpi.key}`)}
                </p>
                <Delta value={kpi.change} goodWhenUp={kpi.goodWhenUp} />
            </div>

            <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {show(kpi.value)}
            </p>

            <div className="h-10" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
                    >
                        <Tooltip
                            cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                            content={({ active, payload }) =>
                                active && payload?.length ? (
                                    <div className="rounded-md border bg-popover px-2 py-1 text-xs tabular-nums">
                                        {show(Number(payload[0].value))}
                                    </div>
                                ) : null
                            }
                        />
                        <Area
                            type="monotone"
                            dataKey="v"
                            stroke="var(--chart-1)"
                            strokeWidth={2}
                            fill="var(--chart-1)"
                            fillOpacity={0.12}
                            dot={false}
                            activeDot={{
                                r: 4,
                                stroke: 'var(--card)',
                                strokeWidth: 2,
                            }}
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <p className="text-xs text-muted-foreground">{hint}</p>
        </Panel>
    );
}
