import { Head, Link } from '@inertiajs/react';
import {
    AlertTriangle,
    Banknote,
    Building2,
    Clock,
    CreditCard,
    LifeBuoy,
    Users,
} from 'lucide-react';
import { MiniStat } from '@/components/admin/bits';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import type { Ticket } from '@/components/support/thread';
import { useFormat } from '@/hooks/use-format';
import { dashboard } from '@/routes/platform';
import { show as companyShow } from '@/routes/platform/companies';
import { index as invoicesIndex } from '@/routes/platform/invoices';
import { show as ticketShow } from '@/routes/platform/support';
import { CompanyStatus } from '@/components/platform/bits';
import type { CompanyRow } from '@/components/platform/bits';

export default function PlatformDashboard({
    stats,
    recent,
    tickets,
}: {
    stats: {
        companies: number;
        active: number;
        trial: number;
        pastDue: number;
        suspended: number;
        mrr: number;
        staff: number;
        openTickets: number;
        paymentsToCheck: number;
    };
    recent: CompanyRow[];
    tickets: Ticket[];
}) {
    const { f } = useFormat();

    return (
        <>
            <Head title="Platform" />
            <PageBody>
                <PageHeader
                    title="Platform overview"
                    description="Every company on Onukrom: subscriptions, money and support."
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MiniStat
                        icon={Banknote}
                        label="Monthly revenue (paying)"
                        value={f.taka(stats.mrr)}
                        note={`${f.num(stats.active)} paying companies`}
                        tone="success"
                    />
                    <MiniStat
                        icon={Building2}
                        label="Companies"
                        value={f.num(stats.companies)}
                        note={`${f.num(stats.trial)} on trial`}
                    />
                    <MiniStat
                        icon={AlertTriangle}
                        label="Overdue / suspended"
                        value={`${f.num(stats.pastDue)} / ${f.num(stats.suspended)}`}
                        tone={stats.pastDue > 0 ? 'warning' : 'neutral'}
                    />
                    <MiniStat
                        icon={Users}
                        label="Staff using Onukrom"
                        value={f.num(stats.staff)}
                    />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Panel>
                        <PanelHeader
                            title="Needs attention"
                            subtitle="Payments to check and questions waiting"
                        />
                        <ul className="divide-y">
                            <li>
                                <Link
                                    href={invoicesIndex({
                                        query: { status: 'submitted' },
                                    })}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted"
                                >
                                    <CreditCard className="size-4 text-muted-foreground" />
                                    <span className="flex-1 text-sm">
                                        Payments submitted, waiting for your
                                        check
                                    </span>
                                    <StatusBadge
                                        tone={
                                            stats.paymentsToCheck > 0
                                                ? 'warning'
                                                : 'neutral'
                                        }
                                        label={f.num(stats.paymentsToCheck)}
                                    />
                                </Link>
                            </li>
                            {tickets.map((ticket) => (
                                <li key={ticket.id}>
                                    <Link
                                        href={ticketShow(ticket.id)}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted"
                                    >
                                        <LifeBuoy className="size-4 text-muted-foreground" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">
                                                {ticket.subject}
                                            </span>
                                            <span className="block text-xs text-muted-foreground">
                                                {ticket.company?.name} ·{' '}
                                                {ticket.number}
                                            </span>
                                        </span>
                                        <Clock className="size-3.5 text-muted-foreground" />
                                    </Link>
                                </li>
                            ))}
                            {tickets.length === 0 && (
                                <li className="px-4 py-3 text-sm text-muted-foreground">
                                    No open support tickets.
                                </li>
                            )}
                        </ul>
                    </Panel>

                    <Panel>
                        <PanelHeader title="Newest companies" />
                        <ul className="divide-y">
                            {recent.map((c) => (
                                <li key={c.id}>
                                    <Link
                                        href={companyShow(c.id)}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted"
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">
                                                {c.name}
                                            </span>
                                            <span className="block text-xs text-muted-foreground">
                                                {c.code} · {c.planName}
                                            </span>
                                        </span>
                                        <CompanyStatus
                                            status={c.subscription}
                                        />
                                    </Link>
                                </li>
                            ))}
                            {recent.length === 0 && (
                                <li className="px-4 py-3 text-sm text-muted-foreground">
                                    No companies yet.
                                </li>
                            )}
                        </ul>
                    </Panel>
                </div>
            </PageBody>
        </>
    );
}

PlatformDashboard.layout = {
    breadcrumbs: [{ title: 'Platform', href: dashboard() }],
};
