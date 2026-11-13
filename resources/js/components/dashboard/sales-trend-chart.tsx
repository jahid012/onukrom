import {
    CartesianGrid,
    LabelList,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import type { Period, TrendPoint } from '@/data/dashboard';
import { useFormat } from '@/hooks/use-format';

const seriesKeys = ['ordered', 'delivered'] as const;
const colors = { ordered: 'var(--chart-1)', delivered: 'var(--chart-2)' };

export function SalesTrendChart({
    data,
    period,
}: {
    data: TrendPoint[];
    period: Period;
}) {
    const { t, f } = useFormat();
    const monthly = period === '12m';

    const label = (iso: string, long = false) =>
        f.date(
            new Date(`${iso}T00:00:00`),
            monthly
                ? {
                      month: long ? 'long' : 'short',
                      ...(long && { year: 'numeric' }),
                  }
                : { day: 'numeric', month: long ? 'long' : 'short' },
        );

    const totals = {
        ordered: data.reduce((s, p) => s + p.ordered, 0),
        delivered: data.reduce((s, p) => s + p.delivered, 0),
    };
    const deliveryRate =
        totals.ordered > 0 ? (totals.delivered / totals.ordered) * 100 : 0;
    const lastIndex = data.length - 1;

    return (
        <Panel className="lg:col-span-2">
            <PanelHeader
                title={t('dashboard.trend.title')}
                subtitle={t('dashboard.trend.subtitle', {
                    period: t(`period.${period}`),
                })}
                action={
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium whitespace-nowrap text-accent-foreground tabular-nums">
                        {t('dashboard.trend.rate', {
                            pct: f.percent(deliveryRate, 1),
                        })}
                    </span>
                }
            />

            {/* Legend — always present for 2 series; carries the totals too. */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 pt-3">
                {seriesKeys.map((key) => (
                    <div key={key} className="flex items-center gap-2">
                        <span
                            className="h-0.5 w-4 rounded-full"
                            style={{ background: colors[key] }}
                            aria-hidden
                        />
                        <span className="text-xs text-muted-foreground">
                            {t(`dashboard.trend.${key}`)}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                            {f.taka(totals[key])}
                        </span>
                    </div>
                ))}
            </div>

            <div className="min-h-72 flex-1 px-2 pt-2 pb-3">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{ top: 16, right: 64, bottom: 0, left: 4 }}
                    >
                        <CartesianGrid
                            vertical={false}
                            stroke="var(--chart-grid)"
                        />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={{ stroke: 'var(--border)' }}
                            tick={{
                                fill: 'var(--muted-foreground)',
                                fontSize: 11,
                            }}
                            tickFormatter={(v: string) => label(v)}
                            interval="preserveStartEnd"
                            minTickGap={24}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            width={88}
                            tick={{
                                fill: 'var(--muted-foreground)',
                                fontSize: 11,
                            }}
                            tickFormatter={(v: number) => f.takaShort(v)}
                        />
                        <Tooltip
                            cursor={{
                                stroke: 'var(--muted-foreground)',
                                strokeWidth: 1,
                            }}
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) {
                                    return null;
                                }

                                const p = payload[0].payload as TrendPoint;

                                return (
                                    <div className="min-w-44 rounded-md border bg-popover p-2.5 text-xs">
                                        <p className="mb-1.5 font-medium">
                                            {label(p.date, true)}
                                        </p>
                                        {seriesKeys.map((key) => (
                                            <div
                                                key={key}
                                                className="flex items-center justify-between gap-4 py-0.5"
                                            >
                                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                                    <span
                                                        className="size-2 rounded-full"
                                                        style={{
                                                            background:
                                                                colors[key],
                                                        }}
                                                    />
                                                    {t(
                                                        `dashboard.trend.${key}`,
                                                    )}
                                                </span>
                                                <span className="font-medium tabular-nums">
                                                    {f.taka(p[key])}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            }}
                        />
                        {seriesKeys.map((key) => (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={colors[key]}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{
                                    r: 5,
                                    stroke: 'var(--card)',
                                    strokeWidth: 2,
                                }}
                                isAnimationActive={false}
                            >
                                {/* Direct label at the line end (secondary encoding). */}
                                <LabelList
                                    dataKey={key}
                                    content={({ x, y, index }) =>
                                        index === lastIndex ? (
                                            <text
                                                x={Number(x) + 8}
                                                y={
                                                    Number(y) +
                                                    (key === 'ordered'
                                                        ? -4
                                                        : 12)
                                                }
                                                fontSize={11}
                                                fill="var(--muted-foreground)"
                                            >
                                                {t(`dashboard.trend.${key}`)}
                                            </text>
                                        ) : null
                                    }
                                />
                            </Line>
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Panel>
    );
}
