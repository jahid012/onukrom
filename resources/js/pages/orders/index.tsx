import { Head, Link, router } from '@inertiajs/react';
import {
    Check,
    Download,
    Eye,
    MapPin,
    MapPinOff,
    RotateCcw,
    Truck,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Stack } from '@/components/admin/bits';
import type { Column } from '@/components/admin/data-table';
import {
    BulkBar,
    DataTable,
    TableFooter,
    usePaged,
} from '@/components/admin/data-table';
import { FilterBar, SearchInput, SelectField } from '@/components/admin/fields';
import {
    AssignTripDialog,
    RejectOrdersDialog,
} from '@/components/admin/order-dialogs';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { RowMenu } from '@/components/admin/row-menu';
import { StatusBadge } from '@/components/admin/status-badge';
import { Tabs } from '@/components/admin/tabs';
import { Panel } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import type { Order, OrderStatus } from '@/data/admin/sales';
import {
    approveOrders,
    rescheduleOrder,
    useAdminData,
} from '@/data/admin/store';
import { staffByCode } from '@/data/admin/store';
import { useAdmin } from '@/hooks/use-admin';
import { useQuery } from '@/hooks/use-query';
import { downloadCsv } from '@/lib/csv';
import { locationFlags, orderTone } from '@/lib/order-status';
import { cn } from '@/lib/utils';
import { index as ordersIndex, show } from '@/routes/orders';

type Tab =
    | 'all'
    | 'pending'
    | 'approved'
    | 'dispatched'
    | 'delivered'
    | 'closed';
type DateRange = 'all' | 'today' | 'yesterday' | 'last7';

const tabStatuses: Record<Tab, OrderStatus[] | null> = {
    all: null,
    pending: ['pending'],
    approved: ['approved'],
    dispatched: ['dispatched'],
    delivered: ['delivered', 'partially_delivered'],
    closed: ['failed', 'cancelled', 'rejected'],
};

const inTab = (o: Order, tab: Tab) =>
    !tabStatuses[tab] || tabStatuses[tab]!.includes(o.status);

const inRange = (minutes: number, range: DateRange) =>
    range === 'all' ||
    (range === 'today' && minutes < 1440) ||
    (range === 'yesterday' && minutes >= 1440 && minutes < 2880) ||
    (range === 'last7' && minutes < 7 * 1440);

const isTab = (v: string | null): v is Tab => v !== null && v in tabStatuses;

export default function OrdersIndex() {
    const { t, f, name, ago } = useAdmin();
    const { orders, shops } = useAdminData();
    const tabQuery = useQuery('tab');
    const issuesQuery = useQuery('issues');
    const [tab, setTab] = useState<Tab>(isTab(tabQuery) ? tabQuery : 'pending');
    const [search, setSearch] = useState('');
    const [sr, setSr] = useState('all');
    const [range, setRange] = useState<DateRange>('all');
    const [onlyIssues, setOnlyIssues] = useState(issuesQuery === '1');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [rejecting, setRejecting] = useState<string[]>([]);
    const [assigning, setAssigning] = useState<string[]>([]);

    const shopOf = (o: Order) =>
        shops.find((s) => s.id === o.shopId) ?? shops[0];

    // All filters except the tab — tab counts follow them.
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();

        return orders.filter((o) => {
            const shop = shops.find((s) => s.id === o.shopId);

            return (
                (sr === 'all' || o.sr === sr) &&
                inRange(o.minutesAgo, range) &&
                (!onlyIssues ||
                    o.flags.some((fl) => locationFlags.includes(fl))) &&
                (q === '' ||
                    o.number.toLowerCase().includes(q) ||
                    (shop?.name.toLowerCase().includes(q) ?? false) ||
                    (shop?.name_bn.includes(q) ?? false))
            );
        });
    }, [orders, shops, search, sr, range, onlyIssues]);

    const rows = filtered.filter((o) => inTab(o, tab));
    const paged = usePaged(rows);
    const count = (k: Tab) => f.num(filtered.filter((o) => inTab(o, k)).length);

    const selectedOrders = orders.filter((o) => selected.has(o.number));
    const pick = (status: OrderStatus) =>
        selectedOrders.filter((o) => o.status === status).map((o) => o.number);
    const clear = () => setSelected(new Set());

    const approve = (numbers: string[]) => {
        approveOrders(numbers);
        toast.success(t('orders.toast.approved', { n: f.num(numbers.length) }));
    };

    const srCodes = [...new Set(orders.map((o) => o.sr))];

    const columns: Column<Order>[] = [
        {
            key: 'order',
            header: t('orders.columns.order'),
            cell: (o) => (
                <Stack
                    main={
                        <Link
                            href={show(o.number)}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                            {o.number}
                        </Link>
                    }
                    sub={`${ago(o.minutesAgo)} · ${staffByCode(o.sr).name}`}
                />
            ),
        },
        {
            key: 'shop',
            header: t('orders.columns.shop'),
            cell: (o) => <Stack main={name(shopOf(o))} sub={shopOf(o).route} />,
        },
        {
            key: 'total',
            header: t('orders.columns.total'),
            align: 'right',
            cell: (o) => (
                <Stack
                    main={
                        <span className="font-medium whitespace-nowrap tabular-nums">
                            {f.taka(o.total)}
                        </span>
                    }
                    sub={t('orders.itemsCount', { n: f.num(o.items) })}
                />
            ),
        },
        {
            key: 'location',
            header: t('orders.columns.location'),
            cell: (o) => <LocationCell order={o} />,
        },
        {
            key: 'status',
            header: t('orders.columns.status'),
            cell: (o) => (
                <div className="flex flex-col items-start gap-1">
                    <StatusBadge
                        tone={orderTone[o.status]}
                        label={t(`admin.orderStatus.${o.status}`)}
                    />
                    {o.trip && (
                        <span className="text-[11px] text-muted-foreground">
                            {t('orders.onTrip', { trip: o.trip })}
                        </span>
                    )}
                    {o.flags
                        .filter(
                            (fl) =>
                                fl === 'price_changed' || fl === 'over_credit',
                        )
                        .map((fl) => (
                            <span
                                key={fl}
                                className="text-[11px] text-warning-ink"
                            >
                                {t(`admin.orderFlag.${fl}`)}
                            </span>
                        ))}
                </div>
            ),
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (o) => (
                <div className="flex items-center justify-end gap-1">
                    {o.status === 'pending' && (
                        <Button size="sm" onClick={() => approve([o.number])}>
                            <Check className="size-3.5" />
                            {t('admin.actions.approve')}
                        </Button>
                    )}
                    {o.status === 'approved' && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-card"
                            onClick={() => setAssigning([o.number])}
                        >
                            <Truck className="size-3.5" />
                            {t('admin.actions.assignTrip')}
                        </Button>
                    )}
                    {o.status === 'failed' && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-card"
                            onClick={() => {
                                rescheduleOrder(o.number);
                                toast.success(
                                    t('orders.toast.rescheduled', {
                                        order: o.number,
                                    }),
                                );
                            }}
                        >
                            <RotateCcw className="size-3.5" />
                            {t('orders.reschedule')}
                        </Button>
                    )}
                    <RowMenu
                        actions={[
                            {
                                label: t('admin.actions.view'),
                                icon: Eye,
                                onSelect: () => router.visit(show(o.number)),
                            },
                            {
                                label: t('admin.actions.reject'),
                                icon: X,
                                danger: true,
                                hidden: o.status !== 'pending',
                                onSelect: () => setRejecting([o.number]),
                            },
                        ]}
                    />
                </div>
            ),
        },
    ];

    const exportCsv = () => {
        downloadCsv(
            'orders',
            [
                t('orders.columns.order'),
                t('orders.columns.shop'),
                t('orders.columns.sr'),
                t('orders.columns.items'),
                t('orders.columns.total'),
                t('orders.columns.status'),
            ],
            rows.map((o) => [
                o.number,
                name(shopOf(o)),
                staffByCode(o.sr).name,
                o.items,
                o.total,
                t(`admin.orderStatus.${o.status}`),
            ]),
        );
    };

    return (
        <>
            <Head title={t('orders.title')} />
            <PageBody>
                <PageHeader
                    title={t('orders.title')}
                    description={t('orders.description')}
                    actions={
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-card"
                            onClick={exportCsv}
                        >
                            <Download className="size-3.5" />
                            {t('admin.actions.export')}
                        </Button>
                    }
                />

                <Panel>
                    <Tabs
                        className="px-2"
                        value={tab}
                        onChange={(v) => {
                            setTab(v);
                            clear();
                        }}
                        items={[
                            {
                                value: 'all',
                                label: t('orders.tabs.all'),
                                count: count('all'),
                            },
                            {
                                value: 'pending',
                                label: t('orders.tabs.pending'),
                                count: count('pending'),
                                tone: 'warning',
                            },
                            {
                                value: 'approved',
                                label: t('orders.tabs.approved'),
                                count: count('approved'),
                            },
                            {
                                value: 'dispatched',
                                label: t('orders.tabs.dispatched'),
                                count: count('dispatched'),
                            },
                            {
                                value: 'delivered',
                                label: t('orders.tabs.delivered'),
                                count: count('delivered'),
                            },
                            {
                                value: 'closed',
                                label: t('orders.tabs.closed'),
                                count: count('closed'),
                            },
                        ]}
                    />
                    <FilterBar>
                        <SearchInput
                            className="sm:w-72"
                            value={search}
                            onChange={setSearch}
                            placeholder={t('orders.search')}
                        />
                        <SelectField
                            className="sm:w-56"
                            value={sr}
                            onChange={setSr}
                            label={t('orders.columns.sr')}
                            options={[
                                {
                                    value: 'all',
                                    label: t('admin.filters.allSr'),
                                },
                                ...srCodes.map((code) => ({
                                    value: code,
                                    label: `${staffByCode(code).name} (${code})`,
                                })),
                            ]}
                        />
                        <SelectField
                            className="sm:w-40"
                            value={range}
                            onChange={(v) => setRange(v as DateRange)}
                            label={t('orders.date')}
                            options={[
                                {
                                    value: 'all',
                                    label: t('admin.filters.anyDate'),
                                },
                                {
                                    value: 'today',
                                    label: t('admin.filters.today'),
                                },
                                {
                                    value: 'yesterday',
                                    label: t('admin.filters.yesterday'),
                                },
                                {
                                    value: 'last7',
                                    label: t('admin.filters.last7'),
                                },
                            ]}
                        />
                        <button
                            type="button"
                            aria-pressed={onlyIssues}
                            onClick={() => setOnlyIssues((v) => !v)}
                            className={cn(
                                'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors',
                                onlyIssues
                                    ? 'border-warning bg-warning-soft text-warning-ink'
                                    : 'bg-card text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <MapPinOff className="size-3.5" aria-hidden />
                            {t('admin.filters.locationIssues')}
                        </button>
                    </FilterBar>

                    <BulkBar count={selected.size} onClear={clear}>
                        <Button
                            size="sm"
                            disabled={pick('pending').length === 0}
                            onClick={() => {
                                approve(pick('pending'));
                                clear();
                            }}
                        >
                            {t('orders.bulk.approve', {
                                n: f.num(pick('pending').length),
                            })}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-card"
                            disabled={pick('approved').length === 0}
                            onClick={() => setAssigning(pick('approved'))}
                        >
                            {t('orders.bulk.assign', {
                                n: f.num(pick('approved').length),
                            })}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-card text-danger-ink"
                            disabled={pick('pending').length === 0}
                            onClick={() => setRejecting(pick('pending'))}
                        >
                            {t('orders.bulk.reject', {
                                n: f.num(pick('pending').length),
                            })}
                        </Button>
                    </BulkBar>

                    <DataTable
                        columns={columns}
                        rows={paged.rows}
                        rowKey={(o) => o.number}
                        selected={selected}
                        onSelectedChange={setSelected}
                        minWidth={900}
                    />
                    <TableFooter paged={paged} />
                </Panel>
            </PageBody>

            <RejectOrdersDialog
                numbers={rejecting}
                onOpenChange={(open) => !open && setRejecting([])}
                onDone={clear}
            />
            <AssignTripDialog
                numbers={assigning}
                onOpenChange={(open) => !open && setAssigning([])}
                onDone={clear}
            />
        </>
    );
}

/** Live location summary for an order (spec 10.5). */
function LocationCell({ order: o }: { order: Order }) {
    const { t, f } = useAdmin();
    const m = (n: number) => t('orders.meters', { n: f.num(n) });

    if (o.flags.includes('no_location')) {
        return (
            <Flag tone="danger" text={t('admin.orderFlag.no_location')} off />
        );
    }

    if (o.flags.includes('mock')) {
        return <Flag tone="danger" text={t('admin.orderFlag.mock')} />;
    }

    if (o.flags.includes('far_from_shop')) {
        return (
            <Flag
                tone="warning"
                text={t('orders.location.far', { distance: m(o.distanceM) })}
            />
        );
    }

    if (o.flags.includes('low_accuracy')) {
        return (
            <Flag
                tone="warning"
                text={t('orders.location.weak', { accuracy: m(o.accuracyM) })}
            />
        );
    }

    return (
        <Flag
            tone="success"
            text={t('orders.location.ok', {
                distance: m(o.distanceM),
                accuracy: m(o.accuracyM),
            })}
        />
    );
}

function Flag({
    tone,
    text,
    off = false,
}: {
    tone: 'success' | 'warning' | 'danger';
    text: string;
    off?: boolean;
}) {
    const Icon = off ? MapPinOff : MapPin;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 text-xs whitespace-nowrap',
                tone === 'success' && 'text-muted-foreground',
                tone === 'warning' && 'font-medium text-warning-ink',
                tone === 'danger' && 'font-medium text-danger-ink',
            )}
        >
            <Icon
                className={cn('size-3.5', tone === 'success' && 'text-success')}
                aria-hidden
            />
            {text}
        </span>
    );
}

OrdersIndex.layout = {
    breadcrumbs: [{ title: 'nav.orders', href: ordersIndex() }],
};
