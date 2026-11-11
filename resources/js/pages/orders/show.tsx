import { Head, Link, setLayoutProps } from '@inertiajs/react';
import {
    ArrowLeft,
    Ban,
    Check,
    CloudUpload,
    Phone,
    Printer,
    RotateCcw,
    ShieldCheck,
    Smartphone,
    Truck,
    TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { KeyValues, Person, Stack, Thumb } from '@/components/admin/bits';
import { MapLegend, MapPreview } from '@/components/admin/map-preview';
import { hasMapbox, MapboxStatic } from '@/components/admin/mapbox-static';
import {
    AssignTripDialog,
    InvoiceDialog,
    RejectOrdersDialog,
} from '@/components/admin/order-dialogs';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { Meter, Panel, PanelHeader } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import {
    approveOrders,
    linesForOrder,
    rescheduleOrder,
    useAdminData,
} from '@/data/admin/store';
import { staffByCode } from '@/data/admin/store';
import { useAdmin } from '@/hooks/use-admin';
import { locationFlags, orderTone } from '@/lib/order-status';
import { cn } from '@/lib/utils';
import { index as ordersIndex } from '@/routes/orders';
import { index as shopsIndex } from '@/routes/shops';

export default function OrderShow({ number }: { number: string }) {
    const { t, f, name, ago, qty } = useAdmin();
    const { orders, shops } = useAdminData();
    const [rejecting, setRejecting] = useState<string[]>([]);
    const [assigning, setAssigning] = useState<string[]>([]);
    const [invoiceOpen, setInvoiceOpen] = useState(false);

    setLayoutProps({
        breadcrumbs: [
            { title: 'nav.orders', href: ordersIndex() },
            { title: number, href: ordersIndex() },
        ],
    });

    const order = orders.find((o) => o.number === number);

    if (!order) {
        return (
            <PageBody>
                <Head title={number} />
                <Panel className="items-center gap-3 p-10 text-center">
                    <p className="font-medium">
                        {t('orders.detail.notFound', { number })}
                    </p>
                    <Button variant="outline" asChild>
                        <Link href={ordersIndex()}>
                            <ArrowLeft className="size-3.5" />
                            {t('orders.detail.back')}
                        </Link>
                    </Button>
                </Panel>
            </PageBody>
        );
    }

    const shop = shops.find((s) => s.id === order.shopId) ?? shops[0];
    const sr = staffByCode(order.sr);
    const lines = linesForOrder(order);
    const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    const discount = lines.reduce((s, l) => s + l.discount, 0);
    const total = subtotal - discount;
    const paid = order.status === 'delivered' ? total : 0;
    const hasIssue = order.flags.some((fl) => locationFlags.includes(fl));
    const meters = (n: number) => t('orders.meters', { n: f.num(n) });
    const decided = !['pending'].includes(order.status);
    const closed = ['rejected', 'cancelled'].includes(order.status);

    return (
        <>
            <Head title={t('orders.detail.title', { number: order.number })} />
            <PageBody>
                <PageHeader
                    title={t('orders.detail.title', { number: order.number })}
                    description={t('orders.detail.meta', {
                        time: ago(order.minutesAgo),
                        sr: `${sr.name} (${sr.code})`,
                    })}
                    actions={
                        <>
                            <StatusBadge
                                tone={orderTone[order.status]}
                                label={t(`admin.orderStatus.${order.status}`)}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-card"
                                onClick={() => setInvoiceOpen(true)}
                            >
                                <Printer className="size-3.5" />
                                {t('orders.detail.printInvoice')}
                            </Button>
                            {order.status === 'pending' && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-card text-danger-ink"
                                        onClick={() =>
                                            setRejecting([order.number])
                                        }
                                    >
                                        <Ban className="size-3.5" />
                                        {t('admin.actions.reject')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            approveOrders([order.number]);
                                            toast.success(
                                                t('orders.toast.approved', {
                                                    n: f.num(1),
                                                }),
                                            );
                                        }}
                                    >
                                        <Check className="size-3.5" />
                                        {t('orders.detail.approve')}
                                    </Button>
                                </>
                            )}
                            {order.status === 'approved' && (
                                <Button
                                    size="sm"
                                    onClick={() => setAssigning([order.number])}
                                >
                                    <Truck className="size-3.5" />
                                    {t('admin.actions.assignTrip')}
                                </Button>
                            )}
                            {order.status === 'failed' && (
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        rescheduleOrder(order.number);
                                        toast.success(
                                            t('orders.toast.rescheduled', {
                                                order: order.number,
                                            }),
                                        );
                                    }}
                                >
                                    <RotateCcw className="size-3.5" />
                                    {t('orders.reschedule')}
                                </Button>
                            )}
                        </>
                    }
                />

                {order.status === 'rejected' && order.rejectReason && (
                    <div className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
                        <span className="font-medium">
                            {t('orders.detail.rejectedBecause')}
                        </span>{' '}
                        {order.rejectReason}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
                        <Panel>
                            <PanelHeader
                                title={t('orders.detail.items')}
                                subtitle={t('orders.itemsCount', {
                                    n: f.num(lines.length),
                                })}
                            />
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[620px] text-sm">
                                    <thead className="border-b bg-background text-xs text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium">
                                                {t('orders.detail.product')}
                                            </th>
                                            <th className="px-4 py-2 text-left font-medium">
                                                {t('orders.detail.qty')}
                                            </th>
                                            <th className="px-4 py-2 text-right font-medium">
                                                {t('orders.detail.unitPrice')}
                                            </th>
                                            <th className="px-4 py-2 text-right font-medium">
                                                {t('orders.detail.discount')}
                                            </th>
                                            <th className="px-4 py-2 text-right font-medium">
                                                {t('orders.detail.lineTotal')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {lines.map((l) => (
                                            <tr key={l.product.id}>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-3">
                                                        <Thumb
                                                            label={name(
                                                                l.product,
                                                            )}
                                                            hue={l.product.hue}
                                                        />
                                                        <Stack
                                                            main={name(
                                                                l.product,
                                                            )}
                                                            sub={l.product.sku}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap">
                                                    {qty(
                                                        l.qty,
                                                        l.product.packSize,
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums">
                                                    {f.taka(l.unitPrice)}
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                                                    {l.discount
                                                        ? `− ${f.taka(l.discount)}`
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                                                    {f.taka(l.total)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <dl className="ml-auto w-full max-w-xs space-y-1.5 border-t px-4 py-3 text-sm">
                                <Sum
                                    label={t('orders.detail.subtotal')}
                                    value={f.taka(subtotal)}
                                />
                                <Sum
                                    label={t('orders.detail.discount')}
                                    value={
                                        discount
                                            ? `− ${f.taka(discount)}`
                                            : f.taka(0)
                                    }
                                />
                                <Sum
                                    label={t('orders.detail.total')}
                                    value={f.taka(total)}
                                    strong
                                />
                                <Sum
                                    label={t('orders.detail.paid')}
                                    value={f.taka(paid)}
                                />
                                <Sum
                                    label={t('orders.detail.due')}
                                    value={f.taka(total - paid)}
                                />
                            </dl>
                        </Panel>

                        <Panel>
                            <PanelHeader title={t('orders.detail.timeline')} />
                            <ol className="flex flex-col px-4 py-3">
                                <Event
                                    icon={Smartphone}
                                    title={t('orders.detail.events.created')}
                                    sub={`${ago(order.minutesAgo)} · ${sr.name}`}
                                    done
                                />
                                <Event
                                    icon={CloudUpload}
                                    title={t('orders.detail.events.synced')}
                                    sub={ago(Math.max(order.minutesAgo - 1, 0))}
                                    done
                                />
                                {hasIssue && (
                                    <Event
                                        icon={TriangleAlert}
                                        title={t(
                                            'orders.detail.events.flagged',
                                        )}
                                        sub={order.flags
                                            .map((fl) =>
                                                t(`admin.orderFlag.${fl}`),
                                            )
                                            .join(' · ')}
                                        tone="warning"
                                        done
                                    />
                                )}
                                {closed ? (
                                    <Event
                                        icon={Ban}
                                        title={t(
                                            `admin.orderStatus.${order.status}`,
                                        )}
                                        sub={order.rejectReason ?? undefined}
                                        tone="danger"
                                        done
                                        last
                                    />
                                ) : (
                                    <>
                                        <Event
                                            icon={ShieldCheck}
                                            title={
                                                decided
                                                    ? t(
                                                          'orders.detail.events.approved',
                                                      )
                                                    : t(
                                                          'orders.detail.events.waiting',
                                                      )
                                            }
                                            done={decided}
                                        />
                                        <Event
                                            icon={Truck}
                                            title={
                                                order.trip
                                                    ? t(
                                                          'orders.detail.events.onTrip',
                                                          { trip: order.trip },
                                                      )
                                                    : t(
                                                          'orders.detail.events.delivery',
                                                      )
                                            }
                                            sub={
                                                order.status === 'failed'
                                                    ? t(
                                                          'admin.orderStatus.failed',
                                                      )
                                                    : undefined
                                            }
                                            tone={
                                                order.status === 'failed'
                                                    ? 'danger'
                                                    : undefined
                                            }
                                            done={[
                                                'dispatched',
                                                'delivered',
                                                'partially_delivered',
                                                'failed',
                                            ].includes(order.status)}
                                        />
                                        <Event
                                            icon={Check}
                                            title={t(
                                                'orders.detail.events.deliveredStep',
                                            )}
                                            done={[
                                                'delivered',
                                                'partially_delivered',
                                            ].includes(order.status)}
                                            last
                                        />
                                    </>
                                )}
                            </ol>
                        </Panel>
                    </div>

                    <div className="flex min-w-0 flex-col gap-4">
                        <Panel>
                            <PanelHeader
                                title={t('orders.detail.location')}
                                subtitle={t('orders.detail.locationHelp')}
                                action={
                                    hasIssue ? (
                                        <StatusBadge
                                            tone="warning"
                                            label={t(
                                                'orders.detail.needsReview',
                                            )}
                                        />
                                    ) : (
                                        <StatusBadge
                                            tone="success"
                                            label={t(
                                                'orders.detail.locationOk',
                                            )}
                                        />
                                    )
                                }
                            />
                            {order.flags.includes('no_location') ? (
                                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                                    {t('admin.orderFlag.no_location')}
                                </p>
                            ) : (
                                <>
                                    {hasMapbox &&
                                    order.lat !== null &&
                                    order.lng !== null ? (
                                        <MapboxStatic
                                            className="aspect-[5/3] border-b"
                                            caption={t('admin.map.caption')}
                                            points={[
                                                ...(order.shopLat !== null &&
                                                order.shopLng !== null
                                                    ? [
                                                          {
                                                              lat: order.shopLat,
                                                              lng: order.shopLng,
                                                              color: '2a78d6',
                                                          },
                                                      ]
                                                    : []),
                                                {
                                                    lat: order.lat,
                                                    lng: order.lng,
                                                    color: '0a8a6c',
                                                },
                                            ]}
                                        />
                                    ) : (
                                        <MapPreview
                                            className="aspect-[5/3] border-b"
                                            caption={t('admin.map.caption')}
                                            trail={[
                                                { x: 38, y: 44 },
                                                { x: 41, y: 47 },
                                                { x: 44, y: 46 },
                                                { x: 46, y: 50 },
                                            ]}
                                            pins={[
                                                {
                                                    x: order.flags.includes(
                                                        'far_from_shop',
                                                    )
                                                        ? 78
                                                        : 47,
                                                    y: order.flags.includes(
                                                        'far_from_shop',
                                                    )
                                                        ? 22
                                                        : 51,
                                                    kind: 'order',
                                                    accuracy: Math.min(
                                                        40,
                                                        Math.max(
                                                            10,
                                                            order.accuracyM / 2,
                                                        ),
                                                    ),
                                                },
                                                {
                                                    x: 44,
                                                    y: 54,
                                                    kind: 'shop',
                                                    label: name(shop),
                                                },
                                            ]}
                                        />
                                    )}
                                    <div className="px-4 pt-3">
                                        <MapLegend
                                            items={[
                                                {
                                                    kind: 'order',
                                                    label: t('admin.map.order'),
                                                },
                                                {
                                                    kind: 'shop',
                                                    label: t('admin.map.shop'),
                                                },
                                                {
                                                    kind: 'staff',
                                                    label: t('admin.map.trail'),
                                                },
                                            ]}
                                        />
                                    </div>
                                    <KeyValues
                                        items={[
                                            {
                                                label: t(
                                                    'orders.detail.distance',
                                                ),
                                                value: (
                                                    <span
                                                        className={cn(
                                                            order.flags.includes(
                                                                'far_from_shop',
                                                            ) &&
                                                                'text-warning-ink',
                                                        )}
                                                    >
                                                        {meters(
                                                            order.distanceM,
                                                        )}
                                                    </span>
                                                ),
                                            },
                                            {
                                                label: t(
                                                    'orders.detail.accuracy',
                                                ),
                                                value: (
                                                    <span
                                                        className={cn(
                                                            order.flags.includes(
                                                                'low_accuracy',
                                                            ) &&
                                                                'text-warning-ink',
                                                        )}
                                                    >
                                                        ±{' '}
                                                        {meters(
                                                            order.accuracyM,
                                                        )}
                                                    </span>
                                                ),
                                            },
                                            {
                                                label: t(
                                                    'orders.detail.fixTime',
                                                ),
                                                value: ago(order.minutesAgo),
                                            },
                                            {
                                                label: t(
                                                    'orders.detail.mockCheck',
                                                ),
                                                value: order.flags.includes(
                                                    'mock',
                                                ) ? (
                                                    <span className="text-danger-ink">
                                                        {t(
                                                            'orders.detail.detected',
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-success-ink">
                                                        {t(
                                                            'orders.detail.passed',
                                                        )}
                                                    </span>
                                                ),
                                            },
                                        ]}
                                    />
                                </>
                            )}
                        </Panel>

                        <Panel>
                            <PanelHeader
                                title={t('orders.detail.shop')}
                                action={
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-card"
                                        asChild
                                    >
                                        <a
                                            href={`tel:${shop.phone.replace(/\D/g, '')}`}
                                        >
                                            <Phone className="size-3.5" />
                                            {t('orders.detail.call')}
                                        </a>
                                    </Button>
                                }
                            />
                            <div className="px-4 pt-3">
                                <Link
                                    href={shopsIndex({
                                        query: { q: shop.code },
                                    })}
                                    className="font-medium underline-offset-4 hover:underline"
                                >
                                    {name(shop)}
                                </Link>
                                <p className="text-xs text-muted-foreground">
                                    {shop.code} · {shop.route}
                                </p>
                            </div>
                            <KeyValues
                                items={[
                                    {
                                        label: t('orders.detail.owner'),
                                        value: shop.owner,
                                    },
                                    {
                                        label: t('orders.detail.phone'),
                                        value: shop.phone,
                                    },
                                    {
                                        label: t('orders.detail.shopDue'),
                                        value: f.taka(shop.due),
                                    },
                                    {
                                        label: t('orders.detail.creditLimit'),
                                        value: f.taka(shop.creditLimit),
                                    },
                                ]}
                            />
                            <div className="px-4 pb-3">
                                <Meter
                                    value={shop.due + total}
                                    max={shop.creditLimit}
                                    tone={
                                        shop.due + total > shop.creditLimit
                                            ? 'danger'
                                            : 'primary'
                                    }
                                    label={t('orders.detail.creditLimit')}
                                />
                                <p className="mt-1.5 text-xs text-muted-foreground">
                                    {t('orders.detail.creditUse', {
                                        used: f.taka(shop.due + total),
                                        limit: f.taka(shop.creditLimit),
                                    })}
                                </p>
                            </div>
                        </Panel>

                        <Panel>
                            <PanelHeader title={t('orders.detail.takenBy')} />
                            <div className="flex flex-col gap-3 px-4 py-3">
                                <Person
                                    name={sr.name}
                                    sub={`${sr.code} · ${sr.phone}`}
                                />
                                <p className="rounded-md bg-muted px-3 py-2 text-sm">
                                    <span className="block text-xs text-muted-foreground">
                                        {t('orders.detail.note')}
                                    </span>
                                    {t('orders.detail.noteText')}
                                </p>
                            </div>
                        </Panel>
                    </div>
                </div>
            </PageBody>

            <RejectOrdersDialog
                numbers={rejecting}
                onOpenChange={(open) => !open && setRejecting([])}
            />
            <AssignTripDialog
                numbers={assigning}
                onOpenChange={(open) => !open && setAssigning([])}
            />
            <InvoiceDialog
                order={order}
                open={invoiceOpen}
                onOpenChange={setInvoiceOpen}
            />
        </>
    );
}

function Sum({
    label,
    value,
    strong = false,
}: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div
            className={cn(
                'flex justify-between gap-4',
                strong && 'border-t pt-1.5 font-semibold',
            )}
        >
            <dt className={cn(!strong && 'text-muted-foreground')}>{label}</dt>
            <dd className="tabular-nums">{value}</dd>
        </div>
    );
}

function Event({
    icon: Icon,
    title,
    sub,
    done = false,
    last = false,
    tone,
}: {
    icon: LucideIcon;
    title: string;
    sub?: string;
    done?: boolean;
    last?: boolean;
    tone?: 'warning' | 'danger';
}) {
    return (
        <li className="relative flex gap-3 pb-4 last:pb-0">
            {!last && (
                <span
                    className="absolute top-8 bottom-0 left-[15px] w-px bg-border"
                    aria-hidden
                />
            )}
            <span
                className={cn(
                    'relative flex size-8 shrink-0 items-center justify-center rounded-full',
                    tone === 'warning' && 'bg-warning-soft text-warning-ink',
                    tone === 'danger' && 'bg-danger-soft text-danger-ink',
                    !tone &&
                        (done
                            ? 'bg-accent text-accent-foreground'
                            : 'border bg-card text-muted-foreground'),
                )}
            >
                <Icon className="size-4" aria-hidden />
            </span>
            <div className="pt-1">
                <p
                    className={cn(
                        'text-sm',
                        done ? 'font-medium' : 'text-muted-foreground',
                    )}
                >
                    {title}
                </p>
                {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            </div>
        </li>
    );
}

OrderShow.layout = {
    breadcrumbs: [{ title: 'nav.orders', href: ordersIndex() }],
};
