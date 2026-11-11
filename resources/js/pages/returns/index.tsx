import { Head } from '@inertiajs/react';
import { Check, PackageX, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { MiniStat, Person, Stack } from '@/components/admin/bits';
import type { Column } from '@/components/admin/data-table';
import {
    DataTable,
    TableFooter,
    usePaged,
} from '@/components/admin/data-table';
import { ConfirmDialog, Field, FormDialog } from '@/components/admin/dialogs';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import type { Tone } from '@/components/admin/status-badge';
import { Tabs } from '@/components/admin/tabs';
import { Panel } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import type { ReturnRow } from '@/data/admin/sales';
import { approveReturn, rejectReturn, useAdminData } from '@/data/admin/store';
import { staffByCode } from '@/data/admin/store';
import { useAdmin } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';
import { index as returnsIndex } from '@/routes/returns';

type Status = ReturnRow['status'];

const tone: Record<Status, Tone> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
};

export default function ReturnsIndex() {
    const { t, f, name, ago } = useAdmin();
    const { returns, shops } = useAdminData();
    const [tab, setTab] = useState<Status>('pending');
    const [approving, setApproving] = useState<ReturnRow | null>(null);
    const [rejecting, setRejecting] = useState<ReturnRow | null>(null);
    const rows = returns.filter((r) => r.status === tab);
    const paged = usePaged(rows);
    const count = (s: Status) =>
        f.num(returns.filter((r) => r.status === s).length);
    const pending = returns.filter((r) => r.status === 'pending');
    const approved = returns.filter((r) => r.status === 'approved');
    const shopOf = (id: string) => shops.find((s) => s.id === id) ?? shops[0];

    const columns: Column<ReturnRow>[] = [
        {
            key: 'number',
            header: t('returns.columns.number'),
            cell: (r) => (
                <Stack
                    main={<span className="font-medium">{r.number}</span>}
                    sub={ago(r.minutesAgo)}
                />
            ),
        },
        {
            key: 'shop',
            header: t('returns.columns.shop'),
            cell: (r) => (
                <Stack
                    main={name(shopOf(r.shopId))}
                    sub={shopOf(r.shopId).route}
                />
            ),
        },
        {
            key: 'type',
            header: t('returns.columns.type'),
            cell: (r) => (
                <span className="text-sm whitespace-nowrap">
                    {t(`returns.type.${r.type}`)}
                </span>
            ),
        },
        {
            key: 'reason',
            header: t('returns.columns.reason'),
            cell: (r) => (
                <Stack
                    main={t(`returns.reason.${r.reason}`)}
                    sub={t(`returns.condition.${r.condition}`)}
                />
            ),
        },
        {
            key: 'value',
            header: t('returns.columns.value'),
            align: 'right',
            cell: (r) => (
                <Stack
                    main={
                        <span className="font-medium tabular-nums">
                            {f.taka(r.value)}
                        </span>
                    }
                    sub={t('returns.itemsCount', { n: f.num(r.items) })}
                />
            ),
        },
        {
            key: 'by',
            header: t('returns.columns.by'),
            cell: (r) => (
                <Person name={staffByCode(r.by).name} sub={r.by} size="sm" />
            ),
        },
        {
            key: 'status',
            header: tab === 'pending' ? '' : t('returns.columns.status'),
            align: tab === 'pending' ? 'right' : 'left',
            cell: (r) =>
                r.status === 'pending' ? (
                    <div className="flex justify-end gap-1.5">
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-card text-danger-ink"
                            onClick={() => setRejecting(r)}
                        >
                            <X className="size-3.5" />
                            {t('admin.actions.reject')}
                        </Button>
                        <Button size="sm" onClick={() => setApproving(r)}>
                            <Check className="size-3.5" />
                            {t('admin.actions.approve')}
                        </Button>
                    </div>
                ) : (
                    <Stack
                        main={
                            <StatusBadge
                                tone={tone[r.status]}
                                label={t(`returns.status.${r.status}`)}
                            />
                        }
                        sub={
                            r.status === 'approved' && r.destination
                                ? t(`returns.destination.${r.destination}`)
                                : r.rejectReason
                        }
                    />
                ),
        },
    ];

    return (
        <>
            <Head title={t('returns.title')} />
            <PageBody>
                <PageHeader
                    title={t('returns.title')}
                    description={t('returns.description')}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <MiniStat
                        icon={Undo2}
                        label={t('returns.stats.pending')}
                        value={f.num(pending.length)}
                        note={f.taka(pending.reduce((s, r) => s + r.value, 0))}
                        tone="warning"
                    />
                    <MiniStat
                        icon={PackageX}
                        label={t('returns.stats.damaged')}
                        value={f.num(
                            pending.filter((r) => r.condition === 'damaged')
                                .length,
                        )}
                        note={t('returns.stats.damagedNote')}
                        tone="danger"
                    />
                    <MiniStat
                        icon={Check}
                        label={t('returns.stats.approved')}
                        value={f.taka(
                            approved.reduce((s, r) => s + r.value, 0),
                        )}
                        note={t('returns.stats.approvedNote', {
                            n: f.num(approved.length),
                        })}
                    />
                </div>

                <Panel>
                    <Tabs
                        className="px-2"
                        value={tab}
                        onChange={setTab}
                        items={[
                            {
                                value: 'pending',
                                label: t('returns.status.pending'),
                                count: count('pending'),
                                tone: 'warning',
                            },
                            {
                                value: 'approved',
                                label: t('returns.status.approved'),
                                count: count('approved'),
                            },
                            {
                                value: 'rejected',
                                label: t('returns.status.rejected'),
                                count: count('rejected'),
                            },
                        ]}
                    />
                    <p className="border-b px-4 py-2.5 text-xs text-muted-foreground">
                        {t('returns.help')}
                    </p>
                    <DataTable
                        columns={columns}
                        rows={paged.rows}
                        rowKey={(r) => r.number}
                        minWidth={1020}
                    />
                    <TableFooter paged={paged} />
                </Panel>
            </PageBody>

            {approving && (
                <ApproveReturnDialog
                    ret={approving}
                    shopName={name(shopOf(approving.shopId))}
                    onClose={() => setApproving(null)}
                />
            )}
            <ConfirmDialog
                open={rejecting !== null}
                onOpenChange={(open) => !open && setRejecting(null)}
                title={t('returns.rejectDialog.title', {
                    number: rejecting?.number ?? '',
                })}
                description={t('returns.rejectDialog.description')}
                confirmLabel={t('admin.actions.reject')}
                destructive
                reasonLabel={t('returns.rejectDialog.reason')}
                reasonOptions={[
                    t('returns.rejectDialog.r1'),
                    t('returns.rejectDialog.r2'),
                ]}
                onConfirm={(reason) => {
                    if (rejecting) {
                        rejectReturn(rejecting.number, reason);
                        toast.success(
                            t('returns.toast.rejected', {
                                number: rejecting.number,
                            }),
                        );
                    }
                }}
            />
        </>
    );
}

function ApproveReturnDialog({
    ret,
    shopName,
    onClose,
}: {
    ret: ReturnRow;
    shopName: string;
    onClose: () => void;
}) {
    const { t, f } = useAdmin();
    const [destination, setDestination] = useState<'main' | 'damage'>(
        ret.condition === 'good' ? 'main' : 'damage',
    );

    return (
        <FormDialog
            open
            onOpenChange={(open) => !open && onClose()}
            title={t('returns.approveDialog.title', { number: ret.number })}
            description={t('returns.approveDialog.description', {
                shop: shopName,
                amount: f.taka(ret.value),
            })}
            submitLabel={t('admin.actions.approve')}
            onSubmit={() => {
                approveReturn(ret.number, destination);
                toast.success(
                    t('returns.toast.approved', { number: ret.number }),
                );
            }}
        >
            <div className="grid grid-cols-2 gap-3 rounded-md bg-muted p-3 text-sm">
                <Stack
                    main={t(`returns.reason.${ret.reason}`)}
                    sub={t('returns.columns.reason')}
                />
                <Stack
                    main={t(`returns.condition.${ret.condition}`)}
                    sub={t('returns.itemsCount', { n: f.num(ret.items) })}
                />
            </div>
            <Field label={t('returns.approveDialog.destination')}>
                <div className="grid gap-2" role="radiogroup">
                    {(['main', 'damage'] as const).map((d) => (
                        <button
                            key={d}
                            type="button"
                            role="radio"
                            aria-checked={destination === d}
                            onClick={() => setDestination(d)}
                            className={cn(
                                'rounded-md border px-3 py-2.5 text-left text-sm',
                                destination === d
                                    ? 'border-primary ring-1 ring-primary'
                                    : 'hover:border-ring/50',
                            )}
                        >
                            {t(`returns.destination.${d}`)}
                        </button>
                    ))}
                </div>
            </Field>
        </FormDialog>
    );
}

ReturnsIndex.layout = {
    breadcrumbs: [{ title: 'nav.returns', href: returnsIndex() }],
};
