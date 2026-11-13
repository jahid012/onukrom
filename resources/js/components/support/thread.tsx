import { useForm } from '@inertiajs/react';
import { Send } from 'lucide-react';
import type { Tone } from '@/components/admin/status-badge';
import { Panel } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';

export type TicketMessage = {
    id: number;
    body: string;
    fromPlatform: boolean;
    author: string;
    at: string | null;
};

export type Ticket = {
    id: number;
    number: string;
    subject: string;
    category: string;
    status: 'open' | 'answered' | 'closed';
    company: { id: number; name: string; code: string } | null;
    openedBy: string | null;
    assignee: string | null;
    assignedTo: number | null;
    lastMessageAt: string | null;
    createdAt: string | null;
    messages: TicketMessage[];
};

/**
 * Chat-style ticket thread. `mine` decides which side a message sits on:
 * the company's own messages right in the company panel, support's right in
 * the platform panel.
 */
export function TicketThread({
    ticket,
    side,
    replyUrl,
    labels,
    extraField,
}: {
    ticket: Ticket;
    side: 'company' | 'platform';
    replyUrl: string;
    labels: { placeholder: string; send: string; closed: string };
    extraField?: (form: {
        close: boolean;
        set: (v: boolean) => void;
    }) => React.ReactNode;
}) {
    const { f } = useFormat();
    const form = useForm({ body: '', close: false });
    const mine = (m: TicketMessage) =>
        side === 'platform' ? m.fromPlatform : !m.fromPlatform;

    return (
        <Panel>
            <ol className="flex flex-col gap-3 p-4">
                {ticket.messages.map((m) => (
                    <li
                        key={m.id}
                        className={cn(
                            'flex max-w-[85%] flex-col gap-1',
                            mine(m) ? 'items-end self-end' : 'self-start',
                        )}
                    >
                        <span className="text-xs text-muted-foreground">
                            {m.author}
                            {m.at &&
                                ` · ${f.date(new Date(m.at), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`}
                        </span>
                        <p
                            className={cn(
                                'rounded-md px-3 py-2 text-sm whitespace-pre-line',
                                mine(m)
                                    ? 'bg-primary text-primary-foreground'
                                    : 'border bg-muted',
                            )}
                        >
                            {m.body}
                        </p>
                    </li>
                ))}
            </ol>
            <form
                className="flex flex-col gap-2 border-t p-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post(replyUrl, {
                        preserveScroll: true,
                        onSuccess: () => form.reset(),
                    });
                }}
            >
                {ticket.status === 'closed' && (
                    <p className="text-xs text-muted-foreground">
                        {labels.closed}
                    </p>
                )}
                <textarea
                    value={form.data.body}
                    onChange={(e) => form.setData('body', e.target.value)}
                    rows={3}
                    placeholder={labels.placeholder}
                    className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {form.errors.body && (
                    <p className="text-xs text-danger-ink">
                        {form.errors.body}
                    </p>
                )}
                <div className="flex items-center gap-3">
                    {extraField?.({
                        close: form.data.close,
                        set: (v) => form.setData('close', v),
                    })}
                    <Button
                        type="submit"
                        className="ml-auto"
                        disabled={
                            form.processing || form.data.body.trim() === ''
                        }
                    >
                        <Send className="size-4" />
                        {labels.send}
                    </Button>
                </div>
            </form>
        </Panel>
    );
}

export const ticketTone: Record<Ticket['status'], Tone> = {
    open: 'warning',
    answered: 'success',
    closed: 'neutral',
};
