import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import type { OrderStatus } from '@/data/admin/sales';
import { useAdminData } from '@/data/admin/store';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';

const stages: {
    key: string;
    statuses: OrderStatus[];
    tab: string;
    stripe: string;
}[] = [
    {
        key: 'pending',
        statuses: ['pending'],
        tab: 'pending',
        stripe: 'bg-warning',
    },
    {
        key: 'approved',
        statuses: ['approved'],
        tab: 'approved',
        stripe: 'bg-info',
    },
    {
        key: 'dispatched',
        statuses: ['dispatched'],
        tab: 'dispatched',
        stripe: 'bg-primary',
    },
    {
        key: 'delivered',
        statuses: ['delivered', 'partially_delivered'],
        tab: 'delivered',
        stripe: 'bg-success',
    },
];

const exceptions: { key: string; status: OrderStatus }[] = [
    { key: 'partial', status: 'partially_delivered' },
    { key: 'failed', status: 'failed' },
    { key: 'cancelled', status: 'rejected' },
];

/** Order flow from the phone to the shop — each stage opens the Orders tab. */
export function OrderPipeline() {
    const { t, f } = useFormat();
    const { orders } = useAdminData();

    const chips = exceptions.map((e) => (
        <Link
            key={e.key}
            href={`/orders?tab=${e.status === 'partially_delivered' ? 'delivered' : 'closed'}`}
            className="rounded-full border px-2 py-0.5 text-xs whitespace-nowrap text-muted-foreground hover:text-foreground"
        >
            {t(`dashboard.pipeline.${e.key}`)}{' '}
            <span className="font-semibold text-foreground tabular-nums">
                {f.num(
                    orders.filter(
                        (o) =>
                            o.status === e.status ||
                            (e.key === 'cancelled' && o.status === 'cancelled'),
                    ).length,
                )}
            </span>
        </Link>
    ));

    return (
        <Panel>
            <PanelHeader
                title={t('dashboard.pipeline.title')}
                subtitle={t('dashboard.pipeline.subtitle')}
                action={
                    <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                        {chips}
                    </div>
                }
            />
            <ol className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
                {stages.map((s, i) => {
                    const list = orders.filter((o) =>
                        s.statuses.includes(o.status),
                    );

                    return (
                        <li key={s.key} className="relative bg-card">
                            <Link
                                href={`/orders?tab=${s.tab}`}
                                className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted"
                            >
                                <span
                                    className={cn(
                                        'h-1 w-8 rounded-full',
                                        s.stripe,
                                    )}
                                    aria-hidden
                                />
                                <span className="mt-1 text-xs text-muted-foreground">
                                    {f.num(i + 1)}.{' '}
                                    {t(`dashboard.pipeline.${s.key}`)}
                                </span>
                                <span className="text-xl font-semibold tabular-nums">
                                    {f.num(list.length)}
                                </span>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {f.taka(
                                        list.reduce(
                                            (sum, o) => sum + o.total,
                                            0,
                                        ),
                                    )}
                                </span>
                            </Link>
                            {i < stages.length - 1 && (
                                <ChevronRight
                                    className="pointer-events-none absolute top-1/2 right-1 hidden size-4 -translate-y-1/2 text-muted-foreground/60 md:block"
                                    aria-hidden
                                />
                            )}
                        </li>
                    );
                })}
            </ol>
            <div className="flex flex-wrap gap-1.5 border-t px-4 py-2.5 sm:hidden">
                {chips}
            </div>
        </Panel>
    );
}
