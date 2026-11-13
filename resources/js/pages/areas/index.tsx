import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    ChevronDown,
    MapPinned,
    Pencil,
    Plus,
    Route as RouteIcon,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Person, Stack } from '@/components/admin/bits';
import {
    ConfirmDialog,
    Field,
    FormDialog,
    TextInput,
} from '@/components/admin/dialogs';
import { SelectField } from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { Meter, Panel, PanelHeader } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import type { Day, Route } from '@/data/admin/customers';
import {
    addArea,
    addAreaInNewZone,
    allRoutesOf,
    deleteRoute,
    saveRoute,
    useAdminData,
} from '@/data/admin/store';
import { useAdmin } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';
import { index as areasIndex } from '@/routes/areas';
import { index as shopsIndex } from '@/routes/shops';

const week: Day[] = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

/** Select value for "create a new zone" in the add-area dialog. */
const NEW_ZONE = '__new';

export default function AreasIndex() {
    const { t, f, name } = useAdmin();
    const state = useAdminData();
    const { zones, shops, staff } = state;
    const routes = allRoutesOf(state);
    const [routeId, setRouteId] = useState(routes[0]?.id ?? '');
    const [open, setOpen] = useState<Set<string>>(
        new Set(zones.flatMap((z) => z.areas.map((a) => a.id))),
    );
    const [areaDialog, setAreaDialog] = useState(false);
    const [routeDialog, setRouteDialog] = useState<{
        route: Route | null;
        areaId: string;
    } | null>(null);
    const [deleting, setDeleting] = useState<Route | null>(null);
    const route = routes.find((r) => r.id === routeId) ?? routes[0];
    const firstArea = zones.flatMap((z) => z.areas)[0];
    const areaOf = (id: string) =>
        zones
            .flatMap((z) => z.areas)
            .find((a) => a.routes.some((r) => r.id === id));
    const routeShops = route ? shops.filter((s) => s.route === route.name) : [];
    const shopCount = (r: Route) =>
        Math.max(r.shops, shops.filter((s) => s.route === r.name).length);
    const visitedToday = route ? Math.round(shopCount(route) * 0.68) : 0;
    const staffName = (code?: string) =>
        staff.find((s) => s.code === code)?.name;

    const toggle = (id: string) =>
        setOpen((prev) => {
            const next = new Set(prev);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });

    return (
        <>
            <Head title={t('areas.title')} />
            <PageBody>
                <PageHeader
                    title={t('areas.title')}
                    description={t('areas.description')}
                    actions={
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-card"
                                onClick={() => setAreaDialog(true)}
                            >
                                <Plus className="size-3.5" />
                                {t('areas.addArea')}
                            </Button>
                            <Button
                                size="sm"
                                disabled={firstArea === undefined}
                                title={
                                    firstArea === undefined
                                        ? t('areas.needArea')
                                        : undefined
                                }
                                onClick={() =>
                                    firstArea &&
                                    setRouteDialog({
                                        route: null,
                                        areaId: firstArea.id,
                                    })
                                }
                            >
                                <Plus className="size-3.5" />
                                {t('areas.addRoute')}
                            </Button>
                        </>
                    }
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                    <Panel className="lg:col-span-2" tour="areas-tree">
                        <PanelHeader
                            title={t('areas.treeTitle')}
                            subtitle={t('areas.treeSubtitle')}
                        />
                        <div className="flex flex-col py-2">
                            {zones.length === 0 && (
                                <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                                    <p className="text-sm text-muted-foreground">
                                        {t('areas.empty')}
                                    </p>
                                    <Button
                                        size="sm"
                                        onClick={() => setAreaDialog(true)}
                                    >
                                        <Plus className="size-3.5" />
                                        {t('areas.addArea')}
                                    </Button>
                                </div>
                            )}
                            {zones.map((zone) => (
                                <div key={zone.id}>
                                    <p className="px-4 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                        {t('areas.zone')} · {zone.name}
                                    </p>
                                    {zone.areas.map((area) => {
                                        const isOpen = open.has(area.id);

                                        return (
                                            <div key={area.id}>
                                                <div className="flex items-center hover:bg-muted">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            toggle(area.id)
                                                        }
                                                        aria-expanded={isOpen}
                                                        className="flex flex-1 items-center gap-2 py-2 pl-4 text-left text-sm"
                                                    >
                                                        <ChevronDown
                                                            className={cn(
                                                                'size-4 text-muted-foreground transition-transform',
                                                                !isOpen &&
                                                                    '-rotate-90',
                                                            )}
                                                            aria-hidden
                                                        />
                                                        <MapPinned
                                                            className="size-4 text-muted-foreground"
                                                            aria-hidden
                                                        />
                                                        <span className="font-medium">
                                                            {area.name}
                                                        </span>
                                                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                                                            {t(
                                                                'areas.routesShops',
                                                                {
                                                                    routes: f.num(
                                                                        area
                                                                            .routes
                                                                            .length,
                                                                    ),
                                                                    shops: f.num(
                                                                        area.routes.reduce(
                                                                            (
                                                                                s,
                                                                                r,
                                                                            ) =>
                                                                                s +
                                                                                shopCount(
                                                                                    r,
                                                                                ),
                                                                            0,
                                                                        ),
                                                                    ),
                                                                },
                                                            )}
                                                        </span>
                                                    </button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="mr-2 size-7"
                                                        aria-label={t(
                                                            'areas.addRouteTo',
                                                            { area: area.name },
                                                        )}
                                                        onClick={() =>
                                                            setRouteDialog({
                                                                route: null,
                                                                areaId: area.id,
                                                            })
                                                        }
                                                    >
                                                        <Plus className="size-3.5" />
                                                    </Button>
                                                </div>
                                                {isOpen &&
                                                    area.routes.length ===
                                                        0 && (
                                                        <p className="py-2 pr-4 pl-12 text-xs text-muted-foreground">
                                                            {t(
                                                                'areas.noRoutes',
                                                            )}
                                                        </p>
                                                    )}
                                                {isOpen &&
                                                    area.routes.map((r) => (
                                                        <button
                                                            key={r.id}
                                                            type="button"
                                                            onClick={() =>
                                                                setRouteId(r.id)
                                                            }
                                                            className={cn(
                                                                'flex w-full items-center gap-2 py-2 pr-4 pl-12 text-left text-sm',
                                                                r.id ===
                                                                    route?.id
                                                                    ? 'bg-accent font-medium text-accent-foreground'
                                                                    : 'hover:bg-muted',
                                                            )}
                                                        >
                                                            <RouteIcon
                                                                className="size-3.5"
                                                                aria-hidden
                                                            />
                                                            {r.name}
                                                            {!r.sr && (
                                                                <span className="text-[10px] text-warning-ink">
                                                                    ·{' '}
                                                                    {t(
                                                                        'areas.noSr',
                                                                    )}
                                                                </span>
                                                            )}
                                                            <span className="ml-auto flex gap-0.5">
                                                                {r.visitDays.map(
                                                                    (d) => (
                                                                        <span
                                                                            key={
                                                                                d
                                                                            }
                                                                            className="rounded-sm bg-muted px-1 text-[10px] text-muted-foreground"
                                                                        >
                                                                            {t(
                                                                                `admin.day.${d}`,
                                                                            )}
                                                                        </span>
                                                                    ),
                                                                )}
                                                            </span>
                                                        </button>
                                                    ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </Panel>

                    {route && (
                        <div className="flex min-w-0 flex-col gap-4 lg:col-span-3">
                            <Panel>
                                <PanelHeader
                                    title={route.name}
                                    subtitle={`${areaOf(route.id)?.name ?? ''} · ${t('areas.routeCode', { code: route.code })}`}
                                    action={
                                        <div className="flex gap-1">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="bg-card"
                                                onClick={() =>
                                                    setRouteDialog({
                                                        route,
                                                        areaId:
                                                            areaOf(route.id)
                                                                ?.id ?? '',
                                                    })
                                                }
                                            >
                                                <Pencil className="size-3.5" />
                                                {t('admin.actions.edit')}
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="size-8 text-danger-ink"
                                                aria-label={t('areas.delete')}
                                                onClick={() =>
                                                    setDeleting(route)
                                                }
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    }
                                />
                                <div className="flex flex-col gap-2 border-b px-4 py-3">
                                    <p className="text-xs text-muted-foreground">
                                        {t('areas.visitDays')}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {week.map((d) => (
                                            <span
                                                key={d}
                                                className={cn(
                                                    'rounded-md border px-2.5 py-1 text-xs font-medium',
                                                    route.visitDays.includes(d)
                                                        ? 'border-primary bg-primary text-primary-foreground'
                                                        : 'bg-card text-muted-foreground',
                                                )}
                                            >
                                                {t(`admin.day.${d}`)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
                                    <Assignee
                                        label={t('areas.sr')}
                                        code={route.sr ?? undefined}
                                        name={staffName(route.sr ?? undefined)}
                                        empty={t('areas.unassigned')}
                                    />
                                    <Assignee
                                        label={t('areas.dm')}
                                        code={route.dm ?? undefined}
                                        name={staffName(route.dm ?? undefined)}
                                        empty={t('areas.unassigned')}
                                    />
                                </div>
                                <div className="border-t px-4 py-3">
                                    <div className="mb-1.5 flex justify-between text-sm">
                                        <span className="text-muted-foreground">
                                            {t('areas.visitedToday')}
                                        </span>
                                        <span className="font-medium tabular-nums">
                                            {f.num(visitedToday)} /{' '}
                                            {f.num(shopCount(route))}
                                        </span>
                                    </div>
                                    <Meter
                                        value={visitedToday}
                                        max={Math.max(1, shopCount(route))}
                                        label={t('areas.visitedToday')}
                                    />
                                </div>
                            </Panel>

                            <Panel>
                                <PanelHeader
                                    title={t('areas.shopsTitle')}
                                    subtitle={t('areas.shopsSubtitle', {
                                        n: f.num(shopCount(route)),
                                    })}
                                    action={
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            asChild
                                        >
                                            <Link
                                                href={shopsIndex({
                                                    query: {
                                                        route: route.name,
                                                    },
                                                })}
                                            >
                                                {t('areas.viewShops')}
                                                <ArrowRight className="size-3.5" />
                                            </Link>
                                        </Button>
                                    }
                                />
                                {routeShops.length === 0 ? (
                                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                                        {t('areas.noShopsDemo')}
                                    </p>
                                ) : (
                                    <ul className="divide-y">
                                        {routeShops.map((s) => (
                                            <li
                                                key={s.id}
                                                className="flex items-center justify-between gap-3 px-4 py-2.5"
                                            >
                                                <Stack
                                                    main={name(s)}
                                                    sub={`${s.owner} · ${s.phone}`}
                                                />
                                                <span className="text-right text-xs text-muted-foreground tabular-nums">
                                                    {f.taka(s.due)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Panel>
                        </div>
                    )}
                </div>
            </PageBody>

            {areaDialog && <AreaDialog onClose={() => setAreaDialog(false)} />}
            {routeDialog && (
                <RouteDialog
                    route={routeDialog.route}
                    areaId={routeDialog.areaId}
                    onClose={() => setRouteDialog(null)}
                    onSaved={(id) => setRouteId(id)}
                />
            )}
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(o) => !o && setDeleting(null)}
                title={t('areas.deleteTitle', { route: deleting?.name ?? '' })}
                description={t('areas.deleteText')}
                confirmLabel={t('areas.delete')}
                destructive
                onConfirm={() => {
                    if (deleting) {
                        deleteRoute(deleting.id);
                        toast.success(
                            t('areas.toast.deleted', { route: deleting.name }),
                        );
                        setRouteId(
                            routes.find((r) => r.id !== deleting.id)?.id ?? '',
                        );
                    }
                }}
            />
        </>
    );
}

function Assignee({
    label,
    code,
    name,
    empty,
}: {
    label: string;
    code?: string;
    name?: string;
    empty: string;
}) {
    return (
        <div className="flex flex-col gap-2 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            {code && name ? (
                <Person name={name} sub={code} />
            ) : (
                <p className="text-sm font-medium text-warning-ink">{empty}</p>
            )}
        </div>
    );
}

function AreaDialog({ onClose }: { onClose: () => void }) {
    const { t } = useAdmin();
    const { zones } = useAdminData();
    // A company starts with no zones: then the area's zone is made here too.
    const [zone, setZone] = useState(zones[0]?.id ?? NEW_ZONE);
    const [zoneName, setZoneName] = useState('');
    const [name, setName] = useState('');
    const isNew = zone === NEW_ZONE;

    return (
        <FormDialog
            open
            onOpenChange={(o) => !o && onClose()}
            title={t('areas.addArea')}
            submitLabel={t('areas.addArea')}
            disabled={name.trim() === '' || (isNew && zoneName.trim() === '')}
            onSubmit={() => {
                if (isNew) {
                    addAreaInNewZone(zoneName.trim(), name.trim());
                } else {
                    addArea(zone, name.trim());
                }

                toast.success(
                    t('areas.toast.areaAdded', { area: name.trim() }),
                );
                onClose();
            }}
        >
            <Field label={t('areas.zone')}>
                <SelectField
                    value={zone}
                    onChange={setZone}
                    label={t('areas.zone')}
                    options={[
                        ...zones.map((z) => ({ value: z.id, label: z.name })),
                        { value: NEW_ZONE, label: t('areas.newZone') },
                    ]}
                />
            </Field>
            {isNew && (
                <Field label={t('areas.zoneName')}>
                    <TextInput
                        value={zoneName}
                        onChange={setZoneName}
                        placeholder="Dhaka North"
                        autoFocus
                    />
                </Field>
            )}
            <Field label={t('areas.areaName')}>
                <TextInput
                    value={name}
                    onChange={setName}
                    placeholder="Savar"
                    autoFocus={!isNew}
                />
            </Field>
        </FormDialog>
    );
}

function RouteDialog({
    route,
    areaId,
    onClose,
    onSaved,
}: {
    route: Route | null;
    areaId: string;
    onClose: () => void;
    onSaved: (id: string) => void;
}) {
    const { t } = useAdmin();
    const { zones, staff } = useAdminData();
    const areas = zones.flatMap((z) =>
        z.areas.map((a) => ({ value: a.id, label: `${z.name} · ${a.name}` })),
    );
    const [form, setForm] = useState({
        area: areaId || areas[0].value,
        name: route?.name ?? '',
        code: route?.code ?? '',
        visitDays: route?.visitDays ?? (['sat', 'tue'] as Day[]),
        sr: route?.sr ?? '',
        dm: route?.dm ?? '',
    });
    const active = staff.filter((s) => s.status !== 'inactive');
    const people = (role: 'sr' | 'dm') => [
        { value: '', label: t('areas.unassigned') },
        ...active
            .filter((s) => s.roles.includes(role))
            .map((s) => ({ value: s.code, label: `${s.name} (${s.code})` })),
    ];

    const toggleDay = (d: Day) =>
        setForm((prev) => ({
            ...prev,
            visitDays: prev.visitDays.includes(d)
                ? prev.visitDays.filter((x) => x !== d)
                : week.filter((x) => x === d || prev.visitDays.includes(x)),
        }));

    return (
        <FormDialog
            open
            onOpenChange={(o) => !o && onClose()}
            title={route ? t('areas.editRoute') : t('areas.addRoute')}
            submitLabel={route ? t('admin.actions.save') : t('areas.addRoute')}
            disabled={
                form.name.trim() === '' ||
                form.code.trim() === '' ||
                form.visitDays.length === 0
            }
            onSubmit={() => {
                const routeName = form.name.trim();
                void saveRoute(form.area, route?.id ?? null, {
                    name: routeName,
                    code: form.code.trim().toUpperCase(),
                    visitDays: form.visitDays,
                    sr: form.sr || undefined,
                    dm: form.dm || undefined,
                }).then((id) => {
                    if (id) {
                        toast.success(
                            t(
                                route
                                    ? 'areas.toast.routeSaved'
                                    : 'areas.toast.routeAdded',
                                { route: routeName },
                            ),
                        );
                        onSaved(id);
                    }
                });
                onClose();
            }}
        >
            <Field label={t('areas.area')}>
                <SelectField
                    value={form.area}
                    onChange={(v) => setForm({ ...form, area: v })}
                    label={t('areas.area')}
                    options={areas}
                />
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label={t('areas.routeName')}>
                    <TextInput
                        value={form.name}
                        onChange={(v) => setForm({ ...form, name: v })}
                        autoFocus
                    />
                </Field>
                <Field label={t('areas.code')}>
                    <TextInput
                        value={form.code}
                        onChange={(v) => setForm({ ...form, code: v })}
                        placeholder="MR-10"
                    />
                </Field>
            </div>
            <Field label={t('areas.visitDays')} help={t('areas.visitDaysHelp')}>
                <div className="flex flex-wrap gap-1.5">
                    {week.map((d) => (
                        <button
                            key={d}
                            type="button"
                            aria-pressed={form.visitDays.includes(d)}
                            onClick={() => toggleDay(d)}
                            className={cn(
                                'rounded-md border px-2.5 py-1 text-xs font-medium',
                                form.visitDays.includes(d)
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'bg-card text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {t(`admin.day.${d}`)}
                        </button>
                    ))}
                </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label={t('areas.sr')}>
                    <SelectField
                        value={form.sr}
                        onChange={(v) => setForm({ ...form, sr: v })}
                        label={t('areas.sr')}
                        options={people('sr')}
                    />
                </Field>
                <Field label={t('areas.dm')}>
                    <SelectField
                        value={form.dm}
                        onChange={(v) => setForm({ ...form, dm: v })}
                        label={t('areas.dm')}
                        options={people('dm')}
                    />
                </Field>
            </div>
        </FormDialog>
    );
}

AreasIndex.layout = {
    breadcrumbs: [{ title: 'nav.areas', href: areasIndex() }],
};
