import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import type { CollectionMethod } from '@/data/dashboard';
import { useFormat } from '@/hooks/use-format';

/**
 * Part-to-whole as one segmented bar (≤ 6 parts) with 2px gaps,
 * plus a legend that names every part with its amount and share.
 */
export function CollectionsBreakdown({
    methods,
    cashWithStaff,
}: {
    methods: CollectionMethod[];
    cashWithStaff: number;
}) {
    const { t, f } = useFormat();
    const total = methods.reduce((s, m) => s + m.amount, 0);
    const share = (m: CollectionMethod) =>
        total > 0 ? (m.amount / total) * 100 : 0;
    const label = (m: CollectionMethod) =>
        t(`dashboard.collections.methods.${m.key}`);

    return (
        <Panel>
            <PanelHeader
                title={t('dashboard.collections.title')}
                subtitle={t('dashboard.collections.subtitle')}
            />
            <div className="flex flex-col gap-4 px-4 py-3">
                <div>
                    <p className="text-xs text-muted-foreground">
                        {t('dashboard.collections.total')}
                    </p>
                    <p className="text-xl font-semibold tabular-nums">
                        {f.taka(total)}
                    </p>
                </div>

                <div
                    className="flex h-3 w-full gap-0.5"
                    role="img"
                    aria-label={methods
                        .map((m) => `${label(m)} ${f.percent(share(m))}`)
                        .join(', ')}
                >
                    {methods.map((m, i) => (
                        <div
                            key={m.key}
                            className="h-full transition-opacity hover:opacity-80"
                            style={{
                                width: `${share(m)}%`,
                                background: m.color,
                                borderTopLeftRadius: i === 0 ? 4 : 0,
                                borderBottomLeftRadius: i === 0 ? 4 : 0,
                                borderTopRightRadius:
                                    i === methods.length - 1 ? 4 : 0,
                                borderBottomRightRadius:
                                    i === methods.length - 1 ? 4 : 0,
                            }}
                            title={`${label(m)}: ${f.taka(m.amount)} (${f.percent(share(m), 1)})`}
                        />
                    ))}
                </div>

                <ul className="flex flex-col gap-2">
                    {methods.map((m) => (
                        <li
                            key={m.key}
                            className="flex items-center justify-between gap-2 text-sm"
                        >
                            <span className="flex items-center gap-2">
                                <span
                                    className="size-2.5 rounded-sm"
                                    style={{ background: m.color }}
                                    aria-hidden
                                />
                                {label(m)}
                            </span>
                            <span className="flex items-baseline gap-2 tabular-nums">
                                <span className="font-medium">
                                    {f.taka(m.amount)}
                                </span>
                                <span className="w-10 text-right text-xs text-muted-foreground">
                                    {f.percent(share(m))}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>

                <div className="flex items-center justify-between gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm">
                    <span className="text-warning-ink">
                        {t('dashboard.collections.cashWithStaff')}
                    </span>
                    <span className="font-semibold whitespace-nowrap text-warning-ink tabular-nums">
                        {f.taka(cashWithStaff)}
                    </span>
                </div>
            </div>
        </Panel>
    );
}
