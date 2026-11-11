import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import type { TopProduct } from '@/data/dashboard';
import { useFormat } from '@/hooks/use-format';

/** Ranked bars — one series, one color (no value ramp on nominal items). */
export function TopProducts({ products }: { products: TopProduct[] }) {
    const { t, f, locale } = useFormat();
    const max = Math.max(...products.map((p) => p.sales));

    return (
        <Panel>
            <PanelHeader
                title={t('dashboard.products.title')}
                subtitle={t('dashboard.products.subtitle')}
            />
            <ol className="flex flex-col gap-3 px-4 py-3">
                {products.map((p, i) => {
                    const name = locale === 'bn' ? p.name_bn : p.name;
                    const qty = t('units.ctn', { n: f.num(p.cartons) });

                    return (
                        <li
                            key={p.sku}
                            className="group"
                            title={`${name}: ${f.taka(p.sales)} · ${qty}`}
                        >
                            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                                <span className="min-w-0 truncate">
                                    <span className="mr-1.5 text-xs text-muted-foreground tabular-nums">
                                        {f.num(i + 1)}
                                    </span>
                                    {name}
                                </span>
                                <span className="shrink-0 font-medium tabular-nums">
                                    {f.taka(p.sales)}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-2 flex-1 rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full bg-chart-1 transition-opacity group-hover:opacity-80"
                                        style={{
                                            width: `${(p.sales / max) * 100}%`,
                                        }}
                                    />
                                </div>
                                <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                                    {qty}
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </Panel>
    );
}
