import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Eye } from 'lucide-react';
import { SelectField } from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { TicketThread } from '@/components/support/thread';
import type { Ticket } from '@/components/support/thread';
import { Button } from '@/components/ui/button';
import { impersonate, show as companyShow } from '@/routes/platform/companies';
import {
    index as supportIndex,
    reply,
    update,
} from '@/routes/platform/support';

export default function PlatformTicket({
    ticket,
    team,
}: {
    ticket: Ticket;
    team: { id: number; name: string }[];
}) {
    const save = (data: { assigned_to?: number | null; status?: string }) =>
        router.post(update.url(ticket.id), data, { preserveScroll: true });

    return (
        <>
            <Head title={ticket.subject} />
            <PageBody>
                <Link
                    href={supportIndex()}
                    className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    All tickets
                </Link>
                <PageHeader
                    title={ticket.subject}
                    description={`${ticket.number} · ${ticket.category} · opened by ${ticket.openedBy ?? '—'}`}
                    actions={
                        <StatusBadge
                            tone={
                                ticket.status === 'open'
                                    ? 'warning'
                                    : ticket.status === 'answered'
                                      ? 'success'
                                      : 'neutral'
                            }
                            label={ticket.status}
                        />
                    }
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        <TicketThread
                            ticket={ticket}
                            side="platform"
                            replyUrl={reply.url(ticket.id)}
                            labels={{
                                placeholder: 'Write your answer…',
                                send: 'Send reply',
                                closed: 'This ticket is closed; replying opens it as answered.',
                            }}
                            extraField={({ close, set }) => (
                                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <input
                                        type="checkbox"
                                        checked={close}
                                        onChange={(e) => set(e.target.checked)}
                                    />
                                    Close after sending
                                </label>
                            )}
                        />
                    </div>
                    <div className="flex flex-col gap-3">
                        {ticket.company && (
                            <div className="flex flex-col gap-2 rounded-md border bg-card p-4">
                                <p className="text-xs text-muted-foreground">
                                    Company
                                </p>
                                <Link
                                    href={companyShow(ticket.company.id)}
                                    className="font-medium hover:underline"
                                >
                                    {ticket.company.name}
                                </Link>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        router.post(
                                            impersonate.url(ticket.company!.id),
                                        )
                                    }
                                >
                                    <Eye className="size-3.5" />
                                    View as owner
                                </Button>
                            </div>
                        )}
                        <div className="flex flex-col gap-2 rounded-md border bg-card p-4">
                            <p className="text-xs text-muted-foreground">
                                Assigned to
                            </p>
                            <SelectField
                                value={String(ticket.assignedTo ?? '')}
                                label="Assigned to"
                                onChange={(v) =>
                                    save({ assigned_to: v ? Number(v) : null })
                                }
                                options={[
                                    { value: '', label: 'Nobody' },
                                    ...team.map((m) => ({
                                        value: String(m.id),
                                        label: m.name,
                                    })),
                                ]}
                            />
                            <p className="mt-2 text-xs text-muted-foreground">
                                Status
                            </p>
                            <SelectField
                                value={ticket.status}
                                label="Status"
                                onChange={(v) => save({ status: v })}
                                options={[
                                    { value: 'open', label: 'Waiting for us' },
                                    {
                                        value: 'answered',
                                        label: 'Waiting for company',
                                    },
                                    { value: 'closed', label: 'Closed' },
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </PageBody>
        </>
    );
}

PlatformTicket.layout = {
    breadcrumbs: [{ title: 'Support', href: supportIndex() }],
};
