import { Head, router } from '@inertiajs/react';
import { MessageCircle, Phone } from 'lucide-react';
import { SelectField } from '@/components/admin/fields';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { Tabs } from '@/components/admin/tabs';
import type { TabItem } from '@/components/admin/tabs';
import { Panel } from '@/components/dashboard/primitives';
import { useDate } from '@/components/platform/bits';
import { whatsappUrl } from '@/components/public/site';
import { useFormat } from '@/hooks/use-format';
import { index as leadsIndex, update } from '@/routes/platform/leads';

type Status = 'new' | 'contacted' | 'converted' | 'lost' | 'all';

type Lead = {
    id: number;
    name: string;
    phone: string;
    company: string | null;
    district: string | null;
    teamSize: string | null;
    message: string | null;
    status: Exclude<Status, 'all'>;
    note: string | null;
    source: string | null;
    campaign: string | null;
    createdAt: string | null;
};

const statusOptions = [
    { value: 'new', label: 'New — call them' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'converted', label: 'Became a company' },
    { value: 'lost', label: 'Not interested' },
];

export default function PlatformLeads({
    status,
    leads,
    counts,
}: {
    status: Status;
    leads: Lead[];
    counts: Partial<Record<Exclude<Status, 'all'>, number>>;
}) {
    const { f } = useFormat();
    const date = useDate();
    const tab = (value: Status, label: string): TabItem<Status> => ({
        value,
        label,
        ...(value !== 'all' && { count: f.num(counts[value] ?? 0) }),
        ...(value === 'new' && { tone: 'warning' as const }),
    });

    return (
        <>
            <Head title="Leads" />
            <PageBody>
                <PageHeader
                    title="Leads"
                    description="Demo requests from the home page. Call new ones first — the sooner, the more of them become customers. Then create their company under Companies."
                />
                <Panel>
                    <Tabs
                        className="px-2"
                        value={status}
                        onChange={(v) =>
                            router.get(leadsIndex.url({ query: { status: v } }))
                        }
                        items={[
                            tab('new', 'New'),
                            tab('contacted', 'Contacted'),
                            tab('converted', 'Customers'),
                            tab('lost', 'Lost'),
                            tab('all', 'All'),
                        ]}
                    />
                    <ul className="divide-y">
                        {leads.map((l) => (
                            <li
                                key={l.id}
                                className="flex flex-wrap items-center gap-3 px-4 py-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium">
                                        {l.name}
                                        {l.company && (
                                            <span className="font-normal text-muted-foreground">
                                                {' '}
                                                · {l.company}
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {[
                                            l.teamSize && `${l.teamSize} staff`,
                                            l.district,
                                            l.source && `from ${l.source}`,
                                            l.campaign,
                                            date(l.createdAt),
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                    {l.message && (
                                        <p className="mt-1 text-sm">
                                            {l.message}
                                        </p>
                                    )}
                                </div>
                                <a
                                    href={`tel:${l.phone}`}
                                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                                >
                                    <Phone className="size-3.5" />
                                    {l.phone}
                                </a>
                                <a
                                    href={whatsappUrl(
                                        l.phone,
                                        `Hello ${l.name}, this is Onukrom about your demo request.`,
                                    )}
                                    target="_blank"
                                    rel="noopener"
                                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                                >
                                    <MessageCircle className="size-3.5 text-[#25D366]" />
                                    WhatsApp
                                </a>
                                <div className="w-48">
                                    <SelectField
                                        value={l.status}
                                        label="Status"
                                        onChange={(v) =>
                                            router.post(
                                                update.url(l.id),
                                                { status: v, note: l.note },
                                                { preserveScroll: true },
                                            )
                                        }
                                        options={statusOptions}
                                    />
                                </div>
                            </li>
                        ))}
                        {leads.length === 0 && (
                            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                                No leads here.
                            </li>
                        )}
                    </ul>
                </Panel>
            </PageBody>
        </>
    );
}

PlatformLeads.layout = {
    breadcrumbs: [{ title: 'Leads', href: leadsIndex() }],
};
