import { Head } from '@inertiajs/react';
import { Lock, Plus, Smartphone, Trash2, Undo2, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    ConfirmDialog,
    Field,
    FormDialog,
    TextInput,
} from '@/components/admin/dialogs';
import { SelectField } from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { CountPill, StatusBadge } from '@/components/admin/status-badge';
import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    addRole,
    deleteRole,
    saveRole,
    useAdminData,
} from '@/data/admin/store';
import type { RoleDef } from '@/data/admin/store';
import { permissionGroups } from '@/data/admin/team';
import type { RoleKey } from '@/data/admin/team';
import { useAdmin } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';
import { index as rolesIndex } from '@/routes/roles';

/** Permission keys contain dots, which i18next treats as nesting. */
const permKey = (p: string) => `roles.perm.${p.replace('.', '_')}`;

export default function RolesIndex() {
    const { t, f } = useAdmin();
    const { roles, staff } = useAdminData();
    const [roleKey, setRoleKey] = useState<string>('sr');
    const [draft, setDraft] = useState<Record<string, string[]>>({});
    const [newOpen, setNewOpen] = useState(false);
    const [deleting, setDeleting] = useState<RoleDef | null>(null);
    const role = roles.find((r) => r.key === roleKey) ?? roles[0];
    const locked = role.key === 'owner';
    const grants = new Set(draft[role.key] ?? role.grants);
    const dirty =
        draft[role.key] !== undefined &&
        draft[role.key].join() !== role.grants.join();
    const usesApp = grants.has('app.sales') || grants.has('app.delivery');
    const roleName = (r: RoleDef) => r.name ?? t(`admin.role.${r.key}`);
    const users = (r: RoleDef) =>
        r.builtIn
            ? staff.filter(
                  (s) =>
                      s.roles.includes(r.key as RoleKey) &&
                      s.status !== 'inactive',
              ).length
            : 0;

    const clearDraft = (key: string) =>
        setDraft((d) => {
            const next = { ...d };
            delete next[key];

            return next;
        });

    const toggle = (p: string) => {
        const next = new Set(grants);

        if (next.has(p)) {
            next.delete(p);
        } else {
            next.add(p);
        }

        setDraft((d) => ({ ...d, [role.key]: [...next] }));
    };

    const toggleGroup = (permissions: string[], on: boolean) => {
        const next = new Set(grants);
        permissions.forEach((p) => (on ? next.add(p) : next.delete(p)));
        setDraft((d) => ({ ...d, [role.key]: [...next] }));
    };

    return (
        <>
            <Head title={t('roles.title')} />
            <PageBody>
                <PageHeader
                    title={t('roles.title')}
                    description={t('roles.description')}
                    actions={
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-card"
                            onClick={() => setNewOpen(true)}
                        >
                            <Plus className="size-3.5" />
                            {t('roles.newRole')}
                        </Button>
                    }
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                    <div className="flex flex-col gap-2">
                        {roles.map((r) => (
                            <button
                                key={r.key}
                                type="button"
                                onClick={() => setRoleKey(r.key)}
                                className={cn(
                                    'flex items-center gap-3 rounded-md border bg-card px-4 py-3 text-left transition-colors',
                                    r.key === role.key
                                        ? 'border-primary ring-1 ring-primary'
                                        : 'hover:border-ring/50',
                                )}
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5 font-medium">
                                        {roleName(r)}
                                        {r.key === 'owner' && (
                                            <Lock
                                                className="size-3.5 text-muted-foreground"
                                                aria-hidden
                                            />
                                        )}
                                        {draft[r.key] &&
                                            draft[r.key].join() !==
                                                r.grants.join() && (
                                                <span
                                                    className="size-1.5 rounded-full bg-warning"
                                                    aria-label={t(
                                                        'roles.unsaved',
                                                    )}
                                                />
                                            )}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {t('roles.permissionsCount', {
                                            n: f.num(
                                                (draft[r.key] ?? r.grants)
                                                    .length,
                                            ),
                                        })}
                                    </span>
                                </span>
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Users className="size-3.5" aria-hidden />
                                    {f.num(users(r))}
                                </span>
                            </button>
                        ))}
                        <p className="px-1 pt-1 text-xs text-muted-foreground">
                            {t('roles.multiRoleNote')}
                        </p>
                    </div>

                    <Panel className="lg:col-span-3">
                        <PanelHeader
                            title={t('roles.matrixTitle', {
                                role: roleName(role),
                            })}
                            subtitle={
                                locked
                                    ? t('roles.ownerLocked')
                                    : t('roles.matrixSubtitle')
                            }
                            action={
                                <div className="flex items-center gap-2">
                                    {usesApp ? (
                                        <StatusBadge
                                            tone="info"
                                            label={t('roles.usesApp')}
                                        />
                                    ) : (
                                        <StatusBadge
                                            tone="neutral"
                                            label={t('roles.webOnly')}
                                        />
                                    )}
                                    {!role.builtIn && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="size-8 text-danger-ink"
                                            aria-label={t('roles.delete')}
                                            onClick={() => setDeleting(role)}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    )}
                                </div>
                            }
                        />
                        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2">
                            {permissionGroups.map((g) => {
                                const on = g.permissions.filter((p) =>
                                    grants.has(p),
                                ).length;

                                return (
                                    <fieldset
                                        key={g.key}
                                        className="bg-card px-4 py-3"
                                    >
                                        <legend className="sr-only">
                                            {t(`roles.group.${g.key}`)}
                                        </legend>
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <p className="flex items-center gap-1.5 text-sm font-semibold">
                                                {g.key === 'app' && (
                                                    <Smartphone
                                                        className="size-3.5 text-muted-foreground"
                                                        aria-hidden
                                                    />
                                                )}
                                                {t(`roles.group.${g.key}`)}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                {!locked && (
                                                    <button
                                                        type="button"
                                                        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                                                        onClick={() =>
                                                            toggleGroup(
                                                                g.permissions,
                                                                on <
                                                                    g
                                                                        .permissions
                                                                        .length,
                                                            )
                                                        }
                                                    >
                                                        {on <
                                                        g.permissions.length
                                                            ? t(
                                                                  'roles.selectAll',
                                                              )
                                                            : t(
                                                                  'roles.clearAll',
                                                              )}
                                                    </button>
                                                )}
                                                <CountPill
                                                    value={`${f.num(on)}/${f.num(g.permissions.length)}`}
                                                    tone={
                                                        on
                                                            ? 'primary'
                                                            : 'neutral'
                                                    }
                                                />
                                            </div>
                                        </div>
                                        <ul className="flex flex-col gap-2">
                                            {g.permissions.map((p) => (
                                                <li key={p}>
                                                    <label
                                                        className={cn(
                                                            'flex items-start gap-2.5 text-sm',
                                                            locked
                                                                ? 'cursor-not-allowed opacity-70'
                                                                : 'cursor-pointer',
                                                        )}
                                                    >
                                                        <Checkbox
                                                            className="mt-0.5"
                                                            checked={grants.has(
                                                                p,
                                                            )}
                                                            disabled={locked}
                                                            onCheckedChange={() =>
                                                                toggle(p)
                                                            }
                                                        />
                                                        <span>
                                                            {t(permKey(p))}
                                                            <span
                                                                className="block font-mono text-[11px] text-muted-foreground"
                                                                lang="en"
                                                            >
                                                                {p}
                                                            </span>
                                                        </span>
                                                    </label>
                                                </li>
                                            ))}
                                        </ul>
                                    </fieldset>
                                );
                            })}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3">
                            <p className="mr-auto text-xs text-muted-foreground">
                                {dirty
                                    ? t('roles.unsavedNote')
                                    : t('roles.serverNote')}
                            </p>
                            {dirty && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => clearDraft(role.key)}
                                >
                                    <Undo2 className="size-3.5" />
                                    {t('roles.discard')}
                                </Button>
                            )}
                            <Button
                                size="sm"
                                disabled={locked || !dirty}
                                onClick={() => {
                                    saveRole(role.key, [...grants]);
                                    clearDraft(role.key);
                                    toast.success(
                                        t('roles.toast.saved', {
                                            role: roleName(role),
                                        }),
                                    );
                                }}
                            >
                                {t('admin.actions.save')}
                            </Button>
                        </div>
                    </Panel>
                </div>
            </PageBody>

            {newOpen && (
                <NewRoleDialog
                    roles={roles}
                    roleName={roleName}
                    onClose={() => setNewOpen(false)}
                    onCreated={setRoleKey}
                />
            )}
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(o) => !o && setDeleting(null)}
                title={t('roles.deleteTitle', {
                    role: deleting ? roleName(deleting) : '',
                })}
                description={t('roles.deleteText')}
                confirmLabel={t('roles.delete')}
                destructive
                onConfirm={() => {
                    if (deleting) {
                        deleteRole(deleting.key);
                        setRoleKey('sr');
                        toast.success(
                            t('roles.toast.deleted', {
                                role: roleName(deleting),
                            }),
                        );
                    }
                }}
            />
        </>
    );
}

function NewRoleDialog({
    roles,
    roleName,
    onClose,
    onCreated,
}: {
    roles: RoleDef[];
    roleName: (r: RoleDef) => string;
    onClose: () => void;
    onCreated: (key: string) => void;
}) {
    const { t } = useAdmin();
    const [name, setName] = useState('');
    const [copyFrom, setCopyFrom] = useState('sr');
    const taken = roles.some(
        (r) => roleName(r).toLowerCase() === name.trim().toLowerCase(),
    );

    return (
        <FormDialog
            open
            onOpenChange={(o) => !o && onClose()}
            title={t('roles.newRole')}
            description={t('roles.newDescription')}
            submitLabel={t('roles.newRole')}
            disabled={name.trim() === '' || taken}
            onSubmit={() => {
                const role = name.trim();
                void addRole(role, copyFrom).then((key) => {
                    if (key) {
                        toast.success(t('roles.toast.created', { role }));
                        onCreated(key);
                    }
                });
                onClose();
            }}
        >
            <Field
                label={t('roles.roleName')}
                error={taken ? t('roles.nameTaken') : undefined}
            >
                <TextInput
                    value={name}
                    onChange={setName}
                    placeholder={t('roles.namePlaceholder')}
                    autoFocus
                />
            </Field>
            <Field label={t('roles.copyFrom')}>
                <SelectField
                    value={copyFrom}
                    onChange={setCopyFrom}
                    label={t('roles.copyFrom')}
                    options={roles.map((r) => ({
                        value: r.key,
                        label: roleName(r),
                    }))}
                />
            </Field>
        </FormDialog>
    );
}

RolesIndex.layout = {
    breadcrumbs: [{ title: 'nav.roles', href: rolesIndex() }],
};
