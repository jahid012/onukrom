import { Head, useForm } from '@inertiajs/react';
import { Field, TextInput } from '@/components/admin/dialogs';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { settings } from '@/routes/platform';
import { update } from '@/routes/platform/settings';

export default function PlatformSettings({
    paymentInstructions,
    supportPhone,
}: {
    paymentInstructions: string;
    supportPhone: string;
}) {
    const form = useForm({ paymentInstructions, supportPhone });

    return (
        <>
            <Head title="Settings" />
            <PageBody>
                <PageHeader
                    title="Settings"
                    description="What company owners see on their Billing and Support pages."
                />
                <form
                    className="max-w-2xl"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post(update.url(), { preserveScroll: true });
                    }}
                >
                    <Panel>
                        <PanelHeader title="Payments and support" />
                        <div className="flex flex-col gap-4 p-4">
                            <Field
                                label="How to pay"
                                help="Shown on every owner's Billing page. Include your bKash / Nagad merchant number and bank account, and ask them to use the invoice number as reference."
                                error={form.errors.paymentInstructions}
                            >
                                <textarea
                                    rows={7}
                                    value={form.data.paymentInstructions}
                                    onChange={(e) =>
                                        form.setData(
                                            'paymentInstructions',
                                            e.target.value,
                                        )
                                    }
                                    placeholder={
                                        'bKash Merchant: 01XXXXXXXXX (Payment)\nNagad: 01XXXXXXXXX\nBank: Onukrom Ltd, A/C 0000000000, BRAC Bank, Gulshan\nReference: your invoice number'
                                    }
                                    className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                            </Field>
                            <Field
                                label="Support phone"
                                help="Shown on the Support page for urgent problems."
                                error={form.errors.supportPhone}
                            >
                                <TextInput
                                    type="tel"
                                    value={form.data.supportPhone}
                                    onChange={(v) =>
                                        form.setData('supportPhone', v)
                                    }
                                    placeholder="01XXXXXXXXX"
                                />
                            </Field>
                            <Button
                                type="submit"
                                className="w-fit"
                                disabled={form.processing}
                            >
                                Save
                            </Button>
                        </div>
                    </Panel>
                </form>
            </PageBody>
        </>
    );
}

PlatformSettings.layout = {
    breadcrumbs: [{ title: 'Settings', href: settings() }],
};
