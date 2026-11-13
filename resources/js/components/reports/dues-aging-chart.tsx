import {
    Bar,
    BarChart,
    CartesianGrid,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import type { AgingBucket } from '@/data/admin/sales';
import { useAdmin } from '@/hooks/use-admin';

/**
 * Outstanding dues per age bucket. One series, so one hue and no legend; the
 * buckets are ordered (young → old), so they keep their order, not ranked.
 */
export function DuesAgingChart({ aging }: { aging: AgingBucket[] }) {
    const { t, f } = useAdmin();
    const data = aging.map((a) => ({
        ...a,
        label: t(`collections.dues.bucket.${a.key}`),
    }));
    const total = aging.reduce((s, a) => s + a.amount, 0);

    return (
        <Panel>
            <PanelHeader
                title={t('collections.dues.aging')}
                subtitle={t('reports.charts.agingSubtitle', {
                    total: f.taka(total),
                })}
            />
            {total === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {t('reports.charts.noDues')}
                </p>
            ) : (
                <div className="h-64 px-2 pt-4 pb-3">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            margin={{ top: 20, right: 8, bottom: 0, left: 4 }}
                        >
                            <CartesianGrid
                                vertical={false}
                                stroke="var(--chart-grid)"
                            />
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={{ stroke: 'var(--border)' }}
                                tick={{
                                    fill: 'var(--muted-foreground)',
                                    fontSize: 11,
                                }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                width={72}
                                tick={{
                                    fill: 'var(--muted-foreground)',
                                    fontSize: 11,
                                }}
                                tickFormatter={(v: number) => f.takaShort(v)}
                            />
                            <Tooltip
                                cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
                                content={({ active, payload }) => {
                                    if (!active || !payload?.length) {
                                        return null;
                                    }

                                    const b = payload[0]
                                        .payload as (typeof data)[number];

                                    return (
                                        <div className="rounded-md border bg-popover p-2.5 text-xs">
                                            <p className="mb-1 font-medium">
                                                {b.label}
                                            </p>
                                            <p className="tabular-nums">
                                                {f.taka(b.amount)} ·{' '}
                                                {t('collections.dues.shops', {
                                                    n: f.num(b.shops),
                                                })}
                                            </p>
                                        </div>
                                    );
                                }}
                            />
                            <Bar
                                dataKey="amount"
                                fill="var(--chart-1)"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={56}
                                isAnimationActive={false}
                            >
                                <LabelList
                                    dataKey="amount"
                                    position="top"
                                    fontSize={11}
                                    fill="var(--muted-foreground)"
                                    formatter={(v: number) => f.takaShort(v)}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </Panel>
    );
}
