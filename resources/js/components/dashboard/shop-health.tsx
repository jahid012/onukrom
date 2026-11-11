import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';

type Props = {
    total: number;
    active30d: number;
    noOrder30d: number;
    withDue: number;
    overLimit: number;
    newThisMonth: number;
    pendingApproval: number;
};

type Row = {
    key: Exclude<keyof Props, 'total'>;
    tone?: 'warning' | 'danger' | 'info';
};

const rows: Row[] = [
    { key: 'active30d' },
    { key: 'noOrder30d', tone: 'warning' },
    { key: 'withDue' },
    { key: 'overLimit', tone: 'danger' },
    { key: 'newThisMonth', tone: 'info' },
    { key: 'pendingApproval', tone: 'info' },
];

export function ShopHealth(p: Props) {
    const { t, f } = useFormat();
    const activeShare = (p.active30d / p.total) * 100;

    return (
        <Panel>
            <PanelHeader
                title={t('dashboard.shops.title')}
                subtitle={t('dashboard.shops.subtitle')}
            />
            <div className="flex flex-col gap-3 px-4 py-3">
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground">
                            {t('dashboard.shops.total')}
                        </p>
                        <p className="text-xl font-semibold tabular-nums">
                            {f.num(p.total)}
                        </p>
                    </div>
                    <p className="text-right text-xs text-muted-foreground">
                        <span className="text-base font-semibold text-foreground tabular-nums">
                            {f.percent(activeShare)}
                        </span>
                        <br />
                        {t('dashboard.shops.active')}
                    </p>
                </div>
                <ul className="flex flex-col divide-y rounded-md border">
                    {rows.map((r) => (
                        <li
                            key={r.key}
                            className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                            <span className="text-muted-foreground">
                                {t(`dashboard.shops.${r.key}`)}
                            </span>
                            <span
                                className={cn(
                                    'min-w-10 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums',
                                    !r.tone && 'bg-muted text-foreground',
                                    r.tone === 'warning' &&
                                        'bg-warning-soft text-warning-ink',
                                    r.tone === 'danger' &&
                                        'bg-danger-soft text-danger-ink',
                                    r.tone === 'info' &&
                                        'bg-info-soft text-info-ink',
                                )}
                            >
                                {f.num(p[r.key])}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </Panel>
    );
}
