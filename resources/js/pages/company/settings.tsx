import { Head } from '@inertiajs/react';
import {
    Building2,
    MapPin,
    MessageSquareText,
    ShoppingCart,
    Smartphone,
    Truck,
    Undo2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    SelectField,
    SettingRow,
    Switch,
    TextField,
} from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { Meter, Panel } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { saveSettings, useAdminData } from '@/data/admin/store';
import type { CompanySettings as Settings } from '@/data/admin/store';
import { useAdmin } from '@/hooks/use-admin';
import { settings as companySettings } from '@/routes/company';

type NumberKey =
    | 'maxDiscount'
    | 'priceWindow'
    | 'maxAccuracy'
    | 'maxAge'
    | 'wait'
    | 'geofence'
    | 'dutyInterval';

const limits: Record<NumberKey, [number, number]> = {
    maxDiscount: [0, 50],
    priceWindow: [0, 168],
    maxAccuracy: [5, 500],
    maxAge: [10, 600],
    wait: [5, 120],
    geofence: [20, 2000],
    dutyInterval: [60, 3600],
};

/** Company settings (spec §11.2 "Settings" + §10.5 order location). */
export default function CompanySettings() {
    const { t, f } = useAdmin();
    const { settings, company } = useAdminData();
    const [s, setS] = useState<Settings>(settings);
    const dirty = JSON.stringify(s) !== JSON.stringify(settings);
    const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
        setS((prev) => ({ ...prev, [key]: value }));
    const num = (key: NumberKey) => (value: string) => set(key, Number(value));
    const invalid = (Object.keys(limits) as NumberKey[]).filter(
        (k) => !(s[k] >= limits[k][0] && s[k] <= limits[k][1]),
    );
    const m = t('company.units.m');
    const sec = t('company.units.sec');
    const err = (key: NumberKey) =>
        invalid.includes(key)
            ? t('company.range', {
                  min: f.num(limits[key][0]),
                  max: f.num(limits[key][1]),
              })
            : undefined;

    const save = () => {
        if (!s.name.trim() || invalid.length > 0) {
            toast.error(t('company.toast.invalid'));

            return;
        }

        saveSettings(s);
        toast.success(t('company.toast.saved'));
    };

    return (
        <>
            <Head title={t('company.title')} />
            <PageBody>
                <PageHeader
                    title={t('company.title')}
                    description={t('company.description')}
                    actions={
                        <>
                            {dirty && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setS(settings)}
                                >
                                    <Undo2 className="size-3.5" />
                                    {t('company.discard')}
                                </Button>
                            )}
                            <Button size="sm" disabled={!dirty} onClick={save}>
                                {t('admin.actions.save')}
                            </Button>
                        </>
                    }
                />
                {dirty && (
                    <p className="-mt-2 text-xs text-warning-ink">
                        {t('company.unsaved')}
                    </p>
                )}

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <Section
                        icon={Building2}
                        title={t('company.profile.title')}
                        help={t('company.profile.help')}
                    >
                        <SettingRow label={t('company.profile.name')}>
                            <TextField
                                value={s.name}
                                onChange={(v) => set('name', v)}
                                label={t('company.profile.name')}
                            />
                        </SettingRow>
                        <SettingRow
                            label={t('company.profile.code')}
                            help={t('company.profile.codeHelp')}
                        >
                            <span className="font-mono text-sm" lang="en">
                                {company.code}
                            </span>
                        </SettingRow>
                        <SettingRow label={t('company.profile.phone')}>
                            <TextField
                                type="tel"
                                value={s.phone}
                                onChange={(v) => set('phone', v)}
                                label={t('company.profile.phone')}
                            />
                        </SettingRow>
                        <SettingRow
                            label={t('company.profile.address')}
                            help={t('company.profile.addressHelp')}
                        >
                            <TextField
                                value={s.address}
                                onChange={(v) => set('address', v)}
                                label={t('company.profile.address')}
                            />
                        </SettingRow>
                    </Section>

                    <Section
                        icon={ShoppingCart}
                        title={t('company.orders.title')}
                        help={t('company.orders.help')}
                    >
                        <SettingRow
                            label={t('company.orders.autoApprove')}
                            help={t('company.orders.autoApproveHelp')}
                        >
                            <Switch
                                checked={s.autoApprove}
                                onChange={(v) => set('autoApprove', v)}
                                label={t('company.orders.autoApprove')}
                            />
                        </SettingRow>
                        <SettingRow label={t('company.orders.creditMode')}>
                            <SelectField
                                value={s.creditMode}
                                onChange={(v) =>
                                    set(
                                        'creditMode',
                                        v as Settings['creditMode'],
                                    )
                                }
                                label={t('company.orders.creditMode')}
                                options={[
                                    {
                                        value: 'warn',
                                        label: t('company.orders.warn'),
                                    },
                                    {
                                        value: 'block',
                                        label: t('company.orders.block'),
                                    },
                                ]}
                            />
                        </SettingRow>
                        <NumberRow
                            label={t('company.orders.maxDiscount')}
                            value={s.maxDiscount}
                            onChange={num('maxDiscount')}
                            suffix="%"
                            error={err('maxDiscount')}
                        />
                        <NumberRow
                            label={t('company.orders.priceWindow')}
                            help={t('company.orders.priceWindowHelp')}
                            value={s.priceWindow}
                            onChange={num('priceWindow')}
                            suffix={t('company.units.hours')}
                            error={err('priceWindow')}
                        />
                        <SettingRow
                            label={t('company.orders.blockOverStock')}
                            help={t('company.orders.blockOverStockHelp')}
                        >
                            <Switch
                                checked={s.blockOverStock}
                                onChange={(v) => set('blockOverStock', v)}
                                label={t('company.orders.blockOverStock')}
                            />
                        </SettingRow>
                    </Section>

                    <Section
                        icon={MapPin}
                        title={t('company.location.title')}
                        help={t('company.location.help')}
                    >
                        <SettingRow
                            label={t('company.location.mode')}
                            help={t('company.location.modeHelp')}
                        >
                            <SelectField
                                value={s.locationMode}
                                onChange={(v) =>
                                    set(
                                        'locationMode',
                                        v as Settings['locationMode'],
                                    )
                                }
                                label={t('company.location.mode')}
                                options={[
                                    {
                                        value: 'required',
                                        label: t('company.location.required'),
                                    },
                                    {
                                        value: 'flag',
                                        label: t('company.location.flag'),
                                    },
                                ]}
                            />
                        </SettingRow>
                        {s.locationMode === 'flag' && (
                            <p className="bg-warning-soft px-4 py-2 text-xs text-warning-ink">
                                {t('company.location.flagWarning')}
                            </p>
                        )}
                        <NumberRow
                            label={t('company.location.maxAccuracy')}
                            value={s.maxAccuracy}
                            onChange={num('maxAccuracy')}
                            suffix={m}
                            error={err('maxAccuracy')}
                        />
                        <NumberRow
                            label={t('company.location.maxAge')}
                            help={t('company.location.maxAgeHelp')}
                            value={s.maxAge}
                            onChange={num('maxAge')}
                            suffix={sec}
                            error={err('maxAge')}
                        />
                        <NumberRow
                            label={t('company.location.wait')}
                            help={t('company.location.waitHelp')}
                            value={s.wait}
                            onChange={num('wait')}
                            suffix={sec}
                            error={err('wait')}
                        />
                        <NumberRow
                            label={t('company.location.geofence')}
                            help={t('company.location.geofenceHelp')}
                            value={s.geofence}
                            onChange={num('geofence')}
                            suffix={m}
                            error={err('geofence')}
                        />
                        <SettingRow
                            label={t('company.location.blockMock')}
                            help={t('company.location.blockMockHelp')}
                        >
                            <Switch
                                checked={s.blockMock}
                                onChange={(v) => set('blockMock', v)}
                                label={t('company.location.blockMock')}
                            />
                        </SettingRow>
                        <SettingRow
                            label={t('company.location.shopFromOrder')}
                            help={t('company.location.shopFromOrderHelp')}
                        >
                            <Switch
                                checked={s.shopFromOrder}
                                onChange={(v) => set('shopFromOrder', v)}
                                label={t('company.location.shopFromOrder')}
                            />
                        </SettingRow>
                    </Section>

                    <Section
                        icon={Smartphone}
                        title={t('company.field.title')}
                        help={t('company.field.help')}
                    >
                        <SettingRow
                            label={t('company.field.startDay')}
                            help={t('company.field.startDayHelp')}
                        >
                            <Switch
                                checked={s.requireStartDay}
                                onChange={(v) => set('requireStartDay', v)}
                                label={t('company.field.startDay')}
                            />
                        </SettingRow>
                        <SettingRow
                            label={t('company.field.duty')}
                            help={t('company.field.dutyHelp')}
                        >
                            <Switch
                                checked={s.dutyTracking}
                                onChange={(v) => set('dutyTracking', v)}
                                label={t('company.field.duty')}
                            />
                        </SettingRow>
                        {s.dutyTracking && (
                            <NumberRow
                                label={t('company.field.interval')}
                                value={s.dutyInterval}
                                onChange={num('dutyInterval')}
                                suffix={sec}
                                error={err('dutyInterval')}
                            />
                        )}
                        <SettingRow
                            label={t('company.field.oneDevice')}
                            help={t('company.field.oneDeviceHelp')}
                        >
                            <Switch
                                checked={s.oneDevice}
                                onChange={(v) => set('oneDevice', v)}
                                label={t('company.field.oneDevice')}
                            />
                        </SettingRow>
                    </Section>

                    <Section icon={Truck} title={t('company.delivery.title')}>
                        <SettingRow
                            label={t('company.delivery.proof')}
                            help={t('company.delivery.proofHelp')}
                        >
                            <SelectField
                                value={s.proof}
                                onChange={(v) =>
                                    set('proof', v as Settings['proof'])
                                }
                                label={t('company.delivery.proof')}
                                options={(
                                    [
                                        'none',
                                        'signature',
                                        'photo',
                                        'both',
                                    ] as const
                                ).map((p) => ({
                                    value: p,
                                    label: t(`company.delivery.${p}`),
                                }))}
                            />
                        </SettingRow>
                    </Section>

                    <Section
                        icon={MessageSquareText}
                        title={t('company.sms.title')}
                        help={t('company.sms.help')}
                    >
                        <SettingRow label={t('company.sms.provider')}>
                            <span className="text-sm font-medium" lang="en">
                                Alpha SMS
                            </span>
                        </SettingRow>
                        <SettingRow label={t('company.sms.usage')}>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-sm font-medium tabular-nums">
                                    {f.num(company.smsUsed)} /{' '}
                                    {f.num(company.smsLimit)}
                                </span>
                                <Meter
                                    value={company.smsUsed}
                                    max={company.smsLimit}
                                    label={t('company.sms.usage')}
                                />
                            </div>
                        </SettingRow>
                        <SettingRow
                            label={t('company.sms.dailyCap')}
                            help={t('company.sms.dailyCapHelp')}
                        >
                            <span className="text-sm font-medium tabular-nums">
                                {f.num(50)}
                            </span>
                        </SettingRow>
                    </Section>
                </div>
            </PageBody>
        </>
    );
}

function NumberRow({
    label,
    help,
    value,
    onChange,
    suffix,
    error,
}: {
    label: string;
    help?: string;
    value: number;
    onChange: (v: string) => void;
    suffix: string;
    error?: string;
}) {
    return (
        <SettingRow label={label} help={help}>
            <TextField
                type="number"
                value={String(value)}
                onChange={onChange}
                label={label}
                suffix={suffix}
            />
            {error && (
                <p className="mt-1 text-left text-xs text-danger-ink sm:text-right">
                    {error}
                </p>
            )}
        </SettingRow>
    );
}

function Section({
    icon: Icon,
    title,
    help,
    children,
}: {
    icon: LucideIcon;
    title: string;
    help?: string;
    children: ReactNode;
}) {
    return (
        <Panel>
            <header className="flex items-start gap-3 border-b px-4 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Icon className="size-4" aria-hidden />
                </span>
                <div>
                    <h2 className="text-sm font-semibold">{title}</h2>
                    {help && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {help}
                        </p>
                    )}
                </div>
            </header>
            <div className="divide-y">{children}</div>
        </Panel>
    );
}

CompanySettings.layout = {
    breadcrumbs: [{ title: 'nav.settings', href: companySettings() }],
};
