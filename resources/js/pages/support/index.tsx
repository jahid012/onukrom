import { Head, Link, useForm } from '@inertiajs/react';
import { LifeBuoy, MessageSquarePlus, Phone } from 'lucide-react';
import { useState } from 'react';
import { Field, FormDialog, TextInput } from '@/components/admin/dialogs';
import { SelectField } from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { Panel } from '@/components/dashboard/primitives';
import { ticketTone } from '@/components/support/thread';
import type { Ticket } from '@/components/support/thread';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/hooks/use-admin';
import { index as supportIndex, show, store } from '@/routes/support';

export default function SupportIndex({
    tickets,
    categories,
    supportPhone,
}: {
    tickets: Ticket[];
    categories: string[];
    supportPhone: string;
}) {
    const { t, ago } = useAdmin();
    const [creating, setCreating] = useState(false);
    const minutes = (iso: string | null) =>
        iso ? Math.round((Date.now() - new Date(iso).getTime()) / 60000) : 0;

    return (
        <>
            <Head title={t('support.title')} />
            <PageBody>
                <PageHeader
                    title={t('support.title')}
                    description={t('support.description')}
                    actions={
                        <Button size="sm" onClick={() => setCreating(true)}>
                            <MessageSquarePlus className="size-3.5" />
                            {t('support.new')}
                        </Button>
                    }
                />

                {supportPhone && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="size-4" />
                        {t('support.callUs', { phone: supportPhone })}
                    </p>
                )}

                <Panel>
                    {tickets.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                            <LifeBuoy className="size-8 text-muted-foreground" />
                            <p className="max-w-sm text-sm text-muted-foreground">
                                {t('support.empty')}
                            </p>
                            <Button onClick={() => setCreating(true)}>
                                {t('support.new')}
                            </Button>
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {tickets.map((ticket) => (
                                <li key={ticket.id}>
                                    <Link
                                        href={show(ticket.id)}
                                        className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">
                                                {ticket.subject}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {ticket.number} ·{' '}
                                                {t(
                                                    `support.categories.${ticket.category}`,
                                                )}{' '}
                                                · {ticket.openedBy} ·{' '}
                                                {ago(
                                                    minutes(
                                                        ticket.lastMessageAt,
                                                    ),
                                                )}
                                            </p>
                                        </div>
                                        <StatusBadge
                                            tone={ticketTone[ticket.status]}
                                            label={t(
                                                `support.status.${ticket.status}`,
                                            )}
                                        />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </PageBody>

            {creating && (
                <NewTicket
                    categories={categories}
                    onClose={() => setCreating(false)}
                />
            )}
        </>
    );
}

function NewTicket({
    categories,
    onClose,
}: {
    categories: string[];
    onClose: () => void;
}) {
    const { t } = useAdmin();
    const form = useForm({ subject: '', category: 'how_to', body: '' });

    return (
        <FormDialog
            open
            onOpenChange={(o) => !o && onClose()}
            title={t('support.new')}
            description={t('support.newText')}
            submitLabel={t('support.send')}
            disabled={
                form.processing ||
                form.data.subject.trim() === '' ||
                form.data.body.trim() === ''
            }
            onSubmit={() => {
                form.post(store.url(), { onSuccess: onClose });

                return false;
            }}
        >
            <Field label={t('support.category')}>
                <SelectField
                    value={form.data.category}
                    onChange={(v) => form.setData('category', v)}
                    label={t('support.category')}
                    options={categories.map((c) => ({
                        value: c,
                        label: t(`support.categories.${c}`),
                    }))}
                />
            </Field>
            <Field label={t('support.subject')} error={form.errors.subject}>
                <TextInput
                    value={form.data.subject}
                    onChange={(v) => form.setData('subject', v)}
                    autoFocus
                />
            </Field>
            <Field label={t('support.message')} error={form.errors.body}>
                <textarea
                    value={form.data.body}
                    onChange={(e) => form.setData('body', e.target.value)}
                    rows={5}
                    placeholder={t('support.messageHint')}
                    className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
            </Field>
        </FormDialog>
    );
}

SupportIndex.layout = {
    breadcrumbs: [{ title: 'nav.support', href: supportIndex() }],
};
