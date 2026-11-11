import { useState } from 'react';
import {
    Meter,
    Panel,
    PanelHeader,
    SyncStatus,
} from '@/components/dashboard/primitives';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { DeliveryMan, SalesRep } from '@/data/dashboard';
import { useFormat } from '@/hooks/use-format';
import { useInitials } from '@/hooks/use-initials';

type Tab = 'sr' | 'dm';

export function FieldTeam({
    salesReps,
    deliveryMen,
}: {
    salesReps: SalesRep[];
    deliveryMen: DeliveryMan[];
}) {
    const { t } = useFormat();
    const [tab, setTab] = useState<Tab>('sr');

    return (
        <Panel className="lg:col-span-2">
            <PanelHeader
                title={t('dashboard.team.title')}
                subtitle={
                    tab === 'sr'
                        ? t('dashboard.team.subtitleSr')
                        : t('dashboard.team.subtitleDm')
                }
                action={
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        value={tab}
                        onValueChange={(v) => v && setTab(v as Tab)}
                    >
                        <ToggleGroupItem value="sr" className="px-3 text-xs">
                            {t('dashboard.team.tabSr')}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="dm" className="px-3 text-xs">
                            {t('dashboard.team.tabDm')}
                        </ToggleGroupItem>
                    </ToggleGroup>
                }
            />
            <div className="overflow-x-auto">
                {tab === 'sr' ? (
                    <SalesRepTable rows={salesReps} />
                ) : (
                    <DeliveryTable rows={deliveryMen} />
                )}
            </div>
        </Panel>
    );
}

const th =
    'px-4 py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground';
const td = 'px-4 py-2.5 align-middle';

function Person({ name, code }: { name: string; code: string }) {
    const initials = useInitials();

    return (
        <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {initials(name)}
            </span>
            <div className="min-w-0">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{code}</p>
            </div>
        </div>
    );
}

function Ratio({
    value,
    max,
    tone,
    label,
}: {
    value: number;
    max: number;
    tone: 'primary' | 'warning' | 'danger';
    label: string;
}) {
    const { f } = useFormat();

    return (
        <div className="flex items-center gap-2">
            <Meter value={value} max={max} tone={tone} label={label} />
            <span className="w-14 shrink-0 text-right text-xs tabular-nums">
                {f.num(value)}/{f.num(max)}
            </span>
        </div>
    );
}

function SalesRepTable({ rows }: { rows: SalesRep[] }) {
    const { t, f } = useFormat();

    return (
        <table className="w-full min-w-[660px] text-sm">
            <thead className="border-b bg-background">
                <tr>
                    <th className={th}>{t('dashboard.team.salesRep')}</th>
                    <th className={th}>{t('dashboard.team.route')}</th>
                    <th className={`${th} w-44`}>
                        {t('dashboard.team.visits')}
                    </th>
                    <th className={`${th} text-right`}>
                        {t('dashboard.team.orders')}
                    </th>
                    <th className={`${th} text-right`}>
                        {t('dashboard.team.sales')}
                    </th>
                    <th className={th}>{t('dashboard.team.lastSync')}</th>
                </tr>
            </thead>
            <tbody className="divide-y">
                {rows.map((r) => {
                    const coverage = r.visited / r.planned;

                    return (
                        <tr key={r.code} className="hover:bg-muted/60">
                            <td className={td}>
                                <Person name={r.name} code={r.code} />
                            </td>
                            <td className={`${td} text-muted-foreground`}>
                                {r.route}
                            </td>
                            <td className={td}>
                                <Ratio
                                    value={r.visited}
                                    max={r.planned}
                                    tone={
                                        coverage < 0.4
                                            ? 'danger'
                                            : coverage < 0.7
                                              ? 'warning'
                                              : 'primary'
                                    }
                                    label={`${r.name} ${t('dashboard.team.visits')}`}
                                />
                            </td>
                            <td className={`${td} text-right tabular-nums`}>
                                {f.num(r.orders)}
                            </td>
                            <td
                                className={`${td} text-right font-medium whitespace-nowrap tabular-nums`}
                            >
                                {f.taka(r.sales)}
                            </td>
                            <td className={td}>
                                <SyncStatus minutes={r.lastSyncMin} />
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

function DeliveryTable({ rows }: { rows: DeliveryMan[] }) {
    const { t, f } = useFormat();

    return (
        <table className="w-full min-w-[660px] text-sm">
            <thead className="border-b bg-background">
                <tr>
                    <th className={th}>{t('dashboard.team.deliveryMan')}</th>
                    <th className={th}>{t('dashboard.team.trip')}</th>
                    <th className={`${th} w-44`}>
                        {t('dashboard.team.delivered')}
                    </th>
                    <th className={`${th} text-right`}>
                        {t('dashboard.team.cash')}
                    </th>
                    <th className={th}>{t('dashboard.team.lastSync')}</th>
                </tr>
            </thead>
            <tbody className="divide-y">
                {rows.map((r) => (
                    <tr key={r.code} className="hover:bg-muted/60">
                        <td className={td}>
                            <Person name={r.name} code={r.code} />
                        </td>
                        <td className={`${td} text-muted-foreground`}>
                            {r.trip}
                        </td>
                        <td className={td}>
                            <Ratio
                                value={r.delivered}
                                max={r.total}
                                tone={r.delivered === 0 ? 'danger' : 'primary'}
                                label={`${r.name} ${t('dashboard.team.delivered')}`}
                            />
                        </td>
                        <td
                            className={`${td} text-right font-medium whitespace-nowrap tabular-nums`}
                        >
                            {f.taka(r.cash)}
                        </td>
                        <td className={td}>
                            <SyncStatus minutes={r.lastSyncMin} />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
