import { Head, Link } from '@inertiajs/react';
import {
    Ban,
    Check,
    Download,
    Eye,
    FileUp,
    MapPin,
    MapPinOff,
    Pencil,
    Phone,
    Plus,
    Power,
    Route as RouteIcon,
} from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { KeyValues, Stack } from '@/components/admin/bits';
import type { Column } from '@/components/admin/data-table';
import {
    BulkBar,
    DataTable,
    TableFooter,
    usePaged,
} from '@/components/admin/data-table';
import { Field, FormDialog, TextInput } from '@/components/admin/dialogs';
import { FilterBar, SearchInput, SelectField } from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { RowMenu } from '@/components/admin/row-menu';
import { StatusBadge } from '@/components/admin/status-badge';
import type { Tone } from '@/components/admin/status-badge';
import { Tabs } from '@/components/admin/tabs';
import { Meter, Panel, PanelHeader } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { Shop, ShopCategory } from '@/data/admin/customers';
import {
    allRoutesOf,
    importShops,
    moveShops,
    saveShop,
    setShopStatus,
    useAdminData,
} from '@/data/admin/store';
import type { ShopInput } from '@/data/admin/store';
import { staffByCode } from '@/data/admin/store';
import { useAdmin } from '@/hooks/use-admin';
import { useQuery } from '@/hooks/use-query';
import { downloadCsv, parseCsv } from '@/lib/csv';
import { orderTone } from '@/lib/order-status';
import { cn } from '@/lib/utils';
import { show as orderShow } from '@/routes/orders';
import { index as shopsIndex } from '@/routes/shops';

type Tab = 'all' | 'pending' | 'inactive30' | 'dues' | 'inactive';

const statusTone: Record<Shop['status'], Tone> = {
    active: 'success',
    pending_approval: 'warning',
    inactive: 'neutral',
};
const shopCategories: ShopCategory[] = [
    'grocery',
    'pharmacy',
    'wholesale',
    'tea_stall',
];

const tabFilter: Record<Tab, (s: Shop) => boolean> = {
    all: (s) => s.status !== 'inactive',
    pending: (s) => s.status === 'pending_approval',
    inactive30: (s) =>
        s.status === 'active' &&
        (s.lastOrderDays === null || s.lastOrderDays > 30),
    dues: (s) => s.due > 0,
    inactive: (s) => s.status === 'inactive',
};

const isTab = (v: string | null): v is Tab => v !== null && v in tabFilter;

export default function ShopsIndex() {
    const { t, f, name } = useAdmin();
    const state = useAdminData();
    const { shops } = state;
    const routes = allRoutesOf(state).map((r) => r.name);
    const tabQuery = useQuery('tab');
    const qQuery = useQuery('q');
    const routeQuery = useQuery('route');
    const [tab, setTab] = useState<Tab>(isTab(tabQuery) ? tabQuery : 'all');
    const [search, setSearch] = useState(qQuery ?? '');
    const [route, setRoute] = useState(routeQuery ?? 'all');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [editing, setEditing] = useState<Shop | 'new' | null>(null);
    const [viewing, setViewing] = useState<Shop | null>(null);
    const [moving, setMoving] = useState<string[]>([]);
    const [importOpen, setImportOpen] = useState(false);

    const filtered = shops.filter((s) => {
        const q = search.trim().toLowerCase();

        return (
            (route === 'all' || s.route === route) &&
            (q === '' ||
                s.name.toLowerCase().includes(q) ||
                s.name_bn.includes(q) ||
                s.phone.includes(q) ||
                s.code.toLowerCase().includes(q) ||
                s.owner.toLowerCase().includes(q))
        );
    });
    const rows = filtered.filter(tabFilter[tab]);
    const paged = usePaged(rows);
    const count = (k: Tab) => f.num(filtered.filter(tabFilter[k]).length);
    const clear = () => setSelected(new Set());
    const selectedIds = [...selected];

    const lastOrder = (days: number | null) =>
        days === null
            ? t('shops.never')
            : days === 0
              ? t('admin.filters.today')
              : t('admin.time.daysAgo', { n: f.num(days) });

    const approve = (ids: string[]) => {
        setShopStatus(ids, 'active');
        toast.success(t('shops.toast.approved', { n: f.num(ids.length) }));
    };

    const columns: Column<Shop>[] = [
        {
            key: 'shop',
            header: t('shops.columns.shop'),
            cell: (s) => (
                <button
                    type="button"
                    onClick={() => setViewing(s)}
                    className="text-left"
                >
                    <Stack
                        main={
                            <span className="font-medium underline-offset-4 hover:underline">
                                {name(s)}
                            </span>
                        }
                        sub={`${s.code} · ${t(`admin.shopCategory.${s.category}`)}`}
                    />
                </button>
            ),
        },
        {
            key: 'owner',
            header: t('shops.columns.owner'),
            cell: (s) => <Stack main={s.owner} sub={s.phone} />,
        },
        {
            key: 'route',
            header: t('shops.columns.route'),
            cell: (s) => (
                <span className="text-muted-foreground">{s.route}</span>
            ),
        },
        {
            key: 'due',
            header: t('shops.columns.due'),
            align: 'right',
            cell: (s) => (
                <Stack
                    main={
                        <span
                            className={cn(
                                'font-medium tabular-nums',
                                s.due > s.creditLimit && 'text-danger-ink',
                            )}
                        >
                            {f.taka(s.due)}
                        </span>
                    }
                    sub={t('shops.limit', { amount: f.taka(s.creditLimit) })}
                />
            ),
        },
        {
            // Last order + whether the shop has a saved GPS location.
            key: 'activity',
            header: t('shops.columns.lastOrder'),
            cell: (s) => (
                <Stack
                    main={
                        <span
                            className={cn(
                                'whitespace-nowrap',
                                (s.lastOrderDays ?? 0) > 30 &&
                                    'text-warning-ink',
                            )}
                        >
                            {lastOrder(s.lastOrderDays)}
                        </span>
                    }
                    sub={
                        s.hasLocation ? (
                            <span className="inline-flex items-center gap-1">
                                <MapPin
                                    className="size-3 text-success"
                                    aria-hidden
                                />
                                {t('shops.locationSet')}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-warning-ink">
                                <MapPinOff className="size-3" aria-hidden />
                                {t('shops.locationMissing')}
                            </span>
                        )
                    }
                />
            ),
        },
        {
            key: 'status',
            header: t('shops.columns.status'),
            cell: (s) => (
                <Stack
                    main={
                        <StatusBadge
                            tone={statusTone[s.status]}
                            label={t(`admin.shopStatus.${s.status}`)}
                        />
                    }
                    sub={
                        s.addedBy
                            ? t('shops.addedBy', {
                                  name: staffByCode(s.addedBy).name,
                              })
                            : undefined
                    }
                />
            ),
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (s) => (
                <div className="flex items-center justify-end gap-1">
                    {s.status === 'pending_approval' && (
                        <Button size="sm" onClick={() => approve([s.id])}>
                            <Check className="size-3.5" />
                            {t('admin.actions.approve')}
                        </Button>
                    )}
                    <RowMenu
                        actions={[
                            {
                                label: t('shops.actions.view'),
                                icon: Eye,
                                onSelect: () => setViewing(s),
                            },
                            {
                                label: t('admin.actions.edit'),
                                icon: Pencil,
                                onSelect: () => setEditing(s),
                            },
                            {
                                label: t('shops.moveRoute'),
                                icon: RouteIcon,
                                onSelect: () => setMoving([s.id]),
                            },
                            {
                                label: t('shops.actions.deactivate'),
                                icon: Ban,
                                danger: true,
                                hidden: s.status === 'inactive',
                                onSelect: () => {
                                    setShopStatus([s.id], 'inactive');
                                    toast.success(
                                        t('shops.toast.deactivated', {
                                            name: name(s),
                                        }),
                                    );
                                },
                            },
                            {
                                label: t('shops.actions.activate'),
                                icon: Power,
                                hidden: s.status !== 'inactive',
                                onSelect: () => {
                                    setShopStatus([s.id], 'active');
                                    toast.success(
                                        t('shops.toast.activated', {
                                            name: name(s),
                                        }),
                                    );
                                },
                            },
                        ]}
                    />
                </div>
            ),
        },
    ];

    return (
        <>
            <Head title={t('shops.title')} />
            <PageBody>
                <PageHeader
                    title={t('shops.title')}
                    description={t('shops.description')}
                    actions={
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-card"
                                onClick={() =>
                                    downloadCsv(
                                        'shops',
                                        [
                                            'code',
                                            'name',
                                            'name_bn',
                                            'owner',
                                            'phone',
                                            'route',
                                            'category',
                                            'due',
                                            'credit_limit',
                                        ],
                                        rows.map((s) => [
                                            s.code,
                                            s.name,
                                            s.name_bn,
                                            s.owner,
                                            s.phone,
                                            s.route,
                                            s.category,
                                            s.due,
                                            s.creditLimit,
                                        ]),
                                    )
                                }
                            >
                                <Download className="size-3.5" />
                                {t('admin.actions.export')}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-card"
                                onClick={() => setImportOpen(true)}
                            >
                                <FileUp className="size-3.5" />
                                {t('shops.import.button')}
                            </Button>
                            <Button size="sm" onClick={() => setEditing('new')}>
                                <Plus className="size-3.5" />
                                {t('shops.add')}
                            </Button>
                        </>
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
                                label: t('shops.tabs.all'),
                                count: count('all'),
                            },
                            {
                                value: 'pending',
                                label: t('shops.tabs.pending'),
                                count: count('pending'),
                                tone: 'warning',
                            },
                            {
                                value: 'inactive30',
                                label: t('shops.tabs.inactive30'),
                                count: count('inactive30'),
                            },
                            {
                                value: 'dues',
                                label: t('shops.tabs.dues'),
                                count: count('dues'),
                            },
                            {
                                value: 'inactive',
                                label: t('shops.tabs.inactive'),
                                count: count('inactive'),
                            },
                        ]}
                    />
                    <FilterBar>
                        <SearchInput
                            className="sm:w-72"
                            value={search}
                            onChange={setSearch}
                            placeholder={t('shops.search')}
                        />
                        <SelectField
                            className="sm:w-48"
                            value={route}
                            onChange={setRoute}
                            label={t('shops.columns.route')}
                            options={[
                                {
                                    value: 'all',
                                    label: t('admin.filters.allRoutes'),
                                },
                                ...routes.map((r) => ({ value: r, label: r })),
                            ]}
                        />
                    </FilterBar>
                    <BulkBar count={selected.size} onClear={clear}>
                        <Button
                            size="sm"
                            disabled={
                                !shops.some(
                                    (s) =>
                                        selected.has(s.id) &&
                                        s.status === 'pending_approval',
                                )
                            }
                            onClick={() => {
                                approve(
                                    shops
                                        .filter(
                                            (s) =>
                                                selected.has(s.id) &&
                                                s.status === 'pending_approval',
                                        )
                                        .map((s) => s.id),
                                );
                                clear();
                            }}
                        >
                            <Check className="size-3.5" />
                            {t('admin.actions.approve')}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-card"
                            onClick={() => setMoving(selectedIds)}
                        >
                            {t('shops.moveRoute')}
                        </Button>
                    </BulkBar>
                    <DataTable
                        columns={columns}
                        rows={paged.rows}
                        rowKey={(s) => s.id}
                        selected={selected}
                        onSelectedChange={setSelected}
                        minWidth={960}
                    />
                    <TableFooter paged={paged} />
                </Panel>
            </PageBody>

            {editing && (
                <ShopDialog
                    shop={editing === 'new' ? null : editing}
                    routes={routes}
                    onClose={() => setEditing(null)}
                />
            )}
            {viewing && (
                <ShopDetailDialog
                    shop={shops.find((s) => s.id === viewing.id) ?? viewing}
                    onClose={() => setViewing(null)}
                    onEdit={() => {
                        setEditing(viewing);
                        setViewing(null);
                    }}
                />
            )}
            {moving.length > 0 && (
                <MoveRouteDialog
                    ids={moving}
                    routes={routes}
                    onClose={() => {
                        setMoving([]);
                        clear();
                    }}
                />
            )}
            {importOpen && (
                <ImportShopsDialog
                    routes={routes}
                    onClose={() => setImportOpen(false)}
                />
            )}
        </>
    );
}

function ShopDialog({
    shop,
    routes,
    onClose,
}: {
    shop: Shop | null;
    routes: string[];
    onClose: () => void;
}) {
    const { t } = useAdmin();
    const [form, setForm] = useState({
        name: shop?.name ?? '',
        name_bn: shop?.name_bn ?? '',
        owner: shop?.owner ?? '',
        phone: shop?.phone ?? '',
        route: shop?.route ?? routes[0],
        category: shop?.category ?? 'grocery',
        creditLimit: String(shop?.creditLimit ?? 10_000),
    });
    const set = (key: keyof typeof form) => (value: string) =>
        setForm((prev) => ({ ...prev, [key]: value }));
    const phoneOk = /^01\d{3}-?\d{6}$/.test(form.phone.trim());
    const [touched, setTouched] = useState(false);

    return (
        <FormDialog
            open
            onOpenChange={(open) => !open && onClose()}
            wide
            title={shop ? t('shops.form.editTitle') : t('shops.form.addTitle')}
            description={t('shops.form.description')}
            submitLabel={shop ? t('admin.actions.save') : t('shops.add')}
            onSubmit={() => {
                setTouched(true);

                if (!form.name.trim() || !form.owner.trim() || !phoneOk) {
                    return false;
                }

                const input: ShopInput = {
                    name: form.name.trim(),
                    name_bn: form.name_bn.trim() || form.name.trim(),
                    owner: form.owner.trim(),
                    phone: form.phone.trim(),
                    route: form.route,
                    category: form.category as ShopCategory,
                    creditLimit: Number(form.creditLimit) || 0,
                };
                saveShop(shop?.id ?? null, input);
                toast.success(
                    shop
                        ? t('shops.toast.updated', { name: input.name })
                        : t('shops.toast.added', { name: input.name }),
                );
            }}
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Field
                    label={t('shops.form.name')}
                    error={
                        touched && !form.name.trim()
                            ? t('admin.form.required')
                            : undefined
                    }
                >
                    <TextInput
                        value={form.name}
                        onChange={set('name')}
                        autoFocus
                    />
                </Field>
                <Field label={t('shops.form.nameBn')}>
                    <TextInput value={form.name_bn} onChange={set('name_bn')} />
                </Field>
                <Field
                    label={t('shops.columns.owner')}
                    error={
                        touched && !form.owner.trim()
                            ? t('admin.form.required')
                            : undefined
                    }
                >
                    <TextInput value={form.owner} onChange={set('owner')} />
                </Field>
                <Field
                    label={t('shops.form.phone')}
                    help="01XXX-XXXXXX"
                    error={
                        touched && !phoneOk ? t('admin.form.phone') : undefined
                    }
                >
                    <TextInput
                        type="tel"
                        value={form.phone}
                        onChange={set('phone')}
                        inputMode="tel"
                    />
                </Field>
                <Field label={t('shops.columns.route')}>
                    <SelectField
                        value={form.route}
                        onChange={set('route')}
                        label={t('shops.columns.route')}
                        options={routes.map((r) => ({ value: r, label: r }))}
                    />
                </Field>
                <Field label={t('shops.form.category')}>
                    <SelectField
                        value={form.category}
                        onChange={set('category')}
                        label={t('shops.form.category')}
                        options={shopCategories.map((c) => ({
                            value: c,
                            label: t(`admin.shopCategory.${c}`),
                        }))}
                    />
                </Field>
                <Field label={t('shops.form.creditLimit')}>
                    <TextInput
                        type="number"
                        value={form.creditLimit}
                        onChange={set('creditLimit')}
                        min={0}
                        inputMode="numeric"
                    />
                </Field>
            </div>
            <p className="text-xs text-muted-foreground">
                {t('shops.form.locationNote')}
            </p>
        </FormDialog>
    );
}

function ShopDetailDialog({
    shop,
    onClose,
    onEdit,
}: {
    shop: Shop;
    onClose: () => void;
    onEdit: () => void;
}) {
    const { t, f, name, ago } = useAdmin();
    const { orders } = useAdminData();
    const shopOrders = orders.filter((o) => o.shopId === shop.id).slice(0, 5);

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
                <div className="flex items-start justify-between gap-3 pr-6">
                    <div>
                        <DialogTitle>{name(shop)}</DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            {shop.code} ·{' '}
                            {t(`admin.shopCategory.${shop.category}`)} ·{' '}
                            {shop.route}
                        </p>
                    </div>
                    <StatusBadge
                        tone={statusTone[shop.status]}
                        label={t(`admin.shopStatus.${shop.status}`)}
                    />
                </div>
                <div className="rounded-md border">
                    <KeyValues
                        items={[
                            {
                                label: t('shops.columns.owner'),
                                value: shop.owner,
                            },
                            { label: t('shops.form.phone'), value: shop.phone },
                            {
                                label: t('shops.columns.lastOrder'),
                                value:
                                    shop.lastOrderDays === null
                                        ? t('shops.never')
                                        : t('admin.time.daysAgo', {
                                              n: f.num(shop.lastOrderDays),
                                          }),
                            },
                            {
                                label: t('shops.columns.location'),
                                value: shop.hasLocation
                                    ? t('shops.locationSet')
                                    : t('shops.locationMissing'),
                            },
                        ]}
                    />
                    <div className="border-t px-4 py-3">
                        <div className="mb-1.5 flex justify-between text-sm">
                            <span className="text-muted-foreground">
                                {t('shops.columns.due')}
                            </span>
                            <span
                                className={cn(
                                    'font-medium tabular-nums',
                                    shop.due > shop.creditLimit &&
                                        'text-danger-ink',
                                )}
                            >
                                {f.taka(shop.due)} / {f.taka(shop.creditLimit)}
                            </span>
                        </div>
                        <Meter
                            value={shop.due}
                            max={Math.max(1, shop.creditLimit)}
                            tone={
                                shop.due > shop.creditLimit
                                    ? 'danger'
                                    : 'primary'
                            }
                            label={t('shops.columns.due')}
                        />
                    </div>
                </div>
                <div className="rounded-md border">
                    <PanelHeader title={t('shops.detail.recentOrders')} />
                    {shopOrders.length === 0 ? (
                        <p className="px-4 py-4 text-center text-sm text-muted-foreground">
                            {t('shops.never')}
                        </p>
                    ) : (
                        <ul className="divide-y">
                            {shopOrders.map((o) => (
                                <li
                                    key={o.number}
                                    className="flex items-center gap-3 px-4 py-2 text-sm"
                                >
                                    <Link
                                        href={orderShow(o.number)}
                                        className="font-medium underline-offset-4 hover:underline"
                                    >
                                        {o.number}
                                    </Link>
                                    <span className="text-xs text-muted-foreground">
                                        {ago(o.minutesAgo)}
                                    </span>
                                    <StatusBadge
                                        className="ml-auto"
                                        tone={orderTone[o.status]}
                                        label={t(
                                            `admin.orderStatus.${o.status}`,
                                        )}
                                    />
                                    <span className="w-20 text-right font-medium tabular-nums">
                                        {f.taka(o.total)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" asChild>
                        <a href={`tel:${shop.phone.replace(/\D/g, '')}`}>
                            <Phone className="size-3.5" />
                            {t('orders.detail.call')}
                        </a>
                    </Button>
                    <Button onClick={onEdit}>
                        <Pencil className="size-3.5" />
                        {t('admin.actions.edit')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function MoveRouteDialog({
    ids,
    routes,
    onClose,
}: {
    ids: string[];
    routes: string[];
    onClose: () => void;
}) {
    const { t, f } = useAdmin();
    const [route, setRoute] = useState(routes[0]);

    return (
        <FormDialog
            open
            onOpenChange={(open) => !open && onClose()}
            title={t('shops.move.title', { n: f.num(ids.length) })}
            description={t('shops.move.description')}
            submitLabel={t('shops.moveRoute')}
            onSubmit={() => {
                moveShops(ids, route);
                toast.success(
                    t('shops.toast.moved', { n: f.num(ids.length), route }),
                );
                onClose();
            }}
        >
            <Field label={t('shops.columns.route')}>
                <SelectField
                    value={route}
                    onChange={setRoute}
                    label={t('shops.columns.route')}
                    options={routes.map((r) => ({ value: r, label: r }))}
                />
            </Field>
        </FormDialog>
    );
}

const templateHeader = [
    'name',
    'name_bn',
    'owner',
    'phone',
    'route',
    'category',
    'credit_limit',
];

function ImportShopsDialog({
    routes,
    onClose,
}: {
    routes: string[];
    onClose: () => void;
}) {
    const { t, f } = useAdmin();
    const [rows, setRows] = useState<ShopInput[]>([]);
    const [skipped, setSkipped] = useState(0);
    const [fileName, setFileName] = useState('');

    const read = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (!file) {
            return;
        }

        setFileName(file.name);
        const [header, ...lines] = parseCsv(await file.text());
        const col = (row: string[], key: string) =>
            row[header.indexOf(key)] ?? '';
        const valid: ShopInput[] = [];
        let bad = 0;

        lines.forEach((row) => {
            const name = col(row, 'name');
            const phone = col(row, 'phone');

            if (!name || !/^01\d{3}-?\d{6}$/.test(phone)) {
                bad++;

                return;
            }

            const category = col(row, 'category') as ShopCategory;
            valid.push({
                name,
                name_bn: col(row, 'name_bn') || name,
                owner: col(row, 'owner'),
                phone,
                route: routes.includes(col(row, 'route'))
                    ? col(row, 'route')
                    : routes[0],
                category: shopCategories.includes(category)
                    ? category
                    : 'grocery',
                creditLimit: Number(col(row, 'credit_limit')) || 10_000,
            });
        });

        setRows(valid);
        setSkipped(bad);
    };

    return (
        <FormDialog
            open
            onOpenChange={(open) => !open && onClose()}
            wide
            title={t('shops.import.title')}
            description={t('shops.import.description')}
            submitLabel={t('shops.import.submit', { n: f.num(rows.length) })}
            disabled={rows.length === 0}
            onSubmit={() => {
                importShops(rows);
                toast.success(
                    t('shops.toast.imported', { n: f.num(rows.length) }),
                );
                onClose();
            }}
        >
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                        downloadCsv('shops-template', templateHeader, [
                            [
                                'Mayer Doa Store',
                                'মায়ের দোয়া স্টোর',
                                'Abul Kashem',
                                '01811-223344',
                                routes[0],
                                'grocery',
                                10000,
                            ],
                        ])
                    }
                >
                    <Download className="size-3.5" />
                    {t('shops.import.template')}
                </Button>
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 text-sm hover:bg-muted">
                    <FileUp className="size-3.5" />
                    {fileName || t('shops.import.choose')}
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        className="sr-only"
                        onChange={read}
                    />
                </label>
            </div>
            {fileName && (
                <div className="rounded-md border">
                    <p className="border-b bg-background px-3 py-2 text-xs text-muted-foreground">
                        {t('shops.import.found', {
                            ok: f.num(rows.length),
                            bad: f.num(skipped),
                        })}
                    </p>
                    <ul className="max-h-52 divide-y overflow-y-auto text-sm">
                        {rows.slice(0, 20).map((r, i) => (
                            <li key={i} className="flex gap-3 px-3 py-1.5">
                                <span className="font-medium">{r.name}</span>
                                <span className="text-muted-foreground">
                                    {r.phone}
                                </span>
                                <span className="ml-auto text-muted-foreground">
                                    {r.route}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </FormDialog>
    );
}

ShopsIndex.layout = {
    breadcrumbs: [{ title: 'nav.shops', href: shopsIndex() }],
};
