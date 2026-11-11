import { Head } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowLeftRight,
    ArrowUpRight,
    Boxes,
    PackageX,
    SlidersHorizontal,
    TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { MiniStat, Stack, Thumb } from '@/components/admin/bits';
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
import { Tabs } from '@/components/admin/tabs';
import { Meter, Panel, PanelHeader } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import type { Product } from '@/data/admin/catalog';
import { adjustStock, transferStock, useAdminData } from '@/data/admin/store';
import { useAdmin } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';
import { index as stockIndex } from '@/routes/stock';

type Level = 'ok' | 'low' | 'out';

export default function StockIndex() {
    const { t, f, name, qty, ago } = useAdmin();
    const { products, stock, movements, warehouses } = useAdminData();
    const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
    const [adjusting, setAdjusting] = useState<Product | 'any' | null>(null);
    const [transferOpen, setTransferOpen] = useState(false);
    const wh = warehouses.find((w) => w.id === warehouseId) ?? warehouses[0];
    const level = (p: Product) =>
        stock[wh.id]?.[p.id] ?? { onHand: 0, reserved: 0 };
    const available = (p: Product) => level(p).onHand - level(p).reserved;
    const status = (p: Product): Level =>
        level(p).onHand <= 0
            ? 'out'
            : wh.type === 'main' && available(p) < p.reorderAt
              ? 'low'
              : 'ok';
    const rows = products.filter((p) => p.active || level(p).onHand > 0);
    const paged = usePaged(rows);
    const low = rows.filter((p) => status(p) === 'low').length;
    const out = rows.filter((p) => status(p) === 'out').length;
    const value = rows.reduce((s, p) => s + level(p).onHand * p.price, 0);

    const columns: Column<Product>[] = [
        {
            key: 'product',
            header: t('stock.columns.product'),
            cell: (p) => (
                <div className="flex items-center gap-3">
                    <Thumb label={name(p)} hue={p.hue} />
                    <Stack main={name(p)} sub={p.sku} />
                </div>
            ),
        },
        {
            key: 'onHand',
            header: t('stock.columns.onHand'),
            cell: (p) => (
                <span className="whitespace-nowrap">
                    {qty(level(p).onHand, p.packSize)}
                </span>
            ),
        },
        {
            key: 'reserved',
            header: t('stock.columns.reserved'),
            cell: (p) => (
                <span className="whitespace-nowrap text-muted-foreground">
                    {qty(level(p).reserved, p.packSize)}
                </span>
            ),
        },
        {
            key: 'available',
            header: t('stock.columns.available'),
            className: 'w-48',
            cell: (p) => {
                const lv = status(p);

                return (
                    <div className="flex flex-col gap-1">
                        <span
                            className={cn(
                                'text-sm font-medium whitespace-nowrap',
                                lv === 'low' && 'text-warning-ink',
                                lv === 'out' && 'text-danger-ink',
                            )}
                        >
                            {qty(Math.max(0, available(p)), p.packSize)}
                        </span>
                        {wh.type === 'main' && (
                            <Meter
                                value={Math.max(0, available(p))}
                                max={p.reorderAt * 3}
                                tone={
                                    lv === 'ok'
                                        ? 'primary'
                                        : lv === 'low'
                                          ? 'warning'
                                          : 'danger'
                                }
                                label={t('stock.columns.available')}
                            />
                        )}
                    </div>
                );
            },
        },
        {
            key: 'status',
            header: t('stock.columns.status'),
            cell: (p) => (
                <StatusBadge
                    tone={
                        status(p) === 'ok'
                            ? 'success'
                            : status(p) === 'low'
                              ? 'warning'
                              : 'danger'
                    }
                    label={t(`stock.level.${status(p)}`)}
                />
            ),
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (p) => (
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAdjusting(p)}
                >
                    <SlidersHorizontal className="size-3.5" />
                    {t('stock.adjust')}
                </Button>
            ),
        },
    ];

    const moveIcon = {
        purchase: ArrowDownLeft,
        return: ArrowDownLeft,
        deliver: ArrowUpRight,
        reserve: ArrowUpRight,
        adjust: SlidersHorizontal,
        transfer: ArrowLeftRight,
    };
    const warehouseName = (id?: string) => {
        const w = warehouses.find((x) => x.id === id);

        return w ? name(w) : '';
    };

    return (
        <>
            <Head title={t('stock.title')} />
            <PageBody>
                <PageHeader
                    title={t('stock.title')}
                    description={t('stock.description')}
                    actions={
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-card"
                                onClick={() => setTransferOpen(true)}
                            >
                                <ArrowLeftRight className="size-3.5" />
                                {t('stock.transfer')}
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => setAdjusting('any')}
                            >
                                <SlidersHorizontal className="size-3.5" />
                                {t('stock.adjust')}
                            </Button>
                        </>
                    }
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <MiniStat
                        icon={Boxes}
                        label={t('stock.stats.value')}
                        value={f.taka(value)}
                        note={name(wh)}
                    />
                    <MiniStat
                        icon={TriangleAlert}
                        label={t('stock.stats.low')}
                        value={f.num(low)}
                        note={t('stock.stats.lowNote')}
                        tone="warning"
                    />
                    <MiniStat
                        icon={PackageX}
                        label={t('stock.stats.out')}
                        value={f.num(out)}
                        tone="danger"
                    />
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <Panel className="xl:col-span-2">
                        <Tabs
                            className="px-2"
                            value={warehouseId}
                            onChange={setWarehouseId}
                            items={warehouses.map((w) => ({
                                value: w.id,
                                label: name(w),
                            }))}
                        />
                        <p className="border-b px-4 py-2.5 text-xs text-muted-foreground">
                            {t('stock.help')}
                        </p>
                        <DataTable
                            columns={columns}
                            rows={paged.rows}
                            rowKey={(p) => p.id}
                            minWidth={820}
                        />
                        <TableFooter paged={paged} />
                    </Panel>

                    <Panel>
                        <PanelHeader
                            title={t('stock.movementsTitle')}
                            subtitle={t('stock.movementsSubtitle')}
                        />
                        <ul className="divide-y">
                            {movements.slice(0, 10).map((m) => {
                                const p =
                                    products.find(
                                        (x) => x.id === m.productId,
                                    ) ?? products[0];
                                const Icon = moveIcon[m.type];

                                return (
                                    <li
                                        key={m.id}
                                        className="flex items-center gap-3 px-4 py-2.5"
                                    >
                                        <span
                                            className={cn(
                                                'flex size-8 shrink-0 items-center justify-center rounded-md',
                                                m.qty > 0
                                                    ? 'bg-success-soft text-success-ink'
                                                    : 'bg-muted text-muted-foreground',
                                            )}
                                        >
                                            <Icon
                                                className="size-4"
                                                aria-hidden
                                            />
                                        </span>
                                        <Stack
                                            main={name(p)}
                                            sub={`${t(`stock.move.${m.type}`)} · ${m.reference} · ${warehouseName(m.warehouseId)} · ${ago(m.minutesAgo)}`}
                                        />
                                        <span
                                            className={cn(
                                                'ml-auto text-right text-sm font-medium whitespace-nowrap tabular-nums',
                                                m.qty > 0
                                                    ? 'text-success-ink'
                                                    : 'text-foreground',
                                            )}
                                        >
                                            {m.qty > 0 ? '+' : '−'}
                                            {qty(Math.abs(m.qty), p.packSize)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </Panel>
                </div>
            </PageBody>

            {adjusting && (
                <AdjustDialog
                    product={adjusting === 'any' ? null : adjusting}
                    warehouseId={warehouseId}
                    onClose={() => setAdjusting(null)}
                />
            )}
            {transferOpen && (
                <TransferDialog onClose={() => setTransferOpen(false)} />
            )}
        </>
    );
}

/** Cartons + loose pieces → base units. */
function QtyFields({
    ctn,
    pcs,
    setCtn,
    setPcs,
}: {
    ctn: string;
    pcs: string;
    setCtn: (v: string) => void;
    setPcs: (v: string) => void;
}) {
    const { t } = useAdmin();

    return (
        <div className="grid grid-cols-2 gap-3">
            <Field label={t('stock.form.cartons')}>
                <TextInput
                    type="number"
                    value={ctn}
                    onChange={setCtn}
                    min={0}
                    inputMode="numeric"
                />
            </Field>
            <Field label={t('stock.form.pieces')}>
                <TextInput
                    type="number"
                    value={pcs}
                    onChange={setPcs}
                    min={0}
                    inputMode="numeric"
                />
            </Field>
        </div>
    );
}

function AdjustDialog({
    product,
    warehouseId,
    onClose,
}: {
    product: Product | null;
    warehouseId: string;
    onClose: () => void;
}) {
    const { t, name, qty } = useAdmin();
    const { products, stock, warehouses } = useAdminData();
    const [productId, setProductId] = useState(product?.id ?? products[0].id);
    const [wh, setWh] = useState(warehouseId);
    const [direction, setDirection] = useState<'in' | 'out'>('in');
    const [ctn, setCtn] = useState('0');
    const [pcs, setPcs] = useState('0');
    const [reason, setReason] = useState('purchase');
    const p = products.find((x) => x.id === productId) ?? products[0];
    const amount = (Number(ctn) || 0) * p.packSize + (Number(pcs) || 0);
    const onHand = stock[wh]?.[p.id]?.onHand ?? 0;
    const tooMuch = direction === 'out' && amount > onHand;

    return (
        <FormDialog
            open
            onOpenChange={(o) => !o && onClose()}
            title={t('stock.form.adjustTitle')}
            description={t('stock.help')}
            submitLabel={t('stock.adjust')}
            disabled={amount <= 0 || tooMuch}
            onSubmit={() => {
                adjustStock(
                    wh,
                    p.id,
                    direction === 'in' ? amount : -amount,
                    t(`stock.reason.${reason}`),
                );
                toast.success(
                    t('stock.toast.adjusted', {
                        product: name(p),
                        qty: `${direction === 'in' ? '+' : '−'}${qty(amount, p.packSize)}`,
                    }),
                );
            }}
        >
            <div className="grid grid-cols-2 gap-3">
                <Field label={t('stock.columns.product')}>
                    <SelectField
                        value={productId}
                        onChange={setProductId}
                        label={t('stock.columns.product')}
                        options={products.map((x) => ({
                            value: x.id,
                            label: name(x),
                        }))}
                    />
                </Field>
                <Field label={t('stock.form.warehouse')}>
                    <SelectField
                        value={wh}
                        onChange={setWh}
                        label={t('stock.form.warehouse')}
                        options={warehouses.map((w) => ({
                            value: w.id,
                            label: name(w),
                        }))}
                    />
                </Field>
            </div>
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {(['in', 'out'] as const).map((d) => (
                    <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={direction === d}
                        onClick={() => {
                            setDirection(d);
                            setReason(d === 'in' ? 'purchase' : 'damaged');
                        }}
                        className={cn(
                            'rounded-md border px-3 py-2 text-sm font-medium',
                            direction === d
                                ? 'border-primary bg-accent text-accent-foreground'
                                : 'text-muted-foreground',
                        )}
                    >
                        {t(`stock.form.${d}`)}
                    </button>
                ))}
            </div>
            <QtyFields ctn={ctn} pcs={pcs} setCtn={setCtn} setPcs={setPcs} />
            <Field label={t('stock.form.reason')}>
                <SelectField
                    value={reason}
                    onChange={setReason}
                    label={t('stock.form.reason')}
                    options={(direction === 'in'
                        ? ['purchase', 'opening', 'count']
                        : ['damaged', 'expired', 'count']
                    ).map((r) => ({ value: r, label: t(`stock.reason.${r}`) }))}
                />
            </Field>
            <p
                className={cn(
                    'text-xs',
                    tooMuch ? 'text-danger-ink' : 'text-muted-foreground',
                )}
            >
                {t('stock.form.onHand', { qty: qty(onHand, p.packSize) })}
            </p>
        </FormDialog>
    );
}

function TransferDialog({ onClose }: { onClose: () => void }) {
    const { t, name, qty } = useAdmin();
    const { products, stock, warehouses } = useAdminData();
    const [from, setFrom] = useState(warehouses[0]?.id ?? '');
    const [to, setTo] = useState(warehouses[1]?.id ?? '');
    const [productId, setProductId] = useState(products[0].id);
    const [ctn, setCtn] = useState('1');
    const [pcs, setPcs] = useState('0');
    const p = products.find((x) => x.id === productId) ?? products[0];
    const amount = (Number(ctn) || 0) * p.packSize + (Number(pcs) || 0);
    const level = stock[from]?.[p.id] ?? { onHand: 0, reserved: 0 };
    const free = level.onHand - level.reserved;
    const tooMuch = amount > free;

    return (
        <FormDialog
            open
            onOpenChange={(o) => !o && onClose()}
            title={t('stock.form.transferTitle')}
            description={t('stock.form.transferDescription')}
            submitLabel={t('stock.transfer')}
            disabled={amount <= 0 || from === to || tooMuch}
            onSubmit={() => {
                transferStock(from, to, p.id, amount);
                toast.success(
                    t('stock.toast.transferred', {
                        product: name(p),
                        qty: qty(amount, p.packSize),
                    }),
                );
            }}
        >
            <div className="grid grid-cols-2 gap-3">
                <Field label={t('stock.form.from')}>
                    <SelectField
                        value={from}
                        onChange={setFrom}
                        label={t('stock.form.from')}
                        options={warehouses.map((w) => ({
                            value: w.id,
                            label: name(w),
                        }))}
                    />
                </Field>
                <Field
                    label={t('stock.form.to')}
                    error={from === to ? t('stock.form.same') : undefined}
                >
                    <SelectField
                        value={to}
                        onChange={setTo}
                        label={t('stock.form.to')}
                        options={warehouses.map((w) => ({
                            value: w.id,
                            label: name(w),
                        }))}
                    />
                </Field>
            </div>
            <Field label={t('stock.columns.product')}>
                <SelectField
                    value={productId}
                    onChange={setProductId}
                    label={t('stock.columns.product')}
                    options={products.map((x) => ({
                        value: x.id,
                        label: name(x),
                    }))}
                />
            </Field>
            <QtyFields ctn={ctn} pcs={pcs} setCtn={setCtn} setPcs={setPcs} />
            <p
                className={cn(
                    'text-xs',
                    tooMuch ? 'text-danger-ink' : 'text-muted-foreground',
                )}
            >
                {t('stock.form.free', {
                    qty: qty(Math.max(0, free), p.packSize),
                })}
            </p>
        </FormDialog>
    );
}

StockIndex.layout = {
    breadcrumbs: [{ title: 'nav.stock', href: stockIndex() }],
};
