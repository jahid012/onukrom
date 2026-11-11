import { Head } from '@inertiajs/react';
import { Download, Pencil, Plus } from 'lucide-react';
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
import {
    FilterBar,
    SearchInput,
    SelectField,
    Switch,
} from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { Panel } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import type { Product } from '@/data/admin/catalog';
import {
    saveProduct,
    setProductActive,
    mainWarehouseId,
    useAdminData,
} from '@/data/admin/store';
import { useAdmin } from '@/hooks/use-admin';
import { useQuery } from '@/hooks/use-query';
import { downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';
import { index as productsIndex } from '@/routes/products';

export default function ProductsIndex() {
    const { t, f, name, qty } = useAdmin();
    const state = useAdminData();
    const { products, stock, categories } = state;
    const mainId = mainWarehouseId(state);
    const [category, setCategory] = useState('all');
    const [search, setSearch] = useState(useQuery('q') ?? '');
    const [editing, setEditing] = useState<Product | 'new' | null>(null);

    const rows = products.filter((p) => {
        const q = search.trim().toLowerCase();

        return (
            (category === 'all' || p.category === category) &&
            (q === '' ||
                p.name.toLowerCase().includes(q) ||
                p.name_bn.includes(q) ||
                p.sku.toLowerCase().includes(q))
        );
    });
    const paged = usePaged(rows);
    const categoryName = (key: string) =>
        name(categories.find((c) => c.key === key) ?? categories[0]);
    const available = (p: Product) => {
        const level = stock[mainId]?.[p.id];

        return level ? level.onHand - level.reserved : 0;
    };

    const columns: Column<Product>[] = [
        {
            key: 'product',
            header: t('products.columns.product'),
            cell: (p) => (
                <div
                    className={cn(
                        'flex items-center gap-3',
                        !p.active && 'opacity-60',
                    )}
                >
                    <Thumb label={name(p)} hue={p.hue} />
                    <Stack
                        main={<span className="font-medium">{name(p)}</span>}
                        sub={`${p.sku} · ${p.brand}`}
                    />
                </div>
            ),
        },
        {
            key: 'category',
            header: t('products.columns.category'),
            cell: (p) => (
                <span className="text-muted-foreground">
                    {categoryName(p.category)}
                </span>
            ),
        },
        {
            key: 'pack',
            header: t('products.columns.pack'),
            cell: (p) => (
                <span className="whitespace-nowrap">
                    {t('admin.unit.packOf', { n: f.num(p.packSize) })}
                </span>
            ),
        },
        {
            key: 'mrp',
            header: t('products.columns.mrp'),
            align: 'right',
            cell: (p) => (
                <span className="text-muted-foreground tabular-nums">
                    {f.taka(p.mrp)}
                </span>
            ),
        },
        {
            key: 'price',
            header: t('products.columns.price'),
            align: 'right',
            cell: (p) => (
                <Stack
                    main={
                        <span className="font-medium tabular-nums">
                            {f.taka(p.price)}
                        </span>
                    }
                    sub={t('products.perCtn', {
                        amount: f.taka(p.price * p.packSize),
                    })}
                />
            ),
        },
        {
            key: 'stock',
            header: t('products.columns.stock'),
            cell: (p) => {
                const left = available(p);

                if (left <= 0) {
                    return (
                        <StatusBadge
                            tone="danger"
                            label={t('products.outOfStock')}
                        />
                    );
                }

                return (
                    <span
                        className={cn(
                            'text-sm whitespace-nowrap',
                            left < p.reorderAt &&
                                'font-medium text-warning-ink',
                        )}
                    >
                        {qty(left, p.packSize)}
                    </span>
                );
            },
        },
        {
            key: 'active',
            header: t('products.columns.active'),
            align: 'center',
            cell: (p) => (
                <Switch
                    checked={p.active}
                    onChange={(v) => {
                        setProductActive(p.id, v);
                        toast.success(
                            t(
                                v
                                    ? 'products.toast.activated'
                                    : 'products.toast.deactivated',
                                { name: name(p) },
                            ),
                        );
                    }}
                    label={t('products.columns.active')}
                />
            ),
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
            <Head title={t('products.title')} />
            <PageBody>
                <PageHeader
                    title={t('products.title')}
                    description={t('products.description')}
                    actions={
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-card"
                                onClick={() =>
                                    downloadCsv(
                                        'products',
                                        [
                                            'sku',
                                            'name',
                                            'name_bn',
                                            'brand',
                                            'category',
                                            'pack_size',
                                            'mrp',
                                            'price',
                                            'active',
                                        ],
                                        rows.map((p) => [
                                            p.sku,
                                            p.name,
                                            p.name_bn,
                                            p.brand,
                                            p.category,
                                            p.packSize,
                                            p.mrp,
                                            p.price,
                                            p.active ? 'yes' : 'no',
                                        ]),
                                    )
                                }
                            >
                                <Download className="size-3.5" />
                                {t('admin.actions.export')}
                            </Button>
                            <Button size="sm" onClick={() => setEditing('new')}>
                                <Plus className="size-3.5" />
                                {t('products.add')}
                            </Button>
                        </>
                    }
                />

                <Panel>
                    <div className="flex gap-1.5 overflow-x-auto border-b px-4 py-3">
                        {[
                            {
                                key: 'all',
                                name: t('admin.filters.allCategories'),
                                name_bn: t('admin.filters.allCategories'),
                            },
                            ...categories,
                        ].map((c) => (
                            <button
                                key={c.key}
                                type="button"
                                onClick={() => setCategory(c.key)}
                                className={cn(
                                    'shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors',
                                    category === c.key
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'bg-card text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {name(c)}
                            </button>
                        ))}
                    </div>
                    <FilterBar>
                        <SearchInput
                            className="sm:w-80"
                            value={search}
                            onChange={setSearch}
                            placeholder={t('products.search')}
                        />
                        <p className="text-xs text-muted-foreground sm:ml-auto">
                            {t('products.syncNote')}
                        </p>
                    </FilterBar>
                    <DataTable
                        columns={columns}
                        rows={paged.rows}
                        rowKey={(p) => p.id}
                        minWidth={1020}
                    />
                    <TableFooter paged={paged} />
                </Panel>
            </PageBody>

            {editing && (
                <ProductDialog
                    product={editing === 'new' ? null : editing}
                    onClose={() => setEditing(null)}
                />
            )}
        </>
    );
}

function ProductDialog({
    product,
    onClose,
}: {
    product: Product | null;
    onClose: () => void;
}) {
    const { t, name } = useAdmin();
    const { products, categories } = useAdminData();
    const [form, setForm] = useState({
        name: product?.name ?? '',
        name_bn: product?.name_bn ?? '',
        sku: product?.sku ?? '',
        brand: product?.brand ?? '',
        category: product?.category ?? categories[0].key,
        packSize: String(product?.packSize ?? 24),
        mrp: String(product?.mrp ?? ''),
        price: String(product?.price ?? ''),
        reorderAt: String(product?.reorderAt ?? 240),
    });
    const [touched, setTouched] = useState(false);
    const set = (key: keyof typeof form) => (value: string) =>
        setForm((prev) => ({ ...prev, [key]: value }));
    const skuTaken = products.some(
        (p) =>
            p.sku.toLowerCase() === form.sku.trim().toLowerCase() &&
            p.id !== product?.id,
    );
    const price = Number(form.price);
    const mrp = Number(form.mrp);
    const errors = {
        name: !form.name.trim() ? t('admin.form.required') : undefined,
        sku: !form.sku.trim()
            ? t('admin.form.required')
            : skuTaken
              ? t('products.form.skuTaken')
              : undefined,
        price: !(price > 0)
            ? t('admin.form.positive')
            : mrp > 0 && price > mrp
              ? t('products.form.overMrp')
              : undefined,
        packSize: !(Number(form.packSize) > 0)
            ? t('admin.form.positive')
            : undefined,
    };

    return (
        <FormDialog
            open
            onOpenChange={(o) => !o && onClose()}
            wide
            title={
                product
                    ? t('products.form.editTitle')
                    : t('products.form.addTitle')
            }
            description={t('products.syncNote')}
            submitLabel={product ? t('admin.actions.save') : t('products.add')}
            onSubmit={() => {
                setTouched(true);

                if (Object.values(errors).some(Boolean)) {
                    return false;
                }

                saveProduct(product?.id ?? null, {
                    name: form.name.trim(),
                    name_bn: form.name_bn.trim() || form.name.trim(),
                    sku: form.sku.trim().toUpperCase(),
                    brand: form.brand.trim(),
                    category: form.category,
                    packSize: Number(form.packSize),
                    mrp: mrp || price,
                    price,
                    reorderAt: Number(form.reorderAt) || 0,
                });
                toast.success(
                    t(
                        product
                            ? 'products.toast.updated'
                            : 'products.toast.added',
                        { name: form.name.trim() },
                    ),
                );
            }}
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Field
                    label={t('products.form.name')}
                    error={touched ? errors.name : undefined}
                >
                    <TextInput
                        value={form.name}
                        onChange={set('name')}
                        autoFocus
                    />
                </Field>
                <Field label={t('products.form.nameBn')}>
                    <TextInput value={form.name_bn} onChange={set('name_bn')} />
                </Field>
                <Field label="SKU" error={touched ? errors.sku : undefined}>
                    <TextInput value={form.sku} onChange={set('sku')} />
                </Field>
                <Field label={t('products.form.brand')}>
                    <TextInput value={form.brand} onChange={set('brand')} />
                </Field>
                <Field label={t('products.columns.category')}>
                    <SelectField
                        value={form.category}
                        onChange={set('category')}
                        label={t('products.columns.category')}
                        options={categories.map((c) => ({
                            value: c.key,
                            label: name(c),
                        }))}
                    />
                </Field>
                <Field
                    label={t('products.form.packSize')}
                    help={t('products.form.packHelp')}
                    error={touched ? errors.packSize : undefined}
                >
                    <TextInput
                        type="number"
                        value={form.packSize}
                        onChange={set('packSize')}
                        min={1}
                        inputMode="numeric"
                    />
                </Field>
                <Field label={t('products.form.mrp')}>
                    <TextInput
                        type="number"
                        value={form.mrp}
                        onChange={set('mrp')}
                        min={0}
                        step="any"
                        inputMode="decimal"
                    />
                </Field>
                <Field
                    label={t('products.form.price')}
                    help={t('products.form.priceHelp')}
                    error={touched ? errors.price : undefined}
                >
                    <TextInput
                        type="number"
                        value={form.price}
                        onChange={set('price')}
                        min={0}
                        step="any"
                        inputMode="decimal"
                    />
                </Field>
                <Field
                    label={t('products.form.reorder')}
                    help={t('products.form.reorderHelp')}
                >
                    <TextInput
                        type="number"
                        value={form.reorderAt}
                        onChange={set('reorderAt')}
                        min={0}
                        inputMode="numeric"
                    />
                </Field>
            </div>
        </FormDialog>
    );
}

ProductsIndex.layout = {
    breadcrumbs: [{ title: 'nav.products', href: productsIndex() }],
};
