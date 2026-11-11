import { MapPinned, Target, UserCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Meter, Panel, PanelHeader } from '@/components/dashboard/primitives';
import { useFormat } from '@/hooks/use-format';

type Props = {
    onDuty: number;
    staff: number;
    visited: number;
    planned: number;
    ordersFromVisits: number;
    avgOrder: number;
};

export function FieldActivity(p: Props) {
    const { t, f } = useFormat();
    const coverage = (p.visited / p.planned) * 100;
    const strike = (p.ordersFromVisits / p.visited) * 100;

    return (
        <Panel>
            <PanelHeader
                title={t('dashboard.activity.title')}
                subtitle={t('dashboard.activity.subtitle')}
            />
            <div className="flex flex-col divide-y">
                <Stat
                    icon={UserCheck}
                    label={t('dashboard.activity.onDuty')}
                    value={`${f.num(p.onDuty)} / ${f.num(p.staff)}`}
                    note={t('dashboard.activity.onDutyNote', {
                        n: f.num(p.staff - p.onDuty),
                    })}
                    meter={[p.onDuty, p.staff]}
                />
                <Stat
                    icon={MapPinned}
                    label={t('dashboard.activity.coverage')}
                    value={f.percent(coverage)}
                    note={t('dashboard.activity.coverageNote', {
                        visited: f.num(p.visited),
                        planned: f.num(p.planned),
                    })}
                    meter={[p.visited, p.planned]}
                />
                <Stat
                    icon={Target}
                    label={t('dashboard.activity.strike')}
                    value={f.percent(strike)}
                    note={t('dashboard.activity.strikeNote', {
                        orders: f.num(p.ordersFromVisits),
                        visits: f.num(p.visited),
                        avg: f.taka(p.avgOrder),
                    })}
                    meter={[p.ordersFromVisits, p.visited]}
                />
            </div>
        </Panel>
    );
}

function Stat({
    icon: Icon,
    label,
    value,
    note,
    meter,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    note: string;
    meter: [number, number];
}) {
    return (
        <div className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="size-4" aria-hidden />
                    {label}
                </span>
                <span className="text-lg font-semibold tabular-nums">
                    {value}
                </span>
            </div>
            <Meter value={meter[0]} max={meter[1]} label={label} />
            <p className="text-xs text-muted-foreground">{note}</p>
        </div>
    );
}
