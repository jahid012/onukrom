import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Field, FormDialog, TextInput } from '@/components/admin/dialogs';
import { SearchInput, SelectField } from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { Panel } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { CompanyStatus, useDate } from '@/components/platform/bits';
import type { CompanyRow, PlanOption } from '@/components/platform/bits';
import { useFormat } from '@/hooks/use-format';
import {
    index as companiesIndex,
    show,
    store,
} from '@/routes/platform/companies';

export default function CompaniesIndex({
    q,
    companies,
    plans,
}: {
    q: string;
    companies: CompanyRow[];
    plans: PlanOption[];
}) {
    const { f } = useFormat();
    const date = useDate();
    const { auth } = usePage().props;
    const [search, setSearch] = useState(q);
    const [creating, setCreating] = useState(false);
    const isSuper = auth.user.platform_role === 'super_admin';

    return (
        <>
            <Head title="Companies" />
            <PageBody>
                <PageHeader
                    title="Companies"
                    description="Every distributor using Onukrom. Open one to see its staff, invoices and support, or to sign in as its owner."
                    actions={
                        isSuper && (
                            <Button size="sm" onClick={() => setCreating(true)}>
                                <Plus className="size-3.5" />
                                New company
                            </Button>
                        )
                    }
                />
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        router.get(
                            companiesIndex.url({ query: { q: search } }),
                            {},
                            { preserveState: true },
                        );
                    }}
                    className="max-w-sm"
                >
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Search name or code"
                    />
                </form>
                <Panel>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-sm">
                            <thead className="border-b bg-background text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium">
                                        Company
                                    </th>
                                    <th className="px-4 py-2 text-left font-medium">
                                        Plan
                                    </th>
                                    <th className="px-4 py-2 text-right font-medium">
                                        Staff
                                    </th>
                                    <th className="px-4 py-2 text-left font-medium">
                                        Covered until
                                    </th>
                                    <th className="px-4 py-2 text-left font-medium">
                                        Joined
                                    </th>
                                    <th className="px-4 py-2 text-right font-medium">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {companies.map((c) => (
                                    <tr
                                        key={c.id}
                                        className="hover:bg-muted/60"
                                    >
                                        <td className="px-4 py-2.5">
                                            <Link
                                                href={show(c.id)}
                                                className="font-medium hover:underline"
                                            >
                                                {c.name}
                                            </Link>
                                            <p className="text-xs text-muted-foreground">
                                                {c.code}
                                            </p>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {c.planName}
                                            <p className="text-xs text-muted-foreground tabular-nums">
                                                {f.taka(c.price)} / month
                                            </p>
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            {f.num(c.staff ?? 0)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {date(c.coveredUntil)}
                                        </td>
                                        <td className="px-4 py-2.5 text-muted-foreground">
                                            {date(c.createdAt)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <CompanyStatus
                                                status={c.subscription}
                                            />
                                        </td>
                                    </tr>
                                ))}
                                {companies.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-4 py-10 text-center text-muted-foreground"
                                        >
                                            No companies found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            </PageBody>
            {creating && (
                <NewCompany plans={plans} onClose={() => setCreating(false)} />
            )}
        </>
    );
}

function NewCompany({
    plans,
    onClose,
}: {
    plans: PlanOption[];
    onClose: () => void;
}) {
    const form = useForm({
        code: '',
        name: '',
        owner_name: '',
        email: '',
        phone: '',
        plan: plans[0]?.key ?? 'starter',
    });

    return (
        <FormDialog
            open
            wide
            onOpenChange={(o) => !o && onClose()}
            title="New company"
            description="Creates the company with its roles, warehouses and categories, on a 14-day trial. The owner's password is shown once."
            submitLabel="Create company"
            disabled={form.processing}
            onSubmit={() => {
                form.post(store.url(), { onSuccess: onClose });

                return false;
            }}
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Company name" error={form.errors.name}>
                    <TextInput
                        value={form.data.name}
                        onChange={(v) => form.setData('name', v)}
                        autoFocus
                    />
                </Field>
                <Field
                    label="Company code"
                    help="Staff type this in the app"
                    error={form.errors.code}
                >
                    <TextInput
                        value={form.data.code}
                        onChange={(v) =>
                            form.setData(
                                'code',
                                v.toLowerCase().replace(/\s/g, ''),
                            )
                        }
                        placeholder="rahimtraders"
                    />
                </Field>
                <Field label="Owner's name" error={form.errors.owner_name}>
                    <TextInput
                        value={form.data.owner_name}
                        onChange={(v) => form.setData('owner_name', v)}
                    />
                </Field>
                <Field label="Owner's login email" error={form.errors.email}>
                    <TextInput
                        type="email"
                        value={form.data.email}
                        onChange={(v) => form.setData('email', v)}
                    />
                </Field>
                <Field
                    label="Owner's mobile (optional)"
                    error={form.errors.phone}
                >
                    <TextInput
                        type="tel"
                        value={form.data.phone}
                        onChange={(v) => form.setData('phone', v)}
                        placeholder="01XXXXXXXXX"
                    />
                </Field>
                <Field label="Plan" error={form.errors.plan}>
                    <SelectField
                        value={form.data.plan}
                        onChange={(v) => form.setData('plan', v)}
                        label="Plan"
                        options={plans
                            .filter((p) => p.active)
                            .map((p) => ({ value: p.key, label: p.name }))}
                    />
                </Field>
            </div>
        </FormDialog>
    );
}

CompaniesIndex.layout = {
    breadcrumbs: [{ title: 'Companies', href: companiesIndex() }],
};
