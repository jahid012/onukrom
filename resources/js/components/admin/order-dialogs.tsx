import { Link } from '@inertiajs/react';
import { Printer } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Stack } from '@/components/admin/bits';
import { ConfirmDialog, FormDialog } from '@/components/admin/dialogs';
import { StatusBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
    assignToTrip,
    linesForOrder,
    rejectOrders,
    useAdminData,
} from '@/data/admin/store';
import type { Order } from '@/data/admin/sales';
import { staffByCode } from '@/data/admin/store';
import { useAdmin } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';
import { index as deliveriesIndex } from '@/routes/deliveries';

/** Reject one or more pending orders — a reason is required. */
export function RejectOrdersDialog({
    numbers,
    onOpenChange,
    onDone,
}: {
    numbers: string[];
    onOpenChange: (open: boolean) => void;
    onDone?: () => void;
}) {
    const { t, f } = useAdmin();

    return (
        <ConfirmDialog
            open={numbers.length > 0}
            onOpenChange={onOpenChange}
            title={t('orders.reject.title', { n: f.num(numbers.length) })}
            description={t('orders.reject.description')}
            confirmLabel={t('admin.actions.reject')}
            destructive
            reasonLabel={t('orders.reject.reason')}
            reasonOptions={[
                t('orders.reject.r1'),
                t('orders.reject.r2'),
                t('orders.reject.r3'),
            ]}
            onConfirm={(reason) => {
                rejectOrders(numbers, reason);
                toast.success(
                    t('orders.toast.rejected', { n: f.num(numbers.length) }),
                );
                onDone?.();
            }}
        />
    );
}

/** Put approved orders on a planned or loaded trip. */
export function AssignTripDialog({
    numbers,
    onOpenChange,
    onDone,
}: {
    numbers: string[];
    onOpenChange: (open: boolean) => void;
    onDone?: () => void;
}) {
    const { t, f } = useAdmin();
    const { trips } = useAdminData();
    const open = trips.filter(
        (x) => x.status === 'planned' || x.status === 'loaded',
    );
    const [trip, setTrip] = useState('');
    const chosen = trip || open[0]?.number || '';

    return (
        <FormDialog
            open={numbers.length > 0}
            onOpenChange={onOpenChange}
            title={t('orders.assign.title', { n: f.num(numbers.length) })}
            description={t('orders.assign.description')}
            submitLabel={t('admin.actions.assignTrip')}
            disabled={!chosen}
            onSubmit={() => {
                assignToTrip(numbers, chosen);
                toast.success(
                    t('orders.toast.assigned', {
                        n: f.num(numbers.length),
                        trip: chosen,
                    }),
                );
                onDone?.();
            }}
        >
            {open.length === 0 ? (
                <p className="rounded-md bg-muted px-3 py-3 text-sm text-muted-foreground">
                    {t('orders.assign.none')}{' '}
                    <Link
                        href={deliveriesIndex()}
                        className="font-medium text-foreground underline underline-offset-4"
                    >
                        {t('orders.assign.createTrip')}
                    </Link>
                </p>
            ) : (
                <div className="grid gap-2" role="radiogroup">
                    {open.map((x) => (
                        <button
                            key={x.number}
                            type="button"
                            role="radio"
                            aria-checked={chosen === x.number}
                            onClick={() => setTrip(x.number)}
                            className={cn(
                                'flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left',
                                chosen === x.number
                                    ? 'border-primary ring-1 ring-primary'
                                    : 'hover:border-ring/50',
                            )}
                        >
                            <Stack
                                main={
                                    <span className="font-medium">
                                        {x.number} · {x.route}
                                    </span>
                                }
                                sub={`${staffByCode(x.dm).name} · ${t('orders.assign.tripOrders', { n: f.num(x.orders) })}`}
                            />
                            <StatusBadge
                                tone={
                                    x.status === 'planned' ? 'neutral' : 'info'
                                }
                                label={t(`deliveries.status.${x.status}`)}
                            />
                        </button>
                    ))}
                </div>
            )}
        </FormDialog>
    );
}

/** Printable invoice (company name/address as text, no logo — spec §11). */
export function InvoiceDialog({
    order,
    open,
    onOpenChange,
}: {
    order: Order;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { t, f, name, qty } = useAdmin();
    const { settings, shops } = useAdminData();
    const shop = shops.find((s) => s.id === order.shopId) ?? shops[0];
    const lines = linesForOrder(order);
    const total = lines.reduce((s, l) => s + l.total, 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
                <DialogTitle className="sr-only">
                    {t('orders.invoice.title')}
                </DialogTitle>
                <div className="print-area grid gap-4 bg-card text-sm">
                    <div className="flex items-start justify-between gap-4 border-b pr-6 pb-3">
                        <div>
                            <p className="text-lg font-semibold">
                                {settings.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {settings.address}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {settings.phone}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="font-semibold">
                                {t('orders.invoice.title')}
                            </p>
                            <p className="text-xs">{order.number}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Stack
                            main={
                                <span className="font-medium">
                                    {name(shop)}
                                </span>
                            }
                            sub={`${shop.owner} · ${shop.phone}`}
                        />
                        <p className="text-right text-xs text-muted-foreground">
                            {t('orders.invoice.sr')}:{' '}
                            {staffByCode(order.sr).name}
                        </p>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="border-y text-xs text-muted-foreground">
                            <tr>
                                <th className="py-1.5 text-left font-medium">
                                    {t('orders.detail.product')}
                                </th>
                                <th className="py-1.5 text-left font-medium">
                                    {t('orders.detail.qty')}
                                </th>
                                <th className="py-1.5 text-right font-medium">
                                    {t('orders.detail.unitPrice')}
                                </th>
                                <th className="py-1.5 text-right font-medium">
                                    {t('orders.detail.lineTotal')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {lines.map((l) => (
                                <tr key={l.product.id}>
                                    <td className="py-1.5">
                                        {name(l.product)}
                                    </td>
                                    <td className="py-1.5">
                                        {qty(l.qty, l.product.packSize)}
                                    </td>
                                    <td className="py-1.5 text-right tabular-nums">
                                        {f.taka(l.unitPrice)}
                                    </td>
                                    <td className="py-1.5 text-right tabular-nums">
                                        {f.taka(l.total)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="border-t pt-2 text-right text-base font-semibold tabular-nums">
                        {t('orders.detail.total')}: {f.taka(total)}
                    </p>
                    <p className="text-center text-xs text-muted-foreground">
                        {t('orders.invoice.thanks')}
                    </p>
                </div>
                <div className="no-print flex justify-end gap-2">
                    <Button
                        variant="secondary"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('common.close')}
                    </Button>
                    <Button onClick={() => window.print()}>
                        <Printer className="size-3.5" />
                        {t('admin.actions.print')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
