import { Head, Link } from '@inertiajs/react';
import {
    Banknote,
    ClipboardList,
    PackageCheck,
    Play,
    Plus,
    Printer,
    Truck,
    Wallet,
    Lock,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MiniStat, Person, Stack, Thumb } from '@/components/admin/bits';
import type { Column } from '@/components/admin/data-table';
import {
    DataTable,
    TableFooter,
    usePaged,
} from '@/components/admin/data-table';
import { Field, FormDialog, TextInput } from '@/components/admin/dialogs';
import { SelectField } from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import type { Tone } from '@/components/admin/status-badge';
import { Meter, Panel, PanelHeader } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { Product } from '@/data/admin/catalog';
import type { Trip, TripStatus } from '@/data/admin/sales';
import {
    advanceTrip,
    allRoutesOf,
    closeTrip,
    createTrip,
    linesForOrder,
    useAdminData,
} from '@/data/admin/store';
import { staffByCode } from '@/data/admin/store';
import { useAdmin } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';
import { index as collectionsIndex } from '@/routes/collections';
import { index as deliveriesIndex } from '@/routes/deliveries';

const tripTone: Record<TripStatus, Tone> = {
    planned: 'neutral',
    loaded: 'info',
    in_progress: 'primary',
    closed: 'success',
};

export default function DeliveriesIndex() {
    const { t, f, name, qty } = useAdmin();
    const state = useAdminData();
    const { trips, orders, shops } = state;
    const [selected, setSelected] = useState(trips[0]?.number ?? '');
    const [newTripRoute, setNewTripRoute] = useState<string | null>(null);
    const [closing, setClosing] = useState<Trip | null>(null);
    const trip = trips.find((x) => x.number === selected) ?? trips[0];
    const active = trips.filter((x) => x.status !== 'closed');
    const paged = usePaged(trips);
    const sum = (k: 'cashExpected' | 'cashCollected' | 'orders') =>
        active.reduce((s, x) => s + x[k], 0);

    // Approved orders not yet on a trip, grouped by the shop's route.
    const waiting = useMemo(() => {
        const groups = new Map<string, { orders: number; value: number }>();

        orders
            .filter((o) => o.status === 'approved' && !o.trip)
            .forEach((o) => {
                const route = shops.find((s) => s.id === o.shopId)?.route ?? '';
                const g = groups.get(route) ?? { orders: 0, value: 0 };
                groups.set(route, {
                    orders: g.orders + 1,
                    value: g.value + o.total,
                });
            });

        return [...groups.entries()].map(([route, g]) => ({ route, ...g }));
    }, [orders, shops]);

    // Load sheet: total quantity per product to pick up for the selected trip.
    const loadSheet = useMemo(() => {
        if (!trip) {
            return [];
        }

        const totals = new Map<string, { product: Product; qty: number }>();
        const lines = orders
            .filter((o) => trip.orderNumbers?.includes(o.number))
            .flatMap(linesForOrder);

        lines.forEach((l) => {
            const row = totals.get(l.product.id) ?? {
                product: l.product,
                qty: 0,
            };
            totals.set(l.product.id, { ...row, qty: row.qty + l.qty });
        });

        return [...totals.values()];
    }, [trip, orders]);

    const step = (x: Trip) => {
        if (x.status === 'in_progress') {
            setClosing(x);

            return;
        }

        advanceTrip(x.number);
        toast.success(
            t(
                `deliveries.toast.${x.status === 'planned' ? 'loaded' : 'started'}`,
                { trip: x.number },
            ),
        );
    };

    const stepLabel: Partial<Record<TripStatus, string>> = {
        planned: t('deliveries.markLoaded'),
        loaded: t('deliveries.start'),
        in_progress: t('deliveries.close'),
    };
    const stepIcon = { planned: PackageCheck, loaded: Play, in_progress: Lock };

    const columns: Column<Trip>[] = [
        {
            key: 'trip',
            header: t('deliveries.columns.trip'),
            cell: (x) => (
                <button
                    type="button"
                    onClick={() => setSelected(x.number)}
                    className="text-left"
                >
                    <Stack
                        main={
                            <span className="font-medium underline-offset-4 hover:underline">
                                {x.number}
                            </span>
                        }
                        sub={x.vehicle}
                    />
                </button>
            ),
        },
        {
            key: 'dm',
            header: t('deliveries.columns.dm'),
            cell: (x) => (
                <Person name={staffByCode(x.dm).name} sub={x.dm} size="sm" />
            ),
        },
        {
            key: 'route',
            header: t('deliveries.columns.route'),
            cell: (x) => (
                <span className="text-muted-foreground">{x.route}</span>
            ),
        },
        {
            key: 'progress',
            header: t('deliveries.columns.progress'),
            className: 'w-48',
            cell: (x) => (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <Meter
                            value={x.delivered}
                            max={Math.max(1, x.orders)}
                            label={t('deliveries.columns.progress')}
                        />
                        <span className="w-12 shrink-0 text-right text-xs tabular-nums">
                            {f.num(x.delivered)}/{f.num(x.orders)}
                        </span>
                    </div>
                    {x.failed > 0 && (
                        <span className="text-[11px] text-danger-ink">
                            {t('deliveries.failed', { n: f.num(x.failed) })}
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: 'cash',
            header: t('deliveries.columns.cash'),
            align: 'right',
            cell: (x) => (
                <Stack
                    main={
                        <span className="font-medium tabular-nums">
                            {f.taka(x.cashCollected)}
                        </span>
                    }
                    sub={t('deliveries.ofExpected', {
                        amount: f.taka(x.cashExpected),
                    })}
                />
            ),
        },
        {
            key: 'status',
            header: t('deliveries.columns.status'),
            cell: (x) => (
                <StatusBadge
                    tone={tripTone[x.status]}
                    label={t(`deliveries.status.${x.status}`)}
                />
            ),
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (x) => {
                if (x.status === 'closed') {
                    return null;
                }

                const Icon = stepIcon[x.status];

                return (
                    <Button
                        size="sm"
                        variant={
                            x.status === 'in_progress' ? 'default' : 'outline'
                        }
                        className={cn(x.status !== 'in_progress' && 'bg-card')}
                        onClick={() => step(x)}
                    >
                        <Icon className="size-3.5" />
                        {stepLabel[x.status]}
                    </Button>
                );
            },
        },
    ];

    return (
        <>
            <Head title={t('deliveries.title')} />
            <PageBody>
                <PageHeader
                    title={t('deliveries.title')}
                    description={t('deliveries.description')}
                    actions={
                        <Button
                            size="sm"
                            onClick={() =>
                                setNewTripRoute(waiting[0]?.route ?? '')
                            }
                        >
                            <Plus className="size-3.5" />
                            {t('deliveries.newTrip')}
                        </Button>
                    }
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MiniStat
                        icon={Truck}
                        label={t('deliveries.stats.trips')}
                        value={f.num(active.length)}
                        note={t('deliveries.stats.tripsNote')}
                    />
                    <MiniStat
                        icon={PackageCheck}
                        label={t('deliveries.stats.orders')}
                        value={f.num(sum('orders'))}
                    />
                    <MiniStat
                        icon={Banknote}
                        label={t('deliveries.stats.expected')}
                        value={f.taka(sum('cashExpected'))}
                    />
                    <MiniStat
                        icon={Wallet}
                        label={t('deliveries.stats.collected')}
                        value={f.taka(sum('cashCollected'))}
                        tone="success"
                    />
                </div>

                <Panel>
                    <PanelHeader
                        title={t('deliveries.tripsTitle')}
                        subtitle={t('deliveries.tripsSubtitle')}
                    />
                    <DataTable
                        columns={columns}
                        rows={paged.rows}
                        rowKey={(x) => x.number}
                        minWidth={960}
                        rowClassName={(x) =>
                            x.number === trip?.number
                                ? 'bg-accent/50'
                                : undefined
                        }
                    />
                    <TableFooter paged={paged} />
                </Panel>

                <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
                    <Panel>
                        <PanelHeader
                            title={t('deliveries.waitingTitle')}
                            subtitle={t('deliveries.waitingSubtitle')}
                        />
                        {waiting.length === 0 ? (
                            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                                {t('deliveries.noneWaiting')}
                            </p>
                        ) : (
                            <ul className="divide-y">
                                {waiting.map((w) => (
                                    <li
                                        key={w.route}
                                        className="flex items-center gap-3 px-4 py-2.5"
                                    >
                                        <Stack
                                            main={
                                                <span className="font-medium">
                                                    {w.route}
                                                </span>
                                            }
                                            sub={t('deliveries.waitingLine', {
                                                orders: f.num(w.orders),
                                                value: f.taka(w.value),
                                            })}
                                        />
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="ml-auto bg-card"
                                            onClick={() =>
                                                setNewTripRoute(w.route)
                                            }
                                        >
                                            {t('deliveries.createTrip')}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>

                    {trip && (
                        <Panel className="print-area">
                            <PanelHeader
                                title={t('deliveries.loadSheet', {
                                    trip: trip.number,
                                })}
                                subtitle={`${staffByCode(trip.dm).name} · ${trip.route} · ${trip.vehicle}`}
                                action={
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="no-print bg-card"
                                        onClick={() => window.print()}
                                    >
                                        <Printer className="size-3.5" />
                                        {t('admin.actions.print')}
                                    </Button>
                                }
                            />
                            {loadSheet.length === 0 ? (
                                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                                    {t('deliveries.emptySheet')}
                                </p>
                            ) : (
                                <ul className="divide-y">
                                    {loadSheet.map((l) => (
                                        <li
                                            key={l.product.id}
                                            className="flex items-center gap-3 px-4 py-2"
                                        >
                                            <Thumb
                                                label={name(l.product)}
                                                hue={l.product.hue}
                                            />
                                            <Stack
                                                main={name(l.product)}
                                                sub={l.product.sku}
                                            />
                                            <span className="ml-auto text-right text-sm font-medium whitespace-nowrap">
                                                {qty(l.qty, l.product.packSize)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="flex items-center gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
                                <ClipboardList
                                    className="size-3.5"
                                    aria-hidden
                                />
                                {t('deliveries.loadSheetNote', {
                                    orders: f.num(trip.orders),
                                })}
                            </div>
                        </Panel>
                    )}
                </div>
            </PageBody>

            {newTripRoute !== null && (
                <NewTripDialog
                    initialRoute={newTripRoute}
                    onClose={() => setNewTripRoute(null)}
                    onCreated={(number) => setSelected(number)}
                    routes={allRoutesOf(state).map((r) => r.name)}
                />
            )}
            {closing && (
                <CloseTripDialog
                    trip={closing}
                    onClose={() => setClosing(null)}
                />
            )}
        </>
    );
}

function NewTripDialog({
    initialRoute,
    routes,
    onClose,
    onCreated,
}: {
    initialRoute: string;
    routes: string[];
    onClose: () => void;
    onCreated: (number: string) => void;
}) {
    const { t, f, name } = useAdmin();
    const { orders, shops, staff } = useAdminData();
    const dms = staff.filter(
        (s) => s.roles.includes('dm') && s.status === 'active',
    );
    const [route, setRoute] = useState(initialRoute || routes[0]);
    const [dm, setDm] = useState(dms[0]?.code ?? '');
    const [vehicle, setVehicle] = useState('');
    const candidates = orders.filter(
        (o) =>
            o.status === 'approved' &&
            !o.trip &&
            shops.find((s) => s.id === o.shopId)?.route === route,
    );
    const [picked, setPicked] = useState<Set<string>>(
        () => new Set(candidates.map((o) => o.number)),
    );
    const chosen = candidates.filter((o) => picked.has(o.number));

    const changeRoute = (r: string) => {
        setRoute(r);
        setPicked(
            new Set(
                orders
                    .filter(
                        (o) =>
                            o.status === 'approved' &&
                            !o.trip &&
                            shops.find((s) => s.id === o.shopId)?.route === r,
                    )
                    .map((o) => o.number),
            ),
        );
    };

    return (
        <FormDialog
            open
            onOpenChange={(open) => !open && onClose()}
            wide
            title={t('deliveries.new.title')}
            description={t('deliveries.new.description')}
            submitLabel={t('deliveries.new.submit', {
                n: f.num(chosen.length),
            })}
            disabled={chosen.length === 0 || !dm || vehicle.trim() === ''}
            onSubmit={() => {
                const n = chosen.length;
                void createTrip({
                    dm,
                    route,
                    vehicle: vehicle.trim(),
                    orderNumbers: chosen.map((o) => o.number),
                }).then((number) => {
                    if (number) {
                        toast.success(
                            t('deliveries.toast.created', {
                                trip: number,
                                n: f.num(n),
                            }),
                        );
                        onCreated(number);
                    }
                });
                onClose();
            }}
        >
            <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t('deliveries.columns.route')}>
                    <SelectField
                        value={route}
                        onChange={changeRoute}
                        label={t('deliveries.columns.route')}
                        options={routes.map((r) => ({ value: r, label: r }))}
                    />
                </Field>
                <Field label={t('deliveries.columns.dm')}>
                    <SelectField
                        value={dm}
                        onChange={setDm}
                        label={t('deliveries.columns.dm')}
                        options={dms.map((d) => ({
                            value: d.code,
                            label: `${d.name} (${d.code})`,
                        }))}
                    />
                </Field>
                <Field label={t('deliveries.new.vehicle')}>
                    <TextInput
                        value={vehicle}
                        onChange={setVehicle}
                        placeholder="DHK-ন-11-2233"
                        required
                    />
                </Field>
            </div>
            <div className="rounded-md border">
                <p className="border-b bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
                    {t('deliveries.new.orders', {
                        n: f.num(candidates.length),
                    })}
                </p>
                {candidates.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                        {t('deliveries.new.noOrders')}
                    </p>
                ) : (
                    <ul className="max-h-60 divide-y overflow-y-auto">
                        {candidates.map((o) => {
                            const shop = shops.find((s) => s.id === o.shopId)!;

                            return (
                                <li key={o.number}>
                                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                                        <Checkbox
                                            checked={picked.has(o.number)}
                                            onCheckedChange={() =>
                                                setPicked((prev) => {
                                                    const next = new Set(prev);

                                                    if (next.has(o.number)) {
                                                        next.delete(o.number);
                                                    } else {
                                                        next.add(o.number);
                                                    }

                                                    return next;
                                                })
                                            }
                                        />
                                        <Stack
                                            main={name(shop)}
                                            sub={o.number}
                                        />
                                        <span className="ml-auto font-medium tabular-nums">
                                            {f.taka(o.total)}
                                        </span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                )}
                {chosen.length > 0 && (
                    <p className="border-t px-3 py-2 text-right text-sm">
                        {t('deliveries.new.total')}{' '}
                        <span className="font-semibold tabular-nums">
                            {f.taka(chosen.reduce((s, o) => s + o.total, 0))}
                        </span>
                    </p>
                )}
            </div>
        </FormDialog>
    );
}

function CloseTripDialog({
    trip,
    onClose,
}: {
    trip: Trip;
    onClose: () => void;
}) {
    const { t, f } = useAdmin();
    const [cash, setCash] = useState(String(trip.cashCollected));
    const amount = Number(cash) || 0;
    const diff = amount - trip.cashExpected;

    return (
        <FormDialog
            open
            onOpenChange={(open) => !open && onClose()}
            title={t('deliveries.closeDialog.title', { trip: trip.number })}
            description={t('deliveries.closeDialog.description', {
                name: staffByCode(trip.dm).name,
            })}
            submitLabel={t('deliveries.close')}
            onSubmit={() => {
                closeTrip(trip.number, amount);
                toast.success(
                    t('deliveries.toast.closed', { trip: trip.number }),
                );
                onClose();
            }}
        >
            <div className="grid grid-cols-2 gap-3 rounded-md bg-muted p-3 text-sm">
                <Stack
                    main={
                        <span className="font-semibold tabular-nums">
                            {f.taka(trip.cashExpected)}
                        </span>
                    }
                    sub={t('deliveries.stats.expected')}
                />
                <Stack
                    main={
                        <span className="font-semibold tabular-nums">
                            {f.num(trip.delivered)} / {f.num(trip.orders)}
                        </span>
                    }
                    sub={t('deliveries.columns.progress')}
                />
            </div>
            <Field
                label={t('deliveries.closeDialog.cash')}
                help={t('deliveries.closeDialog.help')}
            >
                <TextInput
                    type="number"
                    value={cash}
                    onChange={setCash}
                    min={0}
                    inputMode="numeric"
                />
            </Field>
            {diff !== 0 && (
                <p
                    className={cn(
                        'text-sm',
                        diff < 0 ? 'text-danger-ink' : 'text-success-ink',
                    )}
                >
                    {diff < 0
                        ? t('deliveries.closeDialog.short', {
                              amount: f.taka(-diff),
                          })
                        : t('deliveries.closeDialog.extra', {
                              amount: f.taka(diff),
                          })}
                </p>
            )}
            <p className="text-xs text-muted-foreground">
                {t('deliveries.closeDialog.note')}{' '}
                <Link
                    href={collectionsIndex({ query: { tab: 'deposits' } })}
                    className="underline underline-offset-4"
                >
                    {t('nav.collections')}
                </Link>
            </p>
        </FormDialog>
    );
}

DeliveriesIndex.layout = {
    breadcrumbs: [{ title: 'nav.deliveries', href: deliveriesIndex() }],
};
