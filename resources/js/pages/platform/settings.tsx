import { Head, router, useForm } from '@inertiajs/react';
import { CheckCircle2, Send } from 'lucide-react';
import { Field, TextInput } from '@/components/admin/dialogs';
import { PageBody, PageHeader } from '@/components/admin/page-header';
import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { settings } from '@/routes/platform';
import { metaTest, update } from '@/routes/platform/settings';

const area =
    'w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function PlatformSettings(props: {
    paymentInstructions: string;
    supportPhone: string;
    whatsapp: string;
    contactEmail: string;
    businessAddress: string;
    legalName: string;
    metaPixelId: string;
    metaTestEventCode: string;
    metaTokenSet: boolean;
    paystationMerchantId: string;
    paystationMode: 'sandbox' | 'live';
    paystationPayWithCharge: boolean;
    paystationPasswordSet: boolean;
    paystationIpnUrl: string;
}) {
    const form = useForm({
        paymentInstructions: props.paymentInstructions,
        supportPhone: props.supportPhone,
        whatsapp: props.whatsapp,
        contactEmail: props.contactEmail,
        businessAddress: props.businessAddress,
        legalName: props.legalName,
        metaPixelId: props.metaPixelId,
        metaTestEventCode: props.metaTestEventCode,
        metaToken: '',
        clearMetaToken: false,
        paystationMerchantId: props.paystationMerchantId,
        paystationPassword: '',
        paystationMode: props.paystationMode,
        paystationPayWithCharge: props.paystationPayWithCharge,
    });
    const e = form.errors;

    return (
        <>
            <Head title="Settings" />
            <PageBody>
                <PageHeader
                    title="Settings"
                    description="What the public website, owners' Billing page and Support page show — and Meta ads tracking."
                />
                <form
                    className="flex max-w-3xl flex-col gap-4"
                    onSubmit={(ev) => {
                        ev.preventDefault();
                        form.post(update.url(), {
                            preserveScroll: true,
                            onSuccess: () =>
                                form.setData({
                                    ...form.data,
                                    metaToken: '',
                                    paystationPassword: '',
                                }),
                        });
                    }}
                >
                    <Panel>
                        <PanelHeader
                            title="Contact & company"
                            subtitle="Shown on the home page, the terms and privacy pages, and to companies"
                        />
                        <div className="grid gap-4 p-4 sm:grid-cols-2">
                            <Field
                                label="Legal / business name"
                                help="Used in the terms and privacy policy"
                                error={e.legalName}
                            >
                                <TextInput
                                    value={form.data.legalName}
                                    onChange={(v) =>
                                        form.setData('legalName', v)
                                    }
                                    placeholder="Onukrom"
                                />
                            </Field>
                            <Field label="Contact email" error={e.contactEmail}>
                                <TextInput
                                    type="email"
                                    value={form.data.contactEmail}
                                    onChange={(v) =>
                                        form.setData('contactEmail', v)
                                    }
                                    placeholder="hello@onukrom.com"
                                />
                            </Field>
                            <Field
                                label="Phone (calls)"
                                help="Call buttons and the Support page"
                                error={e.supportPhone}
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
                            <Field
                                label="WhatsApp number"
                                help="Empty = same as the phone"
                                error={e.whatsapp}
                            >
                                <TextInput
                                    type="tel"
                                    value={form.data.whatsapp}
                                    onChange={(v) =>
                                        form.setData('whatsapp', v)
                                    }
                                    placeholder="01XXXXXXXXX"
                                />
                            </Field>
                            <Field
                                label="Business address"
                                className="sm:col-span-2"
                                error={e.businessAddress}
                            >
                                <TextInput
                                    value={form.data.businessAddress}
                                    onChange={(v) =>
                                        form.setData('businessAddress', v)
                                    }
                                    placeholder="House, road, area, Dhaka"
                                />
                            </Field>
                        </div>
                    </Panel>

                    <Panel>
                        <PanelHeader
                            title="Online payment — PayStation"
                            subtitle="Owners press “Pay online” on an invoice and pay by bKash, Nagad, Rocket, Upay or card; the invoice is marked paid after PayStation confirms it server-to-server"
                        />
                        <div className="grid gap-4 p-4 sm:grid-cols-2">
                            <Field
                                label="Merchant ID"
                                error={e.paystationMerchantId}
                            >
                                <TextInput
                                    value={form.data.paystationMerchantId}
                                    onChange={(v) =>
                                        form.setData(
                                            'paystationMerchantId',
                                            v.trim(),
                                        )
                                    }
                                    placeholder="104-1653730183"
                                />
                            </Field>
                            <Field
                                label="Password"
                                help={
                                    props.paystationPasswordSet
                                        ? 'Saved (stored encrypted). Leave empty to keep it.'
                                        : 'From PayStation'
                                }
                                error={e.paystationPassword}
                            >
                                <TextInput
                                    value={form.data.paystationPassword}
                                    onChange={(v) =>
                                        form.setData('paystationPassword', v)
                                    }
                                    placeholder={
                                        props.paystationPasswordSet
                                            ? '•••••••• saved'
                                            : ''
                                    }
                                />
                            </Field>
                            <Field
                                label="Environment"
                                help="Test with Sandbox first, then switch to Live"
                                error={e.paystationMode}
                            >
                                <select
                                    value={form.data.paystationMode}
                                    onChange={(ev) =>
                                        form.setData(
                                            'paystationMode',
                                            ev.target.value as
                                                | 'sandbox'
                                                | 'live',
                                        )
                                    }
                                    className="h-9 w-full rounded-md border bg-card px-3 text-sm"
                                >
                                    <option value="sandbox">
                                        Sandbox (test money)
                                    </option>
                                    <option value="live">
                                        Live (real payments)
                                    </option>
                                </select>
                            </Field>
                            <Field
                                label="Gateway charge"
                                help="Who pays PayStation’s fee"
                                error={e.paystationPayWithCharge}
                            >
                                <select
                                    value={
                                        form.data.paystationPayWithCharge
                                            ? '1'
                                            : '0'
                                    }
                                    onChange={(ev) =>
                                        form.setData(
                                            'paystationPayWithCharge',
                                            ev.target.value === '1',
                                        )
                                    }
                                    className="h-9 w-full rounded-md border bg-card px-3 text-sm"
                                >
                                    <option value="0">We pay the charge</option>
                                    <option value="1">
                                        The customer pays the charge
                                    </option>
                                </select>
                            </Field>
                            <div className="flex flex-col gap-1 text-sm sm:col-span-2">
                                <span className="font-medium">
                                    IPN URL — send this to PayStation
                                </span>
                                <code className="rounded-md border bg-muted px-3 py-2 font-mono text-xs break-all select-all">
                                    {props.paystationIpnUrl}
                                </code>
                                {props.paystationPasswordSet &&
                                    props.paystationMerchantId && (
                                        <span className="mt-1 flex items-center gap-1.5 text-success-ink">
                                            <CheckCircle2 className="size-4" />
                                            Online payment is on (
                                            {props.paystationMode === 'live'
                                                ? 'Live'
                                                : 'Sandbox'}
                                            )
                                        </span>
                                    )}
                            </div>
                        </div>
                    </Panel>

                    <Panel>
                        <PanelHeader
                            title="How companies pay"
                            subtitle="Shown on every owner's Billing page"
                        />
                        <div className="p-4">
                            <Field
                                label="Payment instructions"
                                help="Your bKash / Nagad merchant number and bank account; ask them to use the invoice number as reference."
                                error={e.paymentInstructions}
                            >
                                <textarea
                                    rows={6}
                                    value={form.data.paymentInstructions}
                                    onChange={(ev) =>
                                        form.setData(
                                            'paymentInstructions',
                                            ev.target.value,
                                        )
                                    }
                                    placeholder={
                                        'bKash Merchant: 01XXXXXXXXX (Payment)\nNagad: 01XXXXXXXXX\nBank: Onukrom Ltd, A/C 0000000000, BRAC Bank, Gulshan\nReference: your invoice number'
                                    }
                                    className={area}
                                />
                            </Field>
                        </div>
                    </Panel>

                    <Panel>
                        <PanelHeader
                            title="Meta Pixel & Conversions API"
                            subtitle="Page views, demo requests (Lead), call / WhatsApp taps (Contact) and paid invoices (Subscribe) — sent from the browser and the server with the same event id"
                        />
                        <div className="grid gap-4 p-4 sm:grid-cols-2">
                            <Field
                                label="Pixel (dataset) ID"
                                help="Events Manager → your dataset → Settings"
                                error={e.metaPixelId}
                            >
                                <TextInput
                                    value={form.data.metaPixelId}
                                    onChange={(v) =>
                                        form.setData(
                                            'metaPixelId',
                                            v.replace(/\D/g, ''),
                                        )
                                    }
                                    placeholder="123456789012345"
                                />
                            </Field>
                            <Field
                                label="Test event code (optional)"
                                help="Only while testing; clear it when you go live"
                                error={e.metaTestEventCode}
                            >
                                <TextInput
                                    value={form.data.metaTestEventCode}
                                    onChange={(v) =>
                                        form.setData('metaTestEventCode', v)
                                    }
                                    placeholder="TEST12345"
                                />
                            </Field>
                            <Field
                                label="Conversions API access token"
                                className="sm:col-span-2"
                                help={
                                    props.metaTokenSet
                                        ? 'A token is saved (stored encrypted). Leave empty to keep it.'
                                        : 'Events Manager → Settings → Conversions API → Generate access token'
                                }
                                error={e.metaToken}
                            >
                                <TextInput
                                    value={form.data.metaToken}
                                    onChange={(v) =>
                                        form.setData('metaToken', v)
                                    }
                                    placeholder={
                                        props.metaTokenSet
                                            ? '•••••••• saved'
                                            : 'EAAB…'
                                    }
                                />
                            </Field>
                            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                                {props.metaTokenSet && (
                                    <span className="flex items-center gap-1.5 text-sm text-success-ink">
                                        <CheckCircle2 className="size-4" />
                                        Token saved
                                    </span>
                                )}
                                {props.metaTokenSet && (
                                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <input
                                            type="checkbox"
                                            checked={form.data.clearMetaToken}
                                            onChange={(ev) =>
                                                form.setData(
                                                    'clearMetaToken',
                                                    ev.target.checked,
                                                )
                                            }
                                        />
                                        Remove the saved token
                                    </label>
                                )}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="ml-auto"
                                    disabled={
                                        !props.metaTokenSet ||
                                        !props.metaPixelId
                                    }
                                    onClick={() =>
                                        router.post(
                                            metaTest.url(),
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                >
                                    <Send className="size-3.5" />
                                    Send test event
                                </Button>
                            </div>
                        </div>
                    </Panel>

                    <Button
                        type="submit"
                        className="w-fit"
                        disabled={form.processing}
                    >
                        Save settings
                    </Button>
                </form>
            </PageBody>
        </>
    );
}

PlatformSettings.layout = {
    breadcrumbs: [{ title: 'Settings', href: settings() }],
};
