import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import { useAdmin } from '@/hooks/use-admin';

export type PieSlice = { key: string; label: string; value: number };

/** Categorical slots in fixed order; slot 5 (gray) is reserved for "Other". */
const colors = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
];
const otherColor = 'var(--chart-5)';
const OTHER = '__other';

/**
 * Part-to-whole pie (donut) for one money split. At most 4 named slices +
 * "Other", so every slice keeps its own color. Each slice is named with its
 * amount and share in the legend below (identity is never color alone), and
 * a 2px card-colored gap separates neighbours.
 */
export function SharePie({
    title,
    subtitle,
    slices,
    keepOrder = false,
}: {
    title: string;
    subtitle: string;
    slices: PieSlice[];
    /** Fixed categories (e.g. payment methods): keep their order and colors. */
    keepOrder?: boolean;
}) {
    const { t, f } = useAdmin();
    const positive = slices.filter((s) => s.value > 0);
    const sorted = keepOrder
        ? positive
        : [...positive].sort((a, b) => b.value - a.value);
    const shown =
        sorted.length > 5
            ? [
                  ...sorted.slice(0, 4),
                  {
                      key: OTHER,
                      label: t('reports.charts.other'),
                      value: sorted
                          .slice(4)
                          .reduce((sum, s) => sum + s.value, 0),
                  },
              ]
            : sorted;
    const total = shown.reduce((sum, s) => sum + s.value, 0);
    const colorOf = (key: string) => {
        if (key === OTHER) {
            return otherColor;
        }

        const i = keepOrder
            ? slices.findIndex((s) => s.key === key)
            : shown.findIndex((s) => s.key === key);

        return colors[i] ?? otherColor;
    };
    const share = (v: number) => f.percent(total > 0 ? (v / total) * 100 : 0);

    return (
        <Panel>
            <PanelHeader title={title} subtitle={subtitle} />
            {total === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {t('reports.charts.empty')}
                </p>
            ) : (
                <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
                    <div className="relative mx-auto aspect-square w-full max-w-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={shown}
                                    dataKey="value"
                                    nameKey="label"
                                    innerRadius="62%"
                                    outerRadius="98%"
                                    startAngle={90}
                                    endAngle={-270}
                                    stroke="var(--card)"
                                    strokeWidth={2}
                                    isAnimationActive={false}
                                >
                                    {shown.map((s) => (
                                        <Cell
                                            key={s.key}
                                            fill={colorOf(s.key)}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) {
                                            return null;
                                        }

                                        const s = payload[0]
                                            .payload as PieSlice;

                                        return (
                                            <div className="rounded-md border bg-popover p-2.5 text-xs">
                                                <p className="mb-1 flex items-center gap-1.5 font-medium">
                                                    <span
                                                        className="size-2 rounded-full"
                                                        style={{
                                                            background: colorOf(
                                                                s.key,
                                                            ),
                                                        }}
                                                    />
                                                    {s.label}
                                                </p>
                                                <p className="tabular-nums">
                                                    {f.taka(s.value)} ·{' '}
                                                    {share(s.value)}
                                                </p>
                                            </div>
                                        );
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center: the whole the slices add up to. */}
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[11px] text-muted-foreground">
                                {t('reports.charts.total')}
                            </span>
                            <span className="text-sm font-semibold tabular-nums">
                                {f.takaShort(total)}
                            </span>
                        </div>
                    </div>
                    <ul className="flex flex-col gap-1.5">
                        {shown.map((s) => (
                            <li
                                key={s.key}
                                className="flex items-center gap-2 text-sm"
                            >
                                <span
                                    className="size-2.5 shrink-0 rounded-sm"
                                    style={{ background: colorOf(s.key) }}
                                    aria-hidden
                                />
                                <span className="min-w-0 flex-1 truncate">
                                    {s.label}
                                </span>
                                <span className="font-medium tabular-nums">
                                    {f.taka(s.value)}
                                </span>
                                <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                                    {share(s.value)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Panel>
    );
}
