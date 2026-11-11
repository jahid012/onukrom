import { Head } from '@inertiajs/react';
import {
    Ban,
    Copy,
    KeyRound,
    MessageSquareText,
    Pencil,
    Power,
    Smartphone,
    SmartphoneNfc,
    UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Person } from '@/components/admin/bits';
import type { Column } from '@/components/admin/data-table';
import {
    DataTable,
    TableFooter,
    usePaged,
} from '@/components/admin/data-table';
import {
    ConfirmDialog,
    Field,
    FormDialog,
    TextInput,
} from '@/components/admin/dialogs';
import { FilterBar, SearchInput, SelectField } from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { RowMenu } from '@/components/admin/row-menu';
import { StatusBadge } from '@/components/admin/status-badge';
import type { Tone } from '@/components/admin/status-badge';
import { Tabs } from '@/components/admin/tabs';
import { Panel, SyncStatus } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    allRoutesOf,
    inviteStaff,
    resetPassword,
    revokeDevice,
    setStaffStatus,
    updateStaff,
    useAdminData,
} from '@/data/admin/store';
import type { RoleKey, Staff } from '@/data/admin/team';
import { useAdmin } from '@/hooks/use-admin';
import { useQuery } from '@/hooks/use-query';
import { index as staffIndex } from '@/routes/staff';

type Tab = 'field' | 'office' | 'all';

const statusTone: Record<Staff['status'], Tone> = {
    active: 'success',
    invited: 'info',
    inactive: 'neutral',
};
const roleTone: Record<RoleKey, Tone> = {
    owner: 'primary',
    manager: 'primary',
    sr: 'info',
    dm: 'warning',
};
const isField = (s: Staff) => s.roles.some((r) => r === 'sr' || r === 'dm');

export default function StaffIndex() {
    const { t, f } = useAdmin();
    const state = useAdminData();
    const { company } = state;
    const { staff } = state;
    const routes = allRoutesOf(state).map((r) => r.name);
    const [tab, setTab] = useState<Tab>('field');
    const [search, setSearch] = useState(useQuery('q') ?? '');
    const [inviteOpen, setInviteOpen] = useState(false);
    const [editing, setEditing] = useState<Staff | null>(null);
    const [resetting, setResetting] = useState<Staff | null>(null);
    const [revoking, setRevoking] = useState<Staff | null>(null);
    const [password, setPassword] = useState<{
        person: Pick<Staff, 'name' | 'phone'>;
        value: string;
        isNew: boolean;
    } | null>(null);

    const rows = staff.filter((s) => {
        const q = search.trim().toLowerCase();

        return (
            (tab === 'all' || (tab === 'field' ? isField(s) : !isField(s))) &&
            (q === '' ||
                s.name.toLowerCase().includes(q) ||
                s.code.toLowerCase().includes(q) ||
                s.phone.includes(q))
        );
    });
    const paged = usePaged(rows);
    const activeCount = staff.filter((s) => s.status !== 'inactive').length;

    const columns: Column<Staff>[] = [
        {
            key: 'person',
            header: t('staff.columns.person'),
            cell: (s) => (
                <Person name={s.name} sub={`${s.code} · ${s.phone}`} />
            ),
        },
        {
            key: 'roles',
            header: t('staff.columns.roles'),
            cell: (s) => (
                <div className="flex flex-wrap gap-1">
                    {s.roles.map((r) => (
                        <StatusBadge
                            key={r}
                            tone={roleTone[r as RoleKey] ?? 'neutral'}
                            label={t(`admin.role.${r}`)}
                        />
                    ))}
                </div>
            ),
        },
        {
            key: 'areas',
            header: t('staff.columns.areas'),
            cell: (s) =>
                s.areas.length ? (
                    <span className="text-sm text-muted-foreground">
                        {s.areas.join(', ')}
                    </span>
                ) : (
                    <span
                        className={
                            isField(s)
                                ? 'text-xs text-warning-ink'
                                : 'text-xs text-muted-foreground'
                        }
                    >
                        {isField(s) ? t('staff.noAreas') : t('staff.office')}
                    </span>
                ),
        },
        {
            key: 'device',
            header: t('staff.columns.device'),
            cell: (s) =>
                s.device ? (
                    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
                        <Smartphone
                            className="size-3.5 text-muted-foreground"
                            aria-hidden
                        />
                        {s.device.model}
                        <span className="text-xs text-muted-foreground">
                            v{s.device.app}
                        </span>
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        {isField(s) ? t('staff.notLoggedIn') : '—'}
                    </span>
                ),
        },
        {
            key: 'sync',
            header: t('staff.columns.sync'),
            cell: (s) =>
                s.lastSyncMin != null ? (
                    <SyncStatus minutes={s.lastSyncMin} />
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                ),
        },
        {
            key: 'status',
            header: t('staff.columns.status'),
            cell: (s) => (
                <StatusBadge
                    tone={statusTone[s.status]}
                    label={t(`admin.userStatus.${s.status}`)}
                />
            ),
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (s) =>
                s.roles.includes('owner') ? null : (
                    <RowMenu
                        actions={[
                            {
                                label: t('admin.actions.edit'),
                                icon: Pencil,
                                onSelect: () => setEditing(s),
                            },
                            {
                                label: t('staff.reset'),
                                icon: KeyRound,
                                hidden: s.status === 'inactive',
                                onSelect: () => setResetting(s),
                            },
                            {
                                label: t('staff.revoke'),
                                icon: SmartphoneNfc,
                                hidden: !s.device,
                                onSelect: () => setRevoking(s),
                            },
                            {
                                label: t('staff.deactivate'),
                                icon: Ban,
                                danger: true,
                                hidden: s.status === 'inactive',
                                onSelect: () => {
                                    setStaffStatus(s.code, 'inactive');
                                    revokeDevice(s.code);
                                    toast.success(
                                        t('staff.toast.deactivated', {
                                            name: s.name,
                                        }),
                                    );
                                },
                            },
                            {
                                label: t('staff.activate'),
                                icon: Power,
                                hidden: s.status !== 'inactive',
                                onSelect: () => {
                                    setStaffStatus(s.code, 'active');
                                    toast.success(
                                        t('staff.toast.activated', {
                                            name: s.name,
                                        }),
                                    );
                                },
                            },
                        ]}
                    />
                ),
        },
    ];

    return (
        <>
            <Head title={t('staff.title')} />
            <PageBody>
                <PageHeader
                    title={t('staff.title')}
                    description={t('staff.description')}
                    actions={
                        <Button
                            size="sm"
                            onClick={() => setInviteOpen(true)}
                            disabled={activeCount >= company.staffLimit}
                        >
                            <UserPlus className="size-3.5" />
                            {t('staff.invite')}
                        </Button>
                    }
                />

                <Panel>
                    <Tabs
                        className="px-2"
                        value={tab}
                        onChange={setTab}
                        items={[
                            {
                                value: 'field',
                                label: t('staff.tabs.field'),
                                count: f.num(staff.filter(isField).length),
                            },
                            {
                                value: 'office',
                                label: t('staff.tabs.office'),
                                count: f.num(
                                    staff.filter((s) => !isField(s)).length,
                                ),
                            },
                            {
                                value: 'all',
                                label: t('staff.tabs.all'),
                                count: f.num(staff.length),
                            },
                        ]}
                    />
                    <FilterBar>
                        <SearchInput
                            className="sm:w-72"
                            value={search}
                            onChange={setSearch}
                            placeholder={t('staff.search')}
                        />
                        <p className="text-xs text-muted-foreground sm:ml-auto">
                            {t('staff.seats', {
                                used: f.num(activeCount),
                                limit: f.num(company.staffLimit),
                            })}
                        </p>
                    </FilterBar>
                    <DataTable
                        columns={columns}
                        rows={paged.rows}
                        rowKey={(s) => s.code}
                        minWidth={1060}
                    />
                    <TableFooter paged={paged} />
                </Panel>
            </PageBody>

            {inviteOpen && (
                <StaffDialog
                    person={null}
                    routes={routes}
                    onClose={() => setInviteOpen(false)}
                    onInvited={(person, value) =>
                        setPassword({ person, value, isNew: true })
                    }
                />
            )}
            {editing && (
                <StaffDialog
                    person={editing}
                    routes={routes}
                    onClose={() => setEditing(null)}
                />
            )}
            <ConfirmDialog
                open={resetting !== null}
                onOpenChange={(o) => !o && setResetting(null)}
                title={t('staff.resetDialog.title', {
                    name: resetting?.name ?? '',
                })}
                description={t('staff.resetDialog.description')}
                confirmLabel={t('staff.reset')}
                onConfirm={() => {
                    if (resetting) {
                        const person = resetting;
                        void resetPassword(person.code).then((value) => {
                            if (value) {
                                setPassword({ person, value, isNew: false });
                            }
                        });
                    }
                }}
            />
            <ConfirmDialog
                open={revoking !== null}
                onOpenChange={(o) => !o && setRevoking(null)}
                title={t('staff.revokeDialog.title', {
                    name: revoking?.name ?? '',
                })}
                description={t('staff.revokeDialog.description')}
                confirmLabel={t('staff.revoke')}
                destructive
                onConfirm={() => {
                    if (revoking) {
                        revokeDevice(revoking.code);
                        toast.success(
                            t('staff.toast.revoked', { name: revoking.name }),
                        );
                    }
                }}
            />
            {password && (
                <PasswordOnceDialog
                    {...password}
                    onClose={() => setPassword(null)}
                />
            )}
        </>
    );
}

/** Invite (person = null) or edit a staff member. */
function StaffDialog({
    person,
    routes,
    onClose,
    onInvited,
}: {
    person: Staff | null;
    routes: string[];
    onClose: () => void;
    onInvited?: (
        person: Pick<Staff, 'name' | 'phone'>,
        password: string,
    ) => void;
}) {
    const { t } = useAdmin();
    const { staff } = useAdminData();
    const [form, setForm] = useState({
        name: person?.name ?? '',
        phone: person?.phone ?? '',
        code: person?.code ?? '',
        role: (person?.roles[0] ?? 'sr') as RoleKey,
        alsoDm: person?.roles.includes('dm') && person.roles[0] !== 'dm',
        areas: person?.areas ?? [],
    });
    const [touched, setTouched] = useState(false);
    const phoneOk = /^01\d{3}-?\d{6}$/.test(form.phone.trim());
    const codeTaken =
        !person &&
        staff.some(
            (s) => s.code.toLowerCase() === form.code.trim().toLowerCase(),
        );
    const field = form.role === 'sr' || form.role === 'dm';
    const errors = {
        name: !form.name.trim() ? t('admin.form.required') : undefined,
        phone: !phoneOk ? t('admin.form.phone') : undefined,
        code: !form.code.trim()
            ? t('admin.form.required')
            : codeTaken
              ? t('staff.form.codeTaken')
              : undefined,
    };

    const toggleArea = (r: string) =>
        setForm((prev) => ({
            ...prev,
            areas: prev.areas.includes(r)
                ? prev.areas.filter((x) => x !== r)
                : [...prev.areas, r],
        }));

    return (
        <FormDialog
            open
            onOpenChange={(o) => !o && onClose()}
            wide
            title={
                person
                    ? t('staff.form.editTitle', { name: person.name })
                    : t('staff.inviteDialog.title')
            }
            description={
                person ? undefined : t('staff.inviteDialog.description')
            }
            submitLabel={
                person ? t('admin.actions.save') : t('staff.inviteDialog.send')
            }
            onSubmit={() => {
                setTouched(true);

                if (Object.values(errors).some(Boolean)) {
                    return false;
                }

                const roles: RoleKey[] =
                    form.role === 'sr' && form.alsoDm
                        ? ['sr', 'dm']
                        : [form.role];
                const input = {
                    name: form.name.trim(),
                    phone: form.phone.trim(),
                    code: form.code.trim().toUpperCase(),
                    roles,
                    areas: field ? form.areas : [],
                };

                if (person) {
                    updateStaff(person.code, input);
                    toast.success(
                        t('staff.toast.updated', { name: input.name }),
                    );
                } else {
                    void inviteStaff(input).then((password) => {
                        if (password) {
                            onInvited?.(input, password);
                        }
                    });
                }
            }}
        >
            <div className="grid gap-4 sm:grid-cols-3">
                <Field
                    label={t('auth.name')}
                    error={touched ? errors.name : undefined}
                >
                    <TextInput
                        value={form.name}
                        onChange={(v) => setForm({ ...form, name: v })}
                        autoFocus
                    />
                </Field>
                <Field
                    label={t('staff.inviteDialog.phone')}
                    help="01XXX-XXXXXX"
                    error={touched ? errors.phone : undefined}
                >
                    <TextInput
                        type="tel"
                        value={form.phone}
                        onChange={(v) => setForm({ ...form, phone: v })}
                        inputMode="tel"
                    />
                </Field>
                <Field
                    label={t('staff.inviteDialog.code')}
                    error={touched ? errors.code : undefined}
                >
                    <TextInput
                        value={form.code}
                        onChange={(v) => setForm({ ...form, code: v })}
                        placeholder="SR22"
                    />
                </Field>
            </div>
            <Field
                label={t('staff.inviteDialog.role')}
                help={field ? t('staff.form.appUser') : t('staff.form.webUser')}
            >
                <SelectField
                    value={form.role}
                    onChange={(v) => setForm({ ...form, role: v as RoleKey })}
                    label={t('staff.inviteDialog.role')}
                    options={(['sr', 'dm', 'manager'] as const).map((r) => ({
                        value: r,
                        label: t(`admin.role.${r}`),
                    }))}
                />
            </Field>
            {form.role === 'sr' && (
                <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                        checked={form.alsoDm}
                        onCheckedChange={(v) =>
                            setForm({ ...form, alsoDm: v === true })
                        }
                    />
                    {t('staff.form.alsoDm')}
                </label>
            )}
            {field && (
                <Field
                    label={t('staff.form.routes')}
                    help={t('staff.form.routesHelp')}
                >
                    <div className="flex flex-wrap gap-1.5">
                        {routes.map((r) => (
                            <button
                                key={r}
                                type="button"
                                aria-pressed={form.areas.includes(r)}
                                onClick={() => toggleArea(r)}
                                className={
                                    form.areas.includes(r)
                                        ? 'rounded-full border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground'
                                        : 'rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground'
                                }
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </Field>
            )}
        </FormDialog>
    );
}

/** Shows a generated password once + the SMS that is sent (spec §4.1). */
function PasswordOnceDialog({
    person,
    value,
    isNew,
    onClose,
}: {
    person: Pick<Staff, 'name' | 'phone'>;
    value: string;
    isNew: boolean;
    onClose: () => void;
}) {
    const { t } = useAdmin();
    const { company } = useAdminData();
    const sms = t(isNew ? 'staff.inviteDialog.sms' : 'staff.resetDialog.sms', {
        company: company.name,
        code: company.code,
        phone: person.phone,
        password: value,
    });

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogTitle>
                    {isNew
                        ? t('staff.inviteDialog.doneTitle')
                        : t('staff.resetDialog.doneTitle')}
                </DialogTitle>
                <DialogDescription>
                    {isNew
                        ? t('staff.inviteDialog.doneDescription', {
                              name: person.name,
                          })
                        : t('staff.resetDialog.doneDescription', {
                              name: person.name,
                          })}
                </DialogDescription>
                <div className="grid gap-3">
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-accent px-4 py-3">
                        <div>
                            <p className="text-xs text-accent-foreground">
                                {t('staff.inviteDialog.password')}
                            </p>
                            <p className="font-mono text-xl font-semibold tracking-widest">
                                {value}
                            </p>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-card"
                            onClick={() => {
                                void navigator.clipboard?.writeText(value);
                                toast.success(t('staff.inviteDialog.copied'));
                            }}
                        >
                            <Copy className="size-3.5" />
                            {t('staff.inviteDialog.copy')}
                        </Button>
                    </div>
                    <p className="text-xs text-warning-ink">
                        {t('staff.inviteDialog.once')}
                    </p>
                    <div className="rounded-md border bg-muted p-3">
                        <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MessageSquareText
                                className="size-3.5"
                                aria-hidden
                            />
                            {t('staff.inviteDialog.smsTitle', {
                                phone: person.phone,
                            })}
                        </p>
                        <p className="text-sm whitespace-pre-line" lang="en">
                            {sms}
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={onClose}>{t('common.close')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

StaffIndex.layout = {
    breadcrumbs: [{ title: 'nav.staff', href: staffIndex() }],
};
