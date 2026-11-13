import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { TicketThread, ticketTone } from '@/components/support/thread';
import type { Ticket } from '@/components/support/thread';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/hooks/use-admin';
import { close, index as supportIndex, reply } from '@/routes/support';

export default function SupportShow({ ticket }: { ticket: Ticket }) {
    const { t } = useAdmin();

    return (
        <>
            <Head title={ticket.subject} />
            <PageBody>
                <Link
                    href={supportIndex()}
                    className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    {t('support.back')}
                </Link>
                <PageHeader
                    title={ticket.subject}
                    description={`${ticket.number} · ${t(`support.categories.${ticket.category}`)}`}
                    actions={
                        <>
                            <StatusBadge
                                tone={ticketTone[ticket.status]}
                                label={t(`support.status.${ticket.status}`)}
                            />
                            {ticket.status !== 'closed' && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-card"
                                    onClick={() =>
                                        router.post(close.url(ticket.id))
                                    }
                                >
                                    <CheckCircle2 className="size-3.5" />
                                    {t('support.solved')}
                                </Button>
                            )}
                        </>
                    }
                />
                <TicketThread
                    ticket={ticket}
                    side="company"
                    replyUrl={reply.url(ticket.id)}
                    labels={{
                        placeholder: t('support.replyHint'),
                        send: t('support.send'),
                        closed: t('support.closedHint'),
                    }}
                />
            </PageBody>
        </>
    );
}

SupportShow.layout = {
    breadcrumbs: [{ title: 'nav.support', href: supportIndex() }],
};
