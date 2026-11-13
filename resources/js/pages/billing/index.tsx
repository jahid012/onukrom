import { Head, router } from '@inertiajs/react';
import {
    CalendarClock,
    Check,
    CreditCard,
    Loader2,
    Receipt,
    Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Field, FormDialog, TextInput } from '@/components/admin/dialogs';
import { SelectField } from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import type { Tone } from '@/components/admin/status-badge';
import { Meter, Panel, PanelHeader } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { invoiceTone } from '@/components/billing/invoices';
import type { Invoice } from '@/components/billing/invoices';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';
import {
    index as billingIndex,
    pay,
    payOnline,
    plan as planRoute,
} from '@/routes/billing';

type Subscription = {
    status: 'trial' | 'active' | 'past_due' | 'suspended';
    plan: string;
    planName: string;
    planNameBn: string | null;
    price: number;
    trialEndsAt: string | null;
    paidUntil: string | null;
    coveredUntil: string | null;
    staffUsed: number;
    staffLimit: number;
    smsUsed: number;
    smsLimit: number;
};

type Plan = {
    key: string;
    name: string;
    name_bn: string | null;
    price: number;
    staffLimit: number;
    smsLimit: number;
    description: string | null;
};

const statusTone: Record<Subscription['status'], Tone> = {
    trial: 'info',
    active: 'success',
    past_due: 'warning',
    suspended: 'danger',
};

export default function BillingIndex({
    canManage,
    subscription: sub,
    plans,
    invoices,
    methods,
    paymentInstructions,
    onlinePayment,
}: {
    canManage: boolean;
    subscription: Subscription;
    plans: Plan[];
    invoices: Invoice[];
    methods: string[];
    paymentInstructions: string;
    onlinePayment: boolean;
}) {
    const { t, f, locale } = useFormat();
    const [paying, setPaying] = useState<Invoice | null>(null);
    const [switchTo, setSwitchTo] = useState<Plan | null>(null);
    const [redirecting, setRedirecting] = useState(false);
    // "paystation:bkash" → "Online (bkash)"; manual methods have their own names.
    const methodLabel = (m: string) =>
        m.startsWith('paystation:')
            ? t('billing.methods.online', { method: m.slice(11) })
            : t(`billing.methods.${m}`);
    const date = (iso: string | null) =>
        iso
            ? f.date(new Date(`${iso}T00:00:00`), {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
              })
            : '—';
    const planName = (p: { name: string; name_bn?: string | null }) =>
        locale === 'bn' && p.name_bn ? p.name_bn : p.name;
    const open = invoices.filter(
        (i) => i.status === 'unpaid' || i.status === 'submitted',
    );

    return (
        <>
            <Head title={t('billing.title')} />
            <PageBody>
                <PageHeader
                    title={t('billing.title')}
                    description={t('billing.description')}
                />

                {sub.status === 'suspended' && (
                    <p className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger-ink">
                        {t('billing.suspended')}
                    </p>
                )}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <Panel className="lg:col-span-2">
                        <PanelHeader
                            title={t('billing.current')}
                            action={
                                <StatusBadge
                                    tone={statusTone[sub.status]}
                                    label={t(`billing.status.${sub.status}`)}
                                />
                            }
                        />
                        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
                            <div>
                                <p className="text-xs text-muted-foreground">
                                    {t('billing.plan')}
                                </p>
                                <p className="text-lg font-semibold">
                                    {planName({
                                        name: sub.planName,
                                        name_bn: sub.planNameBn,
                                    })}
                                </p>
                                <p className="text-sm text-muted-foreground tabular-nums">
                                    {t('billing.perMonth', {
                                        price: f.taka(sub.price),
                                    })}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">
                                    {sub.status === 'trial'
                                        ? t('billing.trialUntil')
                                        : t('billing.coveredUntil')}
                                </p>
                                <p className="flex items-center gap-1.5 text-lg font-semibold">
                                    <CalendarClock className="size-4 text-muted-foreground" />
                                    {date(sub.coveredUntil)}
                                </p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <UsageRow
                                    label={t('billing.staff')}
                                    used={sub.staffUsed}
                                    limit={sub.staffLimit}
                                />
                                <UsageRow
                                    label={t('billing.sms')}
                                    used={sub.smsUsed}
                                    limit={sub.smsLimit}
                                />
                            </div>
                        </div>
                    </Panel>

                    <Panel>
                        <PanelHeader
                            title={t('billing.howToPay')}
                            subtitle={
                                onlinePayment
                                    ? t('billing.howToPayOnline')
                                    : t('billing.howToPaySub')
                            }
                        />
                        {onlinePayment && (
                            <p className="flex items-start gap-2 border-b px-4 py-3 text-sm">
                                <Zap className="mt-0.5 size-4 shrink-0 text-primary" />
                                {t('billing.onlineText')}
                            </p>
                        )}
                        <p className="px-4 py-3 text-sm whitespace-pre-line">
                            {paymentInstructions || t('billing.noInstructions')}
                        </p>
                    </Panel>
                </div>

                {open.length > 0 && (
                    <Panel>
                        <PanelHeader
                            title={t('billing.toPay')}
                            subtitle={t('billing.toPaySub')}
                        />
                        <ul className="divide-y">
                            {open.map((i) => (
                                <li
                                    key={i.id}
                                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                                >
                                    <Receipt className="size-5 text-muted-foreground" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium">
                                            {i.number} · {date(i.periodStart)} –{' '}
                                            {date(i.periodEnd)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {i.status === 'submitted'
                                                ? t('billing.waitingCheck', {
                                                      ref: i.reference ?? '',
                                                  })
                                                : t('billing.dueOn', {
                                                      date: date(i.dueAt),
                                                  })}
                                            {i.note ? ` · ${i.note}` : ''}
                                        </p>
                                    </div>
                                    <span className="text-lg font-semibold tabular-nums">
                                        {f.taka(i.amount)}
                                    </span>
                                    <StatusBadge
                                        tone={invoiceTone[i.status]}
                                        label={t(
                                            `billing.invoiceStatus.${i.status}`,
                                        )}
                                    />
                                    {canManage && onlinePayment && (
                                        <Button
                                            size="sm"
                                            disabled={redirecting}
                                            onClick={() => {
                                                setRedirecting(true);
                                                // The server answers with a redirect to PayStation's checkout.
                                                router.post(
                                                    payOnline.url(i.id),
                                                    {},
                                                    {
                                                        onFinish: () =>
                                                            setRedirecting(
                                                                false,
                                                            ),
                                                    },
                                                );
                                            }}
                                        >
                                            {redirecting ? (
                                                <Loader2 className="size-3.5 animate-spin" />
                                            ) : (
                                                <Zap className="size-3.5" />
                                            )}
                                            {t('billing.payOnline')}
                                        </Button>
                                    )}
                                    {canManage && (
                                        <Button
                                            size="sm"
                                            variant={
                                                i.status === 'unpaid' &&
                                                !onlinePayment
                                                    ? 'default'
                                                    : 'outline'
                                            }
                                            onClick={() => setPaying(i)}
                                        >
                                            <CreditCard className="size-3.5" />
                                            {i.status === 'unpaid'
                                                ? onlinePayment
                                                    ? t('billing.paidManually')
                                                    : t('billing.payNow')
                                                : t('billing.changeRef')}
                                        </Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </Panel>
                )}

                <Panel tour="billing-plans">
                    <PanelHeader
                        title={t('billing.plans')}
                        subtitle={
                            canManage
                                ? t('billing.plansSub')
                                : t('billing.ownerOnly')
                        }
                    />
                    <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
                        {plans.map((p) => {
                            const current = p.key === sub.plan;

                            return (
                                <div
                                    key={p.key}
                                    className={cn(
                                        'flex flex-col gap-3 rounded-md border p-4',
                                        current &&
                                            'border-primary ring-1 ring-primary',
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-semibold">
                                            {planName(p)}
                                        </p>
                                        {current && (
                                            <StatusBadge
                                                tone="primary"
                                                label={t('billing.yourPlan')}
                                            />
                                        )}
                                    </div>
                                    <p className="text-2xl font-semibold tabular-nums">
                                        {f.taka(p.price)}
                                        <span className="text-sm font-normal text-muted-foreground">
                                            {' '}
                                            / {t('billing.month')}
                                        </span>
                                    </p>
                                    <ul className="flex flex-col gap-1.5 text-sm">
                                        <li className="flex items-center gap-2">
                                            <Check className="size-4 text-success" />
                                            {t('billing.staffUpTo', {
                                                n: f.num(p.staffLimit),
                                            })}
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="size-4 text-success" />
                                            {t('billing.smsUpTo', {
                                                n: f.num(p.smsLimit),
                                            })}
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="size-4 text-success" />
                                            {t('billing.allFeatures')}
                                        </li>
                                    </ul>
                                    {canManage && !current && (
                                        <Button
                                            variant="outline"
                                            className="mt-auto"
                                            onClick={() => setSwitchTo(p)}
                                        >
                                            {p.price > sub.price
                                                ? t('billing.upgrade')
                                                : t('billing.switch')}
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Panel>

                <Panel>
                    <PanelHeader title={t('billing.history')} />
                    {invoices.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                            {t('billing.noInvoices')}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-sm">
                                <thead className="border-b bg-background text-xs text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium">
                                            {t('billing.cols.number')}
                                        </th>
                                        <th className="px-4 py-2 text-left font-medium">
                                            {t('billing.cols.period')}
                                        </th>
                                        <th className="px-4 py-2 text-left font-medium">
                                            {t('billing.cols.payment')}
                                        </th>
                                        <th className="px-4 py-2 text-right font-medium">
                                            {t('billing.cols.amount')}
                                        </th>
                                        <th className="px-4 py-2 text-right font-medium">
                                            {t('billing.cols.status')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {invoices.map((i) => (
                                        <tr key={i.id}>
                                            <td className="px-4 py-2.5 font-medium">
                                                {i.number}
                                            </td>
                                            <td className="px-4 py-2.5 text-muted-foreground">
                                                {date(i.periodStart)} –{' '}
                                                {date(i.periodEnd)}
                                            </td>
                                            <td className="px-4 py-2.5 text-muted-foreground">
                                                {i.method
                                                    ? `${methodLabel(i.method)} · ${i.reference ?? ''}`
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                                                {f.taka(i.amount)}
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                <StatusBadge
                                                    tone={invoiceTone[i.status]}
                                                    label={t(
                                                        `billing.invoiceStatus.${i.status}`,
                                                    )}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
            </PageBody>

            {paying && (
                <PayDialog
                    invoice={paying}
                    methods={methods}
                    onClose={() => setPaying(null)}
                />
            )}
            {switchTo && (
                <FormDialog
                    open
                    onOpenChange={(o) => !o && setSwitchTo(null)}
                    title={t('billing.switchTitle', {
                        plan: planName(switchTo),
                    })}
                    description={t('billing.switchText', {
                        price: f.taka(switchTo.price),
                    })}
                    submitLabel={t('billing.switchConfirm')}
                    onSubmit={() => {
                        router.post(
                            planRoute.url(),
                            { plan: switchTo.key },
                            { preserveScroll: true },
                        );
                    }}
                />
            )}
        </>
    );
}

function UsageRow({
    label,
    used,
    limit,
}: {
    label: string;
    used: number;
    limit: number;
}) {
    const { f } = useFormat();
    const full = used >= limit;

    return (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span
                    className={cn(
                        'font-medium tabular-nums',
                        full && 'text-danger-ink',
                    )}
                >
                    {f.num(used)} / {f.num(limit)}
                </span>
            </div>
            <Meter
                value={Math.min(used, limit)}
                max={Math.max(1, limit)}
                tone={full ? 'danger' : 'primary'}
                label={label}
            />
        </div>
    );
}

function PayDialog({
    invoice,
    methods,
    onClose,
}: {
    invoice: Invoice;
    methods: string[];
    onClose: () => void;
}) {
    const { t, f } = useFormat();
    const [method, setMethod] = useState(invoice.method ?? methods[0]);
    const [reference, setReference] = useState(invoice.reference ?? '');

    return (
        <FormDialog
            open
            onOpenChange={(o) => !o && onClose()}
            title={t('billing.payTitle', { number: invoice.number })}
            description={t('billing.payText', {
                amount: f.taka(invoice.amount),
            })}
            submitLabel={t('billing.paySubmit')}
            disabled={reference.trim().length < 4}
            onSubmit={() => {
                router.post(
                    pay.url(invoice.id),
                    { method, reference: reference.trim() },
                    { preserveScroll: true },
                );
                onClose();
            }}
        >
            <Field label={t('billing.method')}>
                <SelectField
                    value={method}
                    onChange={setMethod}
                    label={t('billing.method')}
                    options={methods.map((m) => ({
                        value: m,
                        label: t(`billing.methods.${m}`),
                    }))}
                />
            </Field>
            <Field
                label={t('billing.reference')}
                help={t('billing.referenceHelp')}
            >
                <TextInput
                    value={reference}
                    onChange={setReference}
                    placeholder="9KX4T2PL1M"
                    autoFocus
                />
            </Field>
        </FormDialog>
    );
}

BillingIndex.layout = {
    breadcrumbs: [{ title: 'nav.billing', href: billingIndex() }],
};
