import { Head, useForm } from '@inertiajs/react';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Field, FormDialog, TextInput } from '@/components/admin/dialogs';
import { Switch } from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { Panel } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/hooks/use-format';
import { index as plansIndex, store, update } from '@/routes/platform/plans';

type Plan = {
    id: number;
    key: string;
    name: string;
    name_bn: string | null;
    price: number;
    staffLimit: number;
    smsLimit: number;
    description: string | null;
    active: boolean;
    companies: number;
};

export default function PlatformPlans({ plans }: { plans: Plan[] }) {
    const { f } = useFormat();
    const [editing, setEditing] = useState<Plan | 'new' | null>(null);

    return (
        <>
            <Head title="Plans & prices" />
            <PageBody>
                <PageHeader
                    title="Plans & prices"
                    description="Monthly price and limits per plan. A new price applies to the next invoice; invoices already issued keep their amount."
                    actions={
                        <Button size="sm" onClick={() => setEditing('new')}>
                            <Plus className="size-3.5" />
                            New plan
                        </Button>
                    }
                />
                <Panel>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-sm">
                            <thead className="border-b bg-background text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium">
                                        Plan
                                    </th>
                                    <th className="px-4 py-2 text-right font-medium">
                                        Price / month
                                    </th>
                                    <th className="px-4 py-2 text-right font-medium">
                                        Staff
                                    </th>
                                    <th className="px-4 py-2 text-right font-medium">
                                        SMS / month
                                    </th>
                                    <th className="px-4 py-2 text-right font-medium">
                                        Companies
                                    </th>
                                    <th className="px-4 py-2" />
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {plans.map((p) => (
                                    <tr key={p.id}>
                                        <td className="px-4 py-2.5">
                                            <span className="font-medium">
                                                {p.name}
                                            </span>{' '}
                                            {!p.active && (
                                                <StatusBadge
                                                    tone="neutral"
                                                    label="Hidden"
                                                />
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                {p.key}
                                                {p.description
                                                    ? ` · ${p.description}`
                                                    : ''}
                                            </p>
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                                            {f.taka(p.price)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            {f.num(p.staffLimit)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            {f.num(p.smsLimit)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            {f.num(p.companies)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setEditing(p)}
                                            >
                                                <Pencil className="size-3.5" />
                                                Edit
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            </PageBody>
            {editing && (
                <PlanDialog
                    plan={editing === 'new' ? null : editing}
                    onClose={() => setEditing(null)}
                />
            )}
        </>
    );
}

function PlanDialog({
    plan,
    onClose,
}: {
    plan: Plan | null;
    onClose: () => void;
}) {
    const form = useForm({
        key: plan?.key ?? '',
        name: plan?.name ?? '',
        name_bn: plan?.name_bn ?? '',
        price: String(plan?.price ?? ''),
        staffLimit: String(plan?.staffLimit ?? 10),
        smsLimit: String(plan?.smsLimit ?? 300),
        description: plan?.description ?? '',
        active: plan?.active ?? true,
    });

    return (
        <FormDialog
            open
            wide
            onOpenChange={(o) => !o && onClose()}
            title={plan ? `Edit ${plan.name}` : 'New plan'}
            submitLabel="Save plan"
            disabled={form.processing}
            onSubmit={() => {
                form.post(plan ? update.url(plan.id) : store.url(), {
                    preserveScroll: true,
                    onSuccess: onClose,
                });

                return false;
            }}
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" error={form.errors.name}>
                    <TextInput
                        value={form.data.name}
                        onChange={(v) => form.setData('name', v)}
                        autoFocus
                    />
                </Field>
                <Field label="Name in Bangla" error={form.errors.name_bn}>
                    <TextInput
                        value={form.data.name_bn}
                        onChange={(v) => form.setData('name_bn', v)}
                    />
                </Field>
                <Field
                    label="Key"
                    help={
                        plan
                            ? 'Cannot change: companies use it'
                            : 'e.g. business'
                    }
                    error={form.errors.key}
                >
                    <TextInput
                        value={form.data.key}
                        onChange={(v) =>
                            !plan && form.setData('key', v.toLowerCase())
                        }
                    />
                </Field>
                <Field label="Price per month (৳)" error={form.errors.price}>
                    <TextInput
                        type="number"
                        min={0}
                        value={form.data.price}
                        onChange={(v) => form.setData('price', v)}
                    />
                </Field>
                <Field label="Staff limit" error={form.errors.staffLimit}>
                    <TextInput
                        type="number"
                        min={1}
                        value={form.data.staffLimit}
                        onChange={(v) => form.setData('staffLimit', v)}
                    />
                </Field>
                <Field label="SMS per month" error={form.errors.smsLimit}>
                    <TextInput
                        type="number"
                        min={0}
                        value={form.data.smsLimit}
                        onChange={(v) => form.setData('smsLimit', v)}
                    />
                </Field>
            </div>
            <Field label="Short description" error={form.errors.description}>
                <TextInput
                    value={form.data.description}
                    onChange={(v) => form.setData('description', v)}
                />
            </Field>
            <div className="flex items-center justify-between gap-3 text-sm">
                <span>Companies can choose this plan</span>
                <Switch
                    checked={form.data.active}
                    onChange={(v) => form.setData('active', v)}
                    label="Companies can choose this plan"
                />
            </div>
        </FormDialog>
    );
}

PlatformPlans.layout = {
    breadcrumbs: [{ title: 'Plans & prices', href: plansIndex() }],
};
