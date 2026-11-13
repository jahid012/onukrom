import { Head, router, useForm, usePage } from '@inertiajs/react';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Field, FormDialog, TextInput } from '@/components/admin/dialogs';
import { SelectField } from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { Panel } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { index as teamIndex, store, update } from '@/routes/platform/team';
import { useDate } from '@/components/platform/bits';

type Member = {
    id: number;
    name: string;
    email: string;
    role: 'super_admin' | 'support';
    status: 'active' | 'inactive';
    lastSeen: string | null;
};

const roles = [
    {
        value: 'support',
        label: 'Support — companies, view as owner, tickets',
    },
    {
        value: 'super_admin',
        label: 'Super admin — everything, incl. money and team',
    },
];

export default function PlatformTeam({ members }: { members: Member[] }) {
    const { auth } = usePage().props;
    const date = useDate();
    const [hiring, setHiring] = useState(false);

    return (
        <>
            <Head title="Team" />
            <PageBody>
                <PageHeader
                    title="Team"
                    description="Onukrom staff. Support staff answer tickets and can view a company as its owner; super admins also manage money, plans and the team."
                    actions={
                        <Button size="sm" onClick={() => setHiring(true)}>
                            <UserPlus className="size-3.5" />
                            Add staff
                        </Button>
                    }
                />
                <Panel>
                    <ul className="divide-y">
                        {members.map((m) => (
                            <li
                                key={m.id}
                                className="flex flex-wrap items-center gap-3 px-4 py-3"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block font-medium">
                                        {m.name}
                                        {m.id === auth.user.id && ' (you)'}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                        {m.email} · last seen {date(m.lastSeen)}
                                    </span>
                                </span>
                                <div className="w-64">
                                    <SelectField
                                        value={m.role}
                                        label="Role"
                                        onChange={(role) =>
                                            router.post(
                                                update.url(m.id),
                                                { role, status: m.status },
                                                { preserveScroll: true },
                                            )
                                        }
                                        options={roles}
                                    />
                                </div>
                                <StatusBadge
                                    tone={
                                        m.status === 'active'
                                            ? 'success'
                                            : 'neutral'
                                    }
                                    label={
                                        m.status === 'active'
                                            ? 'Active'
                                            : 'Switched off'
                                    }
                                />
                                {m.id !== auth.user.id && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                            router.post(
                                                update.url(m.id),
                                                {
                                                    role: m.role,
                                                    status:
                                                        m.status === 'active'
                                                            ? 'inactive'
                                                            : 'active',
                                                },
                                                { preserveScroll: true },
                                            )
                                        }
                                    >
                                        {m.status === 'active'
                                            ? 'Switch off'
                                            : 'Switch on'}
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                </Panel>
            </PageBody>
            {hiring && <HireDialog onClose={() => setHiring(false)} />}
        </>
    );
}

function HireDialog({ onClose }: { onClose: () => void }) {
    const form = useForm({ name: '', email: '', role: 'support' });

    return (
        <FormDialog
            open
            onOpenChange={(o) => !o && onClose()}
            title="Add staff"
            description="They sign in at /login with this email. The password is shown once — send it to them privately."
            submitLabel="Add"
            disabled={form.processing}
            onSubmit={() => {
                form.post(store.url(), { onSuccess: onClose });

                return false;
            }}
        >
            <Field label="Full name" error={form.errors.name}>
                <TextInput
                    value={form.data.name}
                    onChange={(v) => form.setData('name', v)}
                    autoFocus
                />
            </Field>
            <Field label="Email" error={form.errors.email}>
                <TextInput
                    type="email"
                    value={form.data.email}
                    onChange={(v) => form.setData('email', v)}
                />
            </Field>
            <Field label="Role" error={form.errors.role}>
                <SelectField
                    value={form.data.role}
                    onChange={(v) => form.setData('role', v)}
                    label="Role"
                    options={roles}
                />
            </Field>
        </FormDialog>
    );
}

PlatformTeam.layout = {
    breadcrumbs: [{ title: 'Team', href: teamIndex() }],
};
