import { Link, router } from '@inertiajs/react';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Field, FormDialog, TextInput } from '@/components/admin/dialogs';
import { StatusBadge } from '@/components/admin/status-badge';
import type { Tone } from '@/components/admin/status-badge';
import { useDate } from '@/components/platform/bits';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/hooks/use-format';
import {
    confirm as confirmInvoice,
    voidMethod as voidInvoice,
} from '@/routes/platform/invoices';

export type Invoice = {
    id: number;
    number: string;
    plan: string;
    periodStart: string;
    periodEnd: string;
    amount: number;
    status: 'unpaid' | 'submitted' | 'paid' | 'void';
    dueAt: string;
    method: string | null;
    reference: string | null;
    paidAt: string | null;
    note: string | null;
};

export const invoiceTone: Record<Invoice['status'], Tone> = {
    unpaid: 'warning',
    submitted: 'info',
    paid: 'success',
    void: 'neutral',
};

/** Invoices with the platform's actions (mark paid, not received, cancel). */
export function InvoiceTable({
    invoices,
    canAct,
    showCompany = false,
}: {
    invoices: (Invoice & { company?: string; companyId?: number })[];
    canAct: boolean;
    showCompany?: boolean;
}) {
    const { f } = useFormat();
    const date = useDate();

    if (invoices.length === 0) {
        return (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No invoices.
            </p>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b bg-background text-xs text-muted-foreground">
                    <tr>
                        <th className="px-4 py-2 text-left font-medium">
                            Invoice
                        </th>
                        {showCompany && (
                            <th className="px-4 py-2 text-left font-medium">
                                Company
                            </th>
                        )}
                        <th className="px-4 py-2 text-left font-medium">
                            Period
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                            Payment
                        </th>
                        <th className="px-4 py-2 text-right font-medium">
                            Amount
                        </th>
                        <th className="px-4 py-2 text-right font-medium">
                            Status
                        </th>
                        {canAct && <th className="px-4 py-2" />}
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {invoices.map((i) => (
                        <tr key={i.id}>
                            <td className="px-4 py-2.5 font-medium">
                                {i.number}
                                {i.note && (
                                    <p className="text-xs font-normal text-muted-foreground">
                                        {i.note}
                                    </p>
                                )}
                            </td>
                            {showCompany && (
                                <td className="px-4 py-2.5">
                                    {i.companyId ? (
                                        <Link
                                            href={`/platform/companies/${i.companyId}`}
                                            className="hover:underline"
                                        >
                                            {i.company}
                                        </Link>
                                    ) : (
                                        i.company
                                    )}
                                </td>
                            )}
                            <td className="px-4 py-2.5 text-muted-foreground">
                                {date(i.periodStart)} – {date(i.periodEnd)}
                            </td>
                            <td className="px-4 py-2.5">
                                {i.method ? (
                                    <>
                                        <span className="uppercase">
                                            {i.method}
                                        </span>{' '}
                                        <span className="font-mono text-xs select-all">
                                            {i.reference}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-muted-foreground">
                                        —
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                                {f.taka(i.amount)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                                <StatusBadge
                                    tone={invoiceTone[i.status]}
                                    label={i.status}
                                />
                            </td>
                            {canAct && (
                                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                    {(i.status === 'submitted' ||
                                        i.status === 'unpaid') && (
                                        <Button
                                            size="sm"
                                            variant={
                                                i.status === 'submitted'
                                                    ? 'default'
                                                    : 'ghost'
                                            }
                                            onClick={() =>
                                                router.post(
                                                    confirmInvoice.url(i.id),
                                                    {},
                                                    { preserveScroll: true },
                                                )
                                            }
                                        >
                                            <CheckCircle2 className="size-3.5" />
                                            Mark paid
                                        </Button>
                                    )}
                                    {i.status === 'submitted' && (
                                        <RejectButton id={i.id} />
                                    )}
                                    {i.status === 'unpaid' && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-muted-foreground"
                                            onClick={() =>
                                                router.post(
                                                    voidInvoice.url(i.id),
                                                    {},
                                                    { preserveScroll: true },
                                                )
                                            }
                                        >
                                            Cancel
                                        </Button>
                                    )}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function RejectButton({ id }: { id: number }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');

    return (
        <>
            <Button
                size="sm"
                variant="ghost"
                className="text-danger-ink"
                onClick={() => setOpen(true)}
            >
                Not received
            </Button>
            {open && (
                <FormDialog
                    open
                    onOpenChange={setOpen}
                    title="Payment not found?"
                    description="The invoice goes back to unpaid and the owner sees your note."
                    submitLabel="Send back"
                    destructive
                    onSubmit={() => {
                        router.post(
                            `/platform/invoices/${id}/reject`,
                            { reason },
                            { preserveScroll: true },
                        );
                    }}
                >
                    <Field label="Note to the owner">
                        <TextInput
                            value={reason}
                            onChange={setReason}
                            placeholder="Transaction ID not found in bKash"
                            autoFocus
                        />
                    </Field>
                </FormDialog>
            )}
        </>
    );
}
