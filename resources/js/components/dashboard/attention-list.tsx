import { Link } from '@inertiajs/react';
import {
    CheckCircle2,
    ChevronRight,
    MapPinOff,
    PackageMinus,
    Store,
    TriangleAlert,
    Truck,
    Wallet,
    WifiOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import { mainWarehouseId, useAdminData } from '@/data/admin/store';
import { useFormat } from '@/hooks/use-format';
import { locationFlags } from '@/lib/order-status';
import { cn } from '@/lib/utils';

type Item = {
    key: string;
    icon: LucideIcon;
    count: number;
    severity: 'danger' | 'warning' | 'info';
    detail: Record<string, string>;
    href: string;
};

const tone = {
    danger: 'bg-danger-soft text-danger-ink',
    warning: 'bg-warning-soft text-warning-ink',
    info: 'bg-info-soft text-info-ink',
} as const;

/** What the office should act on now — built from the company data. */
export function AttentionList() {
    const { t, f } = useFormat();
    const state = useAdminData();
    const { orders, deposits, shops, products, stock, staff } = state;

    const pending = orders.filter((o) => o.status === 'pending');
    const waitingCash = deposits.filter((d) => d.status === 'waiting');
    const located = orders.filter(
        (o) =>
            o.status === 'pending' &&
            o.flags.some((fl) => locationFlags.includes(fl)),
    );
    const failed = orders.filter((o) => o.status === 'failed');
    const newShops = shops.filter((s) => s.status === 'pending_approval');
    const low = products.filter((p) => {
        const l = stock[mainWarehouseId(state)]?.[p.id];

        return p.active && l && l.onHand - l.reserved < p.reorderAt;
    });
    const offline = staff.filter(
        (s) => s.status === 'active' && (s.lastSyncMin ?? 0) >= 1440,
    );

    const items: Item[] = [
        {
            key: 'approve',
            icon: TriangleAlert,
            count: pending.length,
            severity: 'warning',
            detail: {
                amount: f.taka(pending.reduce((s, o) => s + o.total, 0)),
                hours: f.num(
                    Math.floor(
                        Math.max(0, ...pending.map((o) => o.minutesAgo)) / 60,
                    ),
                ),
            },
            href: '/orders?tab=pending',
        },
        {
            key: 'cash',
            icon: Wallet,
            count: waitingCash.length,
            severity: 'warning',
            detail: {
                amount: f.taka(waitingCash.reduce((s, d) => s + d.amount, 0)),
                staff: f.num(new Set(waitingCash.map((d) => d.staff)).size),
            },
            href: '/collections?tab=deposits',
        },
        {
            key: 'location',
            icon: MapPinOff,
            count: located.length,
            severity: 'danger',
            detail: {
                far: f.num(
                    located.filter((o) => o.flags.includes('far_from_shop'))
                        .length,
                ),
                mock: f.num(
                    located.filter((o) => o.flags.includes('mock')).length,
                ),
            },
            href: '/orders?tab=pending&issues=1',
        },
        {
            key: 'failed',
            icon: Truck,
            count: failed.length,
            severity: 'danger',
            detail: {},
            href: '/orders?tab=closed',
        },
        {
            key: 'shops',
            icon: Store,
            count: newShops.length,
            severity: 'info',
            detail: {},
            href: '/shops?tab=pending',
        },
        {
            key: 'stock',
            icon: PackageMinus,
            count: low.length,
            severity: 'warning',
            detail: {},
            href: '/stock',
        },
        {
            key: 'offline',
            icon: WifiOff,
            count: offline.length,
            severity: 'info',
            detail: {
                names: offline
                    .map((s) => `${s.name.split(' ')[0]} (${s.code})`)
                    .join(', '),
            },
            href: '/staff',
        },
    ].filter((i) => i.count > 0) as Item[];

    const total = items.reduce((s, i) => s + i.count, 0);

    return (
        <Panel>
            <PanelHeader
                title={t('dashboard.attention.title')}
                subtitle={t('dashboard.attention.subtitle')}
                action={
                    total > 0 ? (
                        <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-ink tabular-nums">
                            {f.num(total)}
                        </span>
                    ) : undefined
                }
            />
            {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                    <CheckCircle2 className="size-8 text-success" aria-hidden />
                    <p className="text-sm font-medium">
                        {t('dashboard.attention.allClear')}
                    </p>
                </div>
            ) : (
                <ul className="divide-y">
                    {items.map((item) => {
                        const base = `dashboard.attention.items.${item.key}`;

                        return (
                            <li key={item.key}>
                                <Link
                                    href={item.href}
                                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                                >
                                    <span
                                        className={cn(
                                            'flex size-8 shrink-0 items-center justify-center rounded-md',
                                            tone[item.severity],
                                        )}
                                    >
                                        <item.icon
                                            className="size-4"
                                            aria-hidden
                                        />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium">
                                            {t(`${base}.title`)}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {t(`${base}.detail`, item.detail)}
                                        </span>
                                    </span>
                                    <span className="text-sm font-semibold tabular-nums">
                                        {f.num(item.count)}
                                    </span>
                                    <ChevronRight
                                        className="size-4 text-muted-foreground"
                                        aria-hidden
                                    />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}
