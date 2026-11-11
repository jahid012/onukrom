import { Head, Link } from '@inertiajs/react';
import {
    BadgeCheck,
    Download,
    Eye,
    HandCoins,
    Landmark,
    Phone,
    Smartphone,
    Wallet,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { MiniStat, Person, Stack } from '@/components/admin/bits';
import type { Column } from '@/components/admin/data-table';
import {
    DataTable,
    TableFooter,
    usePaged,
} from '@/components/admin/data-table';
import {
    ConfirmDialog,
    Field,
    FormDialog,
    TextInput,
} from '@/components/admin/dialogs';
import { FilterBar, SearchInput, SelectField } from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { RowMenu } from '@/components/admin/row-menu';
import { StatusBadge } from '@/components/admin/status-badge';
import type { Tone } from '@/components/admin/status-badge';
import { Tabs } from '@/components/admin/tabs';
import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import type {
    Collection,
    CollectionStatus,
    Deposit,
    Method,
} from '@/data/admin/sales';
import {
    confirmCollection,
    receiveDeposit,
    rejectCollection,
    useAdminData,
} from '@/data/admin/store';
import { staffByCode } from '@/data/admin/store';
import { useAdmin } from '@/hooks/use-admin';
import { useQuery } from '@/hooks/use-query';
import { downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';
import { index as collectionsIndex } from '@/routes/collections';
import { show as orderShow } from '@/routes/orders';
import { index as shopsIndex } from '@/routes/shops';

type View = 'collections' | 'deposits' | 'dues';

const statusTone: Record<CollectionStatus, Tone> = {
    pending: 'warning',
    confirmed: 'success',
    rejected: 'danger',
};
const methodIcon: Record<Method, typeof Wallet> = {
    cash: Wallet,
    bkash: Smartphone,
    nagad: Smartphone,
    rocket: Smartphone,
    bank: Landmark,
    cheque: Landmark,
};
const agingColor = {
    '0_30': 'var(--chart-1)',
    '31_60': 'var(--chart-4)',
    '60_plus': 'var(--chart-2)',
};

export default function CollectionsIndex() {
    const { t, f, name, ago } = useAdmin();
    const { collections, deposits, shops, aging } = useAdminData();
    const query = useQuery('tab');
    const [view, setView] = useState<View>(
        query === 'deposits' || query === 'dues' ? query : 'collections',
    );
    const [search, setSearch] = useState('');
    const [method, setMethod] = useState('all');
    const [status, setStatus] = useState('all');
    const [rejecting, setRejecting] = useState<Collection | null>(null);
    const [receiving, setReceiving] = useState<Deposit | null>(null);

    const shopOf = (id: string) => shops.find((s) => s.id === id) ?? shops[0];
    const rows = collections.filter((c) => {
        const shop = shopOf(c.shopId);
        const q = search.trim().toLowerCase();

        return (
            (method === 'all' || c.method === method) &&
            (status === 'all' || c.status === status) &&
            (q === '' ||
                c.number.toLowerCase().includes(q) ||
                shop.name.toLowerCase().includes(q) ||
                shop.name_bn.includes(q))
        );
    });
    const paged = usePaged(rows);

    const waitingDeposits = deposits.filter((d) => d.status === 'waiting');
    const totalDues = aging.reduce((s, a) => s + a.amount, 0);
    const toVerify = collections.filter((c) => c.status === 'pending');
    const today = collections.filter(
        (c) => c.minutesAgo < 1440 && c.status !== 'rejected',
    );

    const confirm = (c: Collection) => {
        confirmCollection(c.number);
        toast.success(t('collections.toast.confirmed', { number: c.number }));
    };

    const collectionColumns: Column<Collection>[] = [
        {
            key: 'number',
            header: t('collections.columns.number'),
            cell: (c) => (
                <Stack
                    main={<span className="font-medium">{c.number}</span>}
                    sub={ago(c.minutesAgo)}
                />
            ),
        },
        {
            key: 'shop',
            header: t('collections.columns.shop'),
            cell: (c) => (
                <Stack
                    main={name(shopOf(c.shopId))}
                    sub={
                        c.orderNumber ? (
                            <Link
                                href={orderShow(c.orderNumber)}
                                className="underline-offset-4 hover:underline"
                            >
                                {c.orderNumber}
                            </Link>
                        ) : (
                            t('collections.onAccount')
                        )
                    }
                />
            ),
        },
        {
            key: 'by',
            header: t('collections.columns.by'),
            cell: (c) => (
                <Person name={staffByCode(c.by).name} sub={c.by} size="sm" />
            ),
        },
        {
            key: 'method',
            header: t('collections.columns.method'),
            cell: (c) => {
                const Icon = methodIcon[c.method];

                return (
                    <Stack
                        main={
                            <span className="inline-flex items-center gap-1.5">
                                <Icon
                                    className="size-3.5 text-muted-foreground"
                                    aria-hidden
                                />
                                {t(`admin.method.${c.method}`)}
                            </span>
                        }
                        sub={c.reference}
                    />
                );
            },
        },
        {
            key: 'amount',
            header: t('collections.columns.amount'),
            align: 'right',
            cell: (c) => (
                <span className="font-medium whitespace-nowrap tabular-nums">
                    {f.taka(c.amount)}
                </span>
            ),
        },
        {
            key: 'status',
            header: t('collections.columns.status'),
            cell: (c) => (
                <Stack
                    main={
                        <StatusBadge
                            tone={statusTone[c.status]}
                            label={t(`collections.status.${c.status}`)}
                        />
                    }
                    sub={c.rejectReason}
                />
            ),
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (c) =>
                c.status === 'pending' ? (
                    <div className="flex items-center justify-end gap-1">
                        <Button size="sm" onClick={() => confirm(c)}>
                            <BadgeCheck className="size-3.5" />
                            {c.method === 'cash'
                                ? t('admin.actions.confirm')
                                : t('admin.actions.verify')}
                        </Button>
                        <RowMenu
                            actions={[
                                {
                                    label: t('admin.actions.reject'),
                                    icon: X,
                                    danger: true,
                                    onSelect: () => setRejecting(c),
                                },
                            ]}
                        />
                    </div>
                ) : null,
        },
    ];

    const depositColumns: Column<Deposit>[] = [
        {
            key: 'id',
            header: t('collections.deposits.id'),
            cell: (d) => (
                <Stack
                    main={<span className="font-medium">{d.id}</span>}
                    sub={ago(d.minutesAgo)}
                />
            ),
        },
        {
            key: 'staff',
            header: t('collections.deposits.staff'),
            cell: (d) => (
                <Person
                    name={staffByCode(d.staff).name}
                    sub={d.staff}
                    size="sm"
                />
            ),
        },
        {
            key: 'count',
            header: t('collections.deposits.collections'),
            align: 'right',
            cell: (d) => (
                <span className="tabular-nums">{f.num(d.collections)}</span>
            ),
        },
        {
            key: 'amount',
            header: t('collections.columns.amount'),
            align: 'right',
            cell: (d) => (
                <span className="font-medium tabular-nums">
                    {f.taka(d.amount)}
                </span>
            ),
        },
        {
            key: 'status',
            header: t('collections.columns.status'),
            cell: (d) => (
                <StatusBadge
                    tone={d.status === 'waiting' ? 'warning' : 'success'}
                    label={t(`collections.deposits.${d.status}`)}
                />
            ),
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (d) =>
                d.status === 'waiting' ? (
                    <Button size="sm" onClick={() => setReceiving(d)}>
                        <BadgeCheck className="size-3.5" />
                        {t('collections.deposits.receive')}
                    </Button>
                ) : null,
        },
    ];

    const topDue = [...shops]
        .filter((s) => s.due > 0)
        .sort((a, b) => b.due - a.due)
        .slice(0, 8);

    return (
        <>
            <Head title={t('collections.title')} />
            <PageBody>
                <PageHeader
                    title={t('collections.title')}
                    description={t('collections.description')}
                    actions={
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-card"
                            onClick={() =>
                                downloadCsv(
                                    'collections',
                                    [
                                        t('collections.columns.number'),
                                        t('collections.columns.shop'),
                                        t('collections.columns.by'),
                                        t('collections.columns.method'),
                                        t('collections.columns.amount'),
                                        t('collections.columns.status'),
                                    ],
                                    rows.map((c) => [
                                        c.number,
                                        name(shopOf(c.shopId)),
                                        staffByCode(c.by).name,
                                        t(`admin.method.${c.method}`),
                                        c.amount,
                                        t(`collections.status.${c.status}`),
                                    ]),
                                )
                            }
                        >
                            <Download className="size-3.5" />
                            {t('admin.actions.export')}
                        </Button>
                    }
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MiniStat
                        icon={HandCoins}
                        label={t('collections.stats.today')}
                        value={f.taka(today.reduce((s, c) => s + c.amount, 0))}
                        note={t('collections.stats.todayNote', {
                            n: f.num(today.length),
                        })}
                        tone="success"
                    />
                    <MiniStat
                        icon={Wallet}
                        label={t('collections.stats.withStaff')}
                        value={f.taka(
                            waitingDeposits.reduce((s, d) => s + d.amount, 0),
                        )}
                        note={t('collections.stats.withStaffNote', {
                            n: f.num(waitingDeposits.length),
                        })}
                        tone="warning"
                    />
                    <MiniStat
                        icon={Smartphone}
                        label={t('collections.stats.toVerify')}
                        value={f.num(toVerify.length)}
                        note={t('collections.stats.toVerifyNote')}
                    />
                    <MiniStat
                        icon={Landmark}
                        label={t('collections.stats.dues')}
                        value={f.taka(totalDues)}
                        note={t('collections.stats.duesNote', {
                            n: f.num(642),
                        })}
                        tone="danger"
                    />
                </div>

                <Panel>
                    <Tabs
                        className="px-2"
                        value={view}
                        onChange={setView}
                        items={[
                            {
                                value: 'collections',
                                label: t('collections.tabs.collections'),
                                count: f.num(toVerify.length),
                                tone: 'warning',
                            },
                            {
                                value: 'deposits',
                                label: t('collections.tabs.deposits'),
                                count: f.num(waitingDeposits.length),
                                tone: 'warning',
                            },
                            {
                                value: 'dues',
                                label: t('collections.tabs.dues'),
                            },
                        ]}
                    />

                    {view === 'collections' && (
                        <>
                            <FilterBar>
                                <SearchInput
                                    className="sm:w-72"
                                    value={search}
                                    onChange={setSearch}
                                    placeholder={t('collections.search')}
                                />
                                <SelectField
                                    className="sm:w-44"
                                    value={method}
                                    onChange={setMethod}
                                    label={t('collections.columns.method')}
                                    options={[
                                        {
                                            value: 'all',
                                            label: t('collections.allMethods'),
                                        },
                                        ...(
                                            [
                                                'cash',
                                                'bkash',
                                                'nagad',
                                                'bank',
                                                'cheque',
                                            ] as const
                                        ).map((m) => ({
                                            value: m,
                                            label: t(`admin.method.${m}`),
                                        })),
                                    ]}
                                />
                                <SelectField
                                    className="sm:w-44"
                                    value={status}
                                    onChange={setStatus}
                                    label={t('collections.columns.status')}
                                    options={[
                                        {
                                            value: 'all',
                                            label: t('collections.allStatuses'),
                                        },
                                        ...(
                                            [
                                                'pending',
                                                'confirmed',
                                                'rejected',
                                            ] as const
                                        ).map((s) => ({
                                            value: s,
                                            label: t(`collections.status.${s}`),
                                        })),
                                    ]}
                                />
                            </FilterBar>
                            <DataTable
                                columns={collectionColumns}
                                rows={paged.rows}
                                rowKey={(c) => c.number}
                                minWidth={960}
                            />
                            <TableFooter paged={paged} />
                        </>
                    )}

                    {view === 'deposits' && (
                        <>
                            <p className="border-b px-4 py-2.5 text-xs text-muted-foreground">
                                {t('collections.deposits.help')}
                            </p>
                            <DataTable
                                columns={depositColumns}
                                rows={deposits}
                                rowKey={(d) => d.id}
                                minWidth={720}
                            />
                        </>
                    )}

                    {view === 'dues' && (
                        <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-2">
                            <div className="flex flex-col gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        {t('collections.dues.total')}
                                    </p>
                                    <p className="text-2xl font-semibold tabular-nums">
                                        {f.taka(totalDues)}
                                    </p>
                                </div>
                                <div
                                    className="flex h-3 w-full gap-0.5"
                                    role="img"
                                    aria-label={t('collections.dues.aging')}
                                >
                                    {aging.map((a, i) => (
                                        <div
                                            key={a.key}
                                            style={{
                                                width: `${(a.amount / totalDues) * 100}%`,
                                                background: agingColor[a.key],
                                                borderRadius:
                                                    i === 0
                                                        ? '4px 0 0 4px'
                                                        : i === aging.length - 1
                                                          ? '0 4px 4px 0'
                                                          : 0,
                                            }}
                                            title={`${t(`collections.dues.bucket.${a.key}`)}: ${f.taka(a.amount)}`}
                                        />
                                    ))}
                                </div>
                                <ul className="flex flex-col divide-y rounded-md border">
                                    {aging.map((a) => (
                                        <li
                                            key={a.key}
                                            className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                                        >
                                            <span className="flex items-center gap-2">
                                                <span
                                                    className="size-2.5 rounded-sm"
                                                    style={{
                                                        background:
                                                            agingColor[a.key],
                                                    }}
                                                    aria-hidden
                                                />
                                                {t(
                                                    `collections.dues.bucket.${a.key}`,
                                                )}
                                            </span>
                                            <span className="text-right tabular-nums">
                                                <span className="font-medium">
                                                    {f.taka(a.amount)}
                                                </span>
                                                <span className="block text-xs text-muted-foreground">
                                                    {t(
                                                        'collections.dues.shops',
                                                        { n: f.num(a.shops) },
                                                    )}
                                                </span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="rounded-md border">
                                <PanelHeader
                                    title={t('collections.dues.topTitle')}
                                    subtitle={t('collections.dues.topSubtitle')}
                                />
                                <ul className="divide-y">
                                    {topDue.map((s) => (
                                        <li
                                            key={s.id}
                                            className="flex items-center gap-3 px-4 py-2.5"
                                        >
                                            <Stack
                                                main={name(s)}
                                                sub={`${s.owner} · ${s.route}`}
                                            />
                                            <span className="ml-auto text-right">
                                                <span
                                                    className={cn(
                                                        'font-medium tabular-nums',
                                                        s.due > s.creditLimit &&
                                                            'text-danger-ink',
                                                    )}
                                                >
                                                    {f.taka(s.due)}
                                                </span>
                                                <span className="block text-xs text-muted-foreground tabular-nums">
                                                    {t(
                                                        'collections.dues.limit',
                                                        {
                                                            amount: f.taka(
                                                                s.creditLimit,
                                                            ),
                                                        },
                                                    )}
                                                </span>
                                            </span>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="size-8"
                                                asChild
                                            >
                                                <a
                                                    href={`tel:${s.phone.replace(/\D/g, '')}`}
                                                    aria-label={t(
                                                        'orders.detail.call',
                                                    )}
                                                >
                                                    <Phone className="size-4" />
                                                </a>
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="size-8"
                                                asChild
                                            >
                                                <Link
                                                    href={shopsIndex({
                                                        query: { q: s.code },
                                                    })}
                                                    aria-label={t(
                                                        'admin.actions.view',
                                                    )}
                                                >
                                                    <Eye className="size-4" />
                                                </Link>
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </Panel>
            </PageBody>

            <ConfirmDialog
                open={rejecting !== null}
                onOpenChange={(open) => !open && setRejecting(null)}
                title={t('collections.reject.title', {
                    number: rejecting?.number ?? '',
                })}
                description={t('collections.reject.description')}
                confirmLabel={t('admin.actions.reject')}
                destructive
                reasonLabel={t('collections.reject.reason')}
                reasonOptions={[
                    t('collections.reject.r1'),
                    t('collections.reject.r2'),
                ]}
                onConfirm={(reason) => {
                    if (rejecting) {
                        rejectCollection(rejecting.number, reason);
                        toast.success(
                            t('collections.toast.rejected', {
                                number: rejecting.number,
                            }),
                        );
                    }
                }}
            />
            {receiving && (
                <ReceiveDepositDialog
                    deposit={receiving}
                    onClose={() => setReceiving(null)}
                />
            )}
        </>
    );
}

function ReceiveDepositDialog({
    deposit,
    onClose,
}: {
    deposit: Deposit;
    onClose: () => void;
}) {
    const { t, f } = useAdmin();
    const [counted, setCounted] = useState(String(deposit.amount));
    const amount = Number(counted) || 0;
    const diff = amount - deposit.amount;

    return (
        <FormDialog
            open
            onOpenChange={(open) => !open && onClose()}
            title={t('collections.receiveDialog.title', {
                name: staffByCode(deposit.staff).name,
            })}
            description={t('collections.receiveDialog.description', {
                n: f.num(deposit.collections),
                amount: f.taka(deposit.amount),
            })}
            submitLabel={t('collections.deposits.receive')}
            onSubmit={() => {
                receiveDeposit(deposit.id, amount);
                toast.success(
                    t('collections.toast.received', { amount: f.taka(amount) }),
                );
            }}
        >
            <Field label={t('collections.receiveDialog.counted')}>
                <TextInput
                    type="number"
                    value={counted}
                    onChange={setCounted}
                    min={0}
                    inputMode="numeric"
                    autoFocus
                />
            </Field>
            {diff !== 0 && (
                <p
                    className={cn(
                        'rounded-md px-3 py-2 text-sm',
                        diff < 0
                            ? 'bg-danger-soft text-danger-ink'
                            : 'bg-warning-soft text-warning-ink',
                    )}
                >
                    {diff < 0
                        ? t('collections.receiveDialog.short', {
                              amount: f.taka(-diff),
                          })
                        : t('collections.receiveDialog.extra', {
                              amount: f.taka(diff),
                          })}
                </p>
            )}
        </FormDialog>
    );
}

CollectionsIndex.layout = {
    breadcrumbs: [{ title: 'nav.collections', href: collectionsIndex() }],
};
