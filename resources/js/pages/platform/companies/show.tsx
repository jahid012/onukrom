import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Ban, Eye, FilePlus2, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { KeyValues } from '@/components/admin/bits';
import {
    ConfirmDialog,
    Field,
    FormDialog,
    TextInput,
} from '@/components/admin/dialogs';
import { SelectField } from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import type { Ticket } from '@/components/support/thread';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/hooks/use-format';
import { InvoiceTable } from '@/components/billing/invoices';
import type { Invoice } from '@/components/billing/invoices';
import {
    impersonate,
    index as companiesIndex,
    invoices as issueInvoice,
    status as setStatus,
    subscription as saveSubscription,
} from '@/routes/platform/companies';
import { show as ticketShow } from '@/routes/platform/support';
import { CompanyStatus, useDate } from '@/components/platform/bits';
import type { CompanyRow, PlanOption } from '@/components/platform/bits';

type Company = CompanyRow & {
    phone: string | null;
    address: string | null;
    trialEndsAt: string | null;
    paidUntil: string | null;
    staffUsed: number;
    staffLimit: number;
    owner: { name: string; email: string | null; phone: string | null } | null;
};

type Member = {
    id: number;
    name: string;
    code: string | null;
    phone: string | null;
    email: string | null;
    roles: string[];
    status: string;
    lastSeen: string | null;
};

export default function CompanyShow({
    company,
    staff,
    invoices,
    tickets,
    plans,
}: {
    company: Company;
    staff: Member[];
    invoices: Invoice[];
    tickets: Ticket[];
    plans: PlanOption[];
}) {
    const { f } = useFormat();
    const date = useDate();
    const { auth } = usePage().props;
    const isSuper = auth.user.platform_role === 'super_admin';
    const [editing, setEditing] = useState(false);
    const [suspending, setSuspending] = useState(false);
    const [newInvoice, setNewInvoice] = useState(false);

    return (
        <>
            <Head title={company.name} />
            <PageBody>
                <Link
                    href={companiesIndex()}
                    className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    All companies
                </Link>
                <PageHeader
                    title={company.name}
                    description={`Code ${company.code} · joined ${date(company.createdAt)}`}
                    actions={
                        <>
                            <CompanyStatus status={company.subscription} />
                            <Button
                                size="sm"
                                disabled={!company.owner}
                                onClick={() =>
                                    router.post(impersonate.url(company.id))
                                }
                            >
                                <Eye className="size-3.5" />
                                View as owner
                            </Button>
                            {isSuper &&
                                (company.subscription === 'suspended' ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-card"
                                        onClick={() =>
                                            router.post(
                                                setStatus.url(company.id),
                                                { status: 'active' },
                                            )
                                        }
                                    >
                                        <RotateCcw className="size-3.5" />
                                        Re-activate
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-card text-danger-ink"
                                        onClick={() => setSuspending(true)}
                                    >
                                        <Ban className="size-3.5" />
                                        Suspend
                                    </Button>
                                ))}
                        </>
                    }
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <Panel>
                        <PanelHeader title="Company" />
                        <KeyValues
                            items={[
                                {
                                    label: 'Owner',
                                    value: company.owner?.name ?? '—',
                                },
                                {
                                    label: 'Login email',
                                    value: company.owner?.email ?? '—',
                                },
                                {
                                    label: 'Owner mobile',
                                    value: company.owner?.phone ?? '—',
                                },
                                {
                                    label: 'Company phone',
                                    value: company.phone ?? '—',
                                },
                                {
                                    label: 'Address',
                                    value: company.address ?? '—',
                                },
                            ]}
                        />
                    </Panel>
                    <Panel className="lg:col-span-2">
                        <PanelHeader
                            title="Subscription"
                            action={
                                isSuper && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-card"
                                        onClick={() => setEditing(true)}
                                    >
                                        Change plan / dates
                                    </Button>
                                )
                            }
                        />
                        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
                            <Stat
                                label="Plan"
                                value={company.planName}
                                note={`${f.taka(company.price)} / month`}
                            />
                            <Stat
                                label="Trial ends"
                                value={date(company.trialEndsAt)}
                            />
                            <Stat
                                label="Paid until"
                                value={date(company.paidUntil)}
                            />
                            <Stat
                                label="Staff"
                                value={`${f.num(company.staffUsed)} / ${f.num(company.staffLimit)}`}
                            />
                        </div>
                    </Panel>
                </div>

                <Panel>
                    <PanelHeader
                        title="Invoices"
                        subtitle="Confirm a payment once you see the money in the account."
                        action={
                            isSuper && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-card"
                                    onClick={() => setNewInvoice(true)}
                                >
                                    <FilePlus2 className="size-3.5" />
                                    New invoice
                                </Button>
                            )
                        }
                    />
                    <InvoiceTable invoices={invoices} canAct={isSuper} />
                </Panel>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Panel>
                        <PanelHeader
                            title="Staff"
                            subtitle={`${f.num(staff.length)} people`}
                        />
                        <ul className="max-h-96 divide-y overflow-y-auto">
                            {staff.map((m) => (
                                <li
                                    key={m.id}
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium">
                                            {m.name}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            {[m.code, m.phone ?? m.email]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </span>
                                    </span>
                                    <span className="text-xs text-muted-foreground uppercase">
                                        {m.roles.join(', ')}
                                    </span>
                                    <StatusBadge
                                        tone={
                                            m.status === 'active'
                                                ? 'success'
                                                : m.status === 'invited'
                                                  ? 'info'
                                                  : 'neutral'
                                        }
                                        label={m.status}
                                    />
                                </li>
                            ))}
                        </ul>
                    </Panel>
                    <Panel>
                        <PanelHeader title="Support tickets" />
                        <ul className="divide-y">
                            {tickets.map((ticket) => (
                                <li key={ticket.id}>
                                    <Link
                                        href={ticketShow(ticket.id)}
                                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted"
                                    >
                                        <span className="min-w-0 flex-1 truncate text-sm">
                                            {ticket.subject}
                                        </span>
                                        <StatusBadge
                                            tone={
                                                ticket.status === 'open'
                                                    ? 'warning'
                                                    : ticket.status ===
                                                        'answered'
                                                      ? 'success'
                                                      : 'neutral'
                                            }
                                            label={ticket.status}
                                        />
                                    </Link>
                                </li>
                            ))}
                            {tickets.length === 0 && (
                                <li className="px-4 py-3 text-sm text-muted-foreground">
                                    No tickets from this company.
                                </li>
                            )}
                        </ul>
                    </Panel>
                </div>
            </PageBody>

            {editing && (
                <SubscriptionDialog
                    company={company}
                    plans={plans}
                    onClose={() => setEditing(false)}
                />
            )}
            {newInvoice && (
                <NewInvoiceDialog
                    companyId={company.id}
                    onClose={() => setNewInvoice(false)}
                />
            )}
            <ConfirmDialog
                open={suspending}
                onOpenChange={setSuspending}
                title={`Suspend ${company.name}?`}
                description="Their staff can only open Billing and Support until you re-activate the company. The mobile app stops working."
                confirmLabel="Suspend"
                destructive
                onConfirm={() =>
                    router.post(setStatus.url(company.id), {
                        status: 'suspended',
                    })
                }
            />
        </>
    );
}

function Stat({
    label,
    value,
    note,
}: {
    label: string;
    value: string;
    note?: string;
}) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold tabular-nums">{value}</p>
            {note && (
                <p className="text-xs text-muted-foreground tabular-nums">
                    {note}
                </p>
            )}
        </div>
    );
}

function SubscriptionDialog({
    company,
    plans,
    onClose,
}: {
    company: Company;
    plans: PlanOption[];
    onClose: () => void;
}) {
    const form = useForm({
        plan: company.plan,
        trial_ends_at: company.trialEndsAt ?? '',
        paid_until: company.paidUntil ?? '',
    });

    return (
        <FormDialog
            open
            onOpenChange={(o) => !o && onClose()}
            title="Change plan or dates"
            description="Extend a trial, or cover a company that paid outside Onukrom. Leave a date empty to clear it."
            submitLabel="Save"
            disabled={form.processing}
            onSubmit={() => {
                form.post(saveSubscription.url(company.id), {
                    preserveScroll: true,
                    onSuccess: onClose,
                });

                return false;
            }}
        >
            <Field label="Plan" error={form.errors.plan}>
                <SelectField
                    value={form.data.plan}
                    onChange={(v) => form.setData('plan', v)}
                    label="Plan"
                    options={plans.map((p) => ({
                        value: p.key,
                        label: p.name,
                    }))}
                />
            </Field>
            <Field label="Trial ends on" error={form.errors.trial_ends_at}>
                <TextInput
                    type="date"
                    value={form.data.trial_ends_at}
                    onChange={(v) => form.setData('trial_ends_at', v)}
                />
            </Field>
            <Field label="Paid until" error={form.errors.paid_until}>
                <TextInput
                    type="date"
                    value={form.data.paid_until}
                    onChange={(v) => form.setData('paid_until', v)}
                />
            </Field>
        </FormDialog>
    );
}

function NewInvoiceDialog({
    companyId,
    onClose,
}: {
    companyId: number;
    onClose: () => void;
}) {
    const [start, setStart] = useState(new Date().toISOString().slice(0, 10));

    return (
        <FormDialog
            open
            onOpenChange={(o) => !o && onClose()}
            title="New invoice"
            description="One month at the company's current plan price, starting on this date."
            submitLabel="Create invoice"
            onSubmit={() => {
                router.post(
                    issueInvoice.url(companyId),
                    { start },
                    { preserveScroll: true },
                );
            }}
        >
            <Field label="Period starts">
                <TextInput type="date" value={start} onChange={setStart} />
            </Field>
        </FormDialog>
    );
}

CompanyShow.layout = {
    breadcrumbs: [{ title: 'Companies', href: companiesIndex() }],
};
