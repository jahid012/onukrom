import { Head, Link, router } from '@inertiajs/react';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { Tabs } from '@/components/admin/tabs';
import { Panel } from '@/components/dashboard/primitives';
import type { Ticket } from '@/components/support/thread';
import { useFormat } from '@/hooks/use-format';
import { useDate } from '@/components/platform/bits';
import { index as supportIndex, show } from '@/routes/platform/support';

type Status = 'open' | 'answered' | 'closed' | 'all';

const statusLabel: Record<Ticket['status'], string> = {
    open: 'Waiting for us',
    answered: 'Waiting for company',
    closed: 'Closed',
};

export default function PlatformSupport({
    status,
    mine,
    tickets,
    counts,
}: {
    status: Status;
    mine: boolean;
    tickets: Ticket[];
    counts: Partial<Record<Exclude<Status, 'all'>, number>>;
}) {
    const date = useDate();
    const { f } = useFormat();
    const go = (next: { status?: Status; mine?: boolean }) =>
        router.get(
            supportIndex.url({
                query: {
                    status: next.status ?? status,
                    ...((next.mine ?? mine) ? { mine: 1 } : {}),
                },
            }),
        );

    return (
        <>
            <Head title="Support" />
            <PageBody>
                <PageHeader
                    title="Support"
                    description="Questions from every company. The oldest waiting ticket is on top; whoever answers first takes it."
                    actions={
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={mine}
                                onChange={(e) => go({ mine: e.target.checked })}
                            />
                            Only mine
                        </label>
                    }
                />
                <Panel>
                    <Tabs
                        className="px-2"
                        value={status}
                        onChange={(v) => go({ status: v })}
                        items={[
                            {
                                value: 'open',
                                label: 'Waiting for us',
                                count: f.num(counts.open ?? 0),
                                tone: 'warning',
                            },
                            {
                                value: 'answered',
                                label: 'Answered',
                                count: f.num(counts.answered ?? 0),
                            },
                            {
                                value: 'closed',
                                label: 'Closed',
                                count: f.num(counts.closed ?? 0),
                            },
                            { value: 'all', label: 'All' },
                        ]}
                    />
                    <ul className="divide-y">
                        {tickets.map((ticket) => (
                            <li key={ticket.id}>
                                <Link
                                    href={show(ticket.id)}
                                    className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium">
                                            {ticket.subject}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            {ticket.company?.name} ·{' '}
                                            {ticket.number} · {ticket.category}{' '}
                                            · {ticket.openedBy} ·{' '}
                                            {date(ticket.lastMessageAt)}
                                        </span>
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {ticket.assignee ?? 'Unassigned'}
                                    </span>
                                    <StatusBadge
                                        tone={
                                            ticket.status === 'open'
                                                ? 'warning'
                                                : ticket.status === 'answered'
                                                  ? 'success'
                                                  : 'neutral'
                                        }
                                        label={statusLabel[ticket.status]}
                                    />
                                </Link>
                            </li>
                        ))}
                        {tickets.length === 0 && (
                            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                                Nothing here.
                            </li>
                        )}
                    </ul>
                </Panel>
            </PageBody>
        </>
    );
}

PlatformSupport.layout = {
    breadcrumbs: [{ title: 'Support', href: supportIndex() }],
};
