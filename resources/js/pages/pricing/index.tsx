import { Head } from '@inertiajs/react';
import { History, Info, Pencil, Percent, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Stack, Thumb } from '@/components/admin/bits';
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
import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { PriceList, Product } from '@/data/admin/catalog';
import type { ShopCategory } from '@/data/admin/customers';
import {
    addPriceList,
    allRoutesOf,
    bulkUpdatePrices,
    priceFor,
    setPrice,
    useAdminData,
} from '@/data/admin/store';
import { useAdmin } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';
import { index as pricingIndex } from '@/routes/pricing';

const shopTypes: ShopCategory[] = [
    'grocery',
    'pharmacy',
    'wholesale',
    'tea_stall',
];

export default function PricingIndex() {
    const { t, f, name } = useAdmin();
    const state = useAdminData();
    const { priceLists, products } = state;
    const [listId, setListId] = useState(priceLists[0].id);
    const [editing, setEditing] = useState<Product | null>(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [newOpen, setNewOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const list = priceLists.find((l) => l.id === listId) ?? priceLists[0];
    const rows = products.filter((p) => p.active);
    const paged = usePaged(rows);
    const target = (l: PriceList) =>
        l.appliesTo === 'shop_category'
            ? t(`admin.shopCategory.${l.target}`)
            : l.target;

    const columns: Column<Product>[] = [
        {
            key: 'product',
            header: t('pricing.columns.product'),
            cell: (p) => (
                <div className="flex items-center gap-3">
                    <Thumb label={name(p)} hue={p.hue} />
                    <Stack main={name(p)} sub={p.sku} />
                </div>
            ),
        },
        {
            key: 'mrp',
            header: t('pricing.columns.mrp'),
            align: 'right',
            cell: (p) => (
                <span className="text-muted-foreground tabular-nums">
                    {f.taka(p.mrp)}
                </span>
            ),
        },
        {
            key: 'default',
            header: t('pricing.columns.default'),
            align: 'right',
            cell: (p) => (
                <span className="tabular-nums">{f.taka(p.price)}</span>
            ),
        },
        {
            key: 'price',
            header: t('pricing.columns.price'),
            align: 'right',
            cell: (p) => (
                <span className="font-medium tabular-nums">
                    {f.taka(priceFor(state, list.id, p))}
                </span>
            ),
        },
        {
            key: 'ctn',
            header: t('pricing.columns.ctn'),
            align: 'right',
            cell: (p) => (
                <span className="tabular-nums">
                    {f.taka(priceFor(state, list.id, p) * p.packSize)}
                </span>
            ),
        },
        {
            key: 'diff',
            header: t('pricing.columns.diff'),
            align: 'right',
            cell: (p) => {
                const diff =
                    ((priceFor(state, list.id, p) - p.price) / p.price) * 100;

                return Math.abs(diff) < 0.05 ? (
                    <span className="text-muted-foreground">—</span>
                ) : (
                    <span
                        className={cn(
                            'text-xs font-medium tabular-nums',
                            diff < 0 ? 'text-success-ink' : 'text-warning-ink',
                        )}
                    >
                        {f.signedPercent(diff)}
                    </span>
                );
            },
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (p) => (
                <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                    <Pencil className="size-3.5" />
                    {t('admin.actions.edit')}
                </Button>
            ),
        },
    ];

    return (
        <>
            <Head title={t('pricing.title')} />
            <PageBody>
                <PageHeader
                    title={t('pricing.title')}
                    description={t('pricing.description')}
                    actions={
                        <Button size="sm" onClick={() => setNewOpen(true)}>
                            <Plus className="size-3.5" />
                            {t('pricing.newList')}
                        </Button>
                    }
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                    <div className="flex flex-col gap-3">
                        {priceLists.map((l) => (
                            <button
                                key={l.id}
                                type="button"
                                onClick={() => setListId(l.id)}
                                className={cn(
                                    'flex flex-col gap-1.5 rounded-md border bg-card p-4 text-left transition-colors',
                                    l.id === listId
                                        ? 'border-primary ring-1 ring-primary'
                                        : 'hover:border-ring/50',
                                )}
                            >
                                <span className="flex items-center justify-between gap-2">
                                    <span className="font-semibold">
                                        {name(l)}
                                    </span>
                                    {l.appliesTo === 'default' && (
                                        <StatusBadge
                                            tone="primary"
                                            label={t('pricing.default')}
                                        />
                                    )}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {l.appliesTo === 'default'
                                        ? t('pricing.appliesDefault')
                                        : t(`pricing.applies.${l.appliesTo}`, {
                                              target: target(l),
                                          })}
                                </span>
                            </button>
                        ))}
                    </div>

                    <Panel className="lg:col-span-3">
                        <PanelHeader
                            title={name(list)}
                            subtitle={
                                list.appliesTo === 'default'
                                    ? t('pricing.defaultNote')
                                    : t(`pricing.applies.${list.appliesTo}`, {
                                          target: target(list),
                                      })
                            }
                            action={
                                <div className="flex flex-wrap gap-1">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-card"
                                        onClick={() => setBulkOpen(true)}
                                    >
                                        <Percent className="size-3.5" />
                                        {t('pricing.bulk')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-card"
                                        onClick={() => setHistoryOpen(true)}
                                    >
                                        <History className="size-3.5" />
                                        {t('pricing.history')}
                                    </Button>
                                </div>
                            }
                        />
                        <div className="flex items-start gap-2 border-b bg-info-soft px-4 py-2.5 text-xs text-info-ink">
                            <Info
                                className="mt-px size-3.5 shrink-0"
                                aria-hidden
                            />
                            {t('pricing.offlineNote', {
                                hours: f.num(state.settings.priceWindow),
                            })}
                        </div>
                        <DataTable
                            columns={columns}
                            rows={paged.rows}
                            rowKey={(p) => p.id}
                            minWidth={820}
                        />
                        <TableFooter paged={paged} />
                    </Panel>
                </div>
            </PageBody>

            {editing && (
                <PriceDialog
                    list={list}
                    product={editing}
                    onClose={() => setEditing(null)}
                />
            )}
            {bulkOpen && (
                <BulkDialog list={list} onClose={() => setBulkOpen(false)} />
            )}
            {newOpen && (
                <NewListDialog
                    areas={allRoutesOf(state).map((r) => r.name)}
                    onClose={() => setNewOpen(false)}
                    onCreated={setListId}
                />
            )}
            {historyOpen && (
                <HistoryDialog
                    list={list}
                    onClose={() => setHistoryOpen(false)}
                />
            )}
        </>
    );
}

function PriceDialog({
    list,
    product,
    onClose,
}: {
    list: PriceList;
    product: Product;
    onClose: () => void;
}) {
    const { t, f, name } = useAdmin();
    const state = useAdminData();
    const current = priceFor(state, list.id, product);
    const [value, setValue] = useState(String(current));
    const price = Number(value);
    const error = !(price > 0)
        ? t('admin.form.positive')
        : price > product.mrp
          ? t('products.form.overMrp')
          : undefined;

    return (
        <FormDialog
            open
            onOpenChange={(o) => !o && onClose()}
            title={t('pricing.edit.title', { product: name(product) })}
            description={t('pricing.edit.description', { list: name(list) })}
            submitLabel={t('admin.actions.save')}
            disabled={Boolean(error) || price === current}
            onSubmit={() => {
                setPrice(list.id, product.id, price);
                toast.success(
                    t('pricing.toast.saved', {
                        product: name(product),
                        price: f.taka(price),
                    }),
                );
            }}
        >
            <Field label={t('pricing.edit.perPc')} error={error}>
                <TextInput
                    type="number"
                    value={value}
                    onChange={setValue}
                    min={0}
                    step="any"
                    inputMode="decimal"
                    autoFocus
                />
            </Field>
            <div className="grid grid-cols-3 gap-3 rounded-md bg-muted p-3 text-sm">
                <Stack
                    main={
                        <span className="tabular-nums">
                            {f.taka(product.mrp)}
                        </span>
                    }
                    sub="MRP"
                />
                <Stack
                    main={
                        <span className="tabular-nums">{f.taka(current)}</span>
                    }
                    sub={t('pricing.edit.current')}
                />
                <Stack
                    main={
                        <span className="font-medium tabular-nums">
                            {f.taka((price || 0) * product.packSize)}
                        </span>
                    }
                    sub={t('pricing.columns.ctn')}
                />
            </div>
        </FormDialog>
    );
}

function BulkDialog({
    list,
    onClose,
}: {
    list: PriceList;
    onClose: () => void;
}) {
    const { t, f, name } = useAdmin();
    const { categories } = useAdminData();
    const [category, setCategory] = useState('all');
    const [percent, setPercent] = useState('5');
    const pct = Number(percent);

    return (
        <FormDialog
            open
            onOpenChange={(o) => !o && onClose()}
            title={t('pricing.bulkDialog.title')}
            description={t('pricing.bulkDialog.description', {
                list: name(list),
            })}
            submitLabel={t('pricing.bulkDialog.apply')}
            disabled={!pct || pct < -50 || pct > 50}
            onSubmit={() => {
                bulkUpdatePrices(list.id, category, pct);
                toast.success(
                    t('pricing.toast.bulk', { percent: f.signedPercent(pct) }),
                );
            }}
        >
            <Field label={t('products.columns.category')}>
                <SelectField
                    value={category}
                    onChange={setCategory}
                    label={t('products.columns.category')}
                    options={[
                        {
                            value: 'all',
                            label: t('admin.filters.allCategories'),
                        },
                        ...categories.map((c) => ({
                            value: c.key,
                            label: name(c),
                        })),
                    ]}
                />
            </Field>
            <Field
                label={t('pricing.bulkDialog.percent')}
                help={t('pricing.bulkDialog.percentHelp')}
            >
                <TextInput
                    type="number"
                    value={percent}
                    onChange={setPercent}
                    step="any"
                    inputMode="decimal"
                />
            </Field>
        </FormDialog>
    );
}

function NewListDialog({
    areas,
    onClose,
    onCreated,
}: {
    areas: string[];
    onClose: () => void;
    onCreated: (id: string) => void;
}) {
    const { t } = useAdmin();
    const [form, setForm] = useState({
        name: '',
        name_bn: '',
        appliesTo: 'shop_category' as 'shop_category' | 'area',
        target: shopTypes[0] as string,
    });

    return (
        <FormDialog
            open
            onOpenChange={(o) => !o && onClose()}
            title={t('pricing.newList')}
            description={t('pricing.newDialog.description')}
            submitLabel={t('pricing.newList')}
            disabled={form.name.trim() === ''}
            onSubmit={() => {
                const listName = form.name.trim();
                void addPriceList({
                    name: listName,
                    name_bn: form.name_bn.trim() || listName,
                    appliesTo: form.appliesTo,
                    target: form.target,
                }).then((id) => {
                    if (id) {
                        toast.success(
                            t('pricing.toast.created', { name: listName }),
                        );
                        onCreated(id);
                    }
                });
                onClose();
            }}
        >
            <div className="grid grid-cols-2 gap-3">
                <Field label={t('pricing.newDialog.name')}>
                    <TextInput
                        value={form.name}
                        onChange={(v) => setForm({ ...form, name: v })}
                        autoFocus
                    />
                </Field>
                <Field label={t('pricing.newDialog.nameBn')}>
                    <TextInput
                        value={form.name_bn}
                        onChange={(v) => setForm({ ...form, name_bn: v })}
                    />
                </Field>
            </div>
            <Field label={t('pricing.newDialog.appliesTo')}>
                <SelectField
                    value={form.appliesTo}
                    onChange={(v) =>
                        setForm({
                            ...form,
                            appliesTo: v as 'shop_category' | 'area',
                            target: v === 'area' ? areas[0] : shopTypes[0],
                        })
                    }
                    label={t('pricing.newDialog.appliesTo')}
                    options={[
                        {
                            value: 'shop_category',
                            label: t('pricing.newDialog.shopType'),
                        },
                        { value: 'area', label: t('pricing.newDialog.area') },
                    ]}
                />
            </Field>
            <Field
                label={
                    form.appliesTo === 'area'
                        ? t('pricing.newDialog.area')
                        : t('pricing.newDialog.shopType')
                }
            >
                <SelectField
                    value={form.target}
                    onChange={(v) => setForm({ ...form, target: v })}
                    label={t('pricing.newDialog.appliesTo')}
                    options={
                        form.appliesTo === 'area'
                            ? areas.map((a) => ({ value: a, label: a }))
                            : shopTypes.map((c) => ({
                                  value: c,
                                  label: t(`admin.shopCategory.${c}`),
                              }))
                    }
                />
            </Field>
            <p className="text-xs text-muted-foreground">
                {t('pricing.newDialog.note')}
            </p>
        </FormDialog>
    );
}

function HistoryDialog({
    list,
    onClose,
}: {
    list: PriceList;
    onClose: () => void;
}) {
    const { t, f, name, ago } = useAdmin();
    const { priceHistory, products } = useAdminData();
    const rows = priceHistory.filter((h) => h.listId === list.id);

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
                <DialogTitle>
                    {t('pricing.historyTitle', { list: name(list) })}
                </DialogTitle>
                {rows.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        {t('pricing.noHistory')}
                    </p>
                ) : (
                    <ul className="divide-y rounded-md border">
                        {rows.map((h) => {
                            const product = products.find(
                                (p) => p.id === h.productId,
                            );

                            return (
                                <li
                                    key={h.id}
                                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                                >
                                    <Stack
                                        main={
                                            product
                                                ? name(product)
                                                : h.productId
                                        }
                                        sub={ago(h.minutesAgo)}
                                    />
                                    <span className="tabular-nums">
                                        <span className="text-muted-foreground line-through">
                                            {f.taka(h.from)}
                                        </span>{' '}
                                        →{' '}
                                        <span className="font-medium">
                                            {f.taka(h.to)}
                                        </span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </DialogContent>
        </Dialog>
    );
}

PricingIndex.layout = {
    breadcrumbs: [{ title: 'nav.pricing', href: pricingIndex() }],
};
