import { Head, router } from '@inertiajs/react';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { Tabs } from '@/components/admin/tabs';
import type { TabItem } from '@/components/admin/tabs';
import { Panel } from '@/components/dashboard/primitives';
import { useFormat } from '@/hooks/use-format';
import { InvoiceTable } from '@/components/billing/invoices';
import type { Invoice } from '@/components/billing/invoices';
import { index as invoicesIndex } from '@/routes/platform/invoices';

type Status = 'submitted' | 'unpaid' | 'paid' | 'void' | 'all';

export default function PlatformInvoices({
    status,
    invoices,
    counts,
}: {
    status: Status;
    invoices: (Invoice & { company: string; companyId: number })[];
    counts: Partial<Record<Exclude<Status, 'all'>, number>>;
}) {
    const { f } = useFormat();
    const tab = (value: Status, label: string): TabItem<Status> => ({
        value,
        label,
        ...(value !== 'all' && { count: f.num(counts[value] ?? 0) }),
        ...(value === 'submitted' && { tone: 'warning' as const }),
    });

    return (
        <>
            <Head title="Invoices" />
            <PageBody>
                <PageHeader
                    title="Invoices"
                    description="Owners pay by bKash, Nagad, Rocket or bank and submit the transaction ID. Check it in your account, then mark the invoice paid — the company is covered until the end of that period."
                />
                <Panel>
                    <Tabs
                        className="px-2"
                        value={status}
                        onChange={(v) =>
                            router.get(
                                invoicesIndex.url({ query: { status: v } }),
                            )
                        }
                        items={[
                            tab('submitted', 'To check'),
                            tab('unpaid', 'Unpaid'),
                            tab('paid', 'Paid'),
                            tab('void', 'Cancelled'),
                            tab('all', 'All'),
                        ]}
                    />
                    <InvoiceTable invoices={invoices} canAct showCompany />
                </Panel>
            </PageBody>
        </>
    );
}

PlatformInvoices.layout = {
    breadcrumbs: [{ title: 'Invoices', href: invoicesIndex() }],
};
