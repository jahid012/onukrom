import { Head } from '@inertiajs/react';
import { useFormat } from '@/hooks/use-format';
import { MobileCtaBar, SiteFooter, SiteHeader, usePageView } from './site';
import type { SiteProps } from './site';

type Section = { h: string; p: string[] };

/**
 * Terms / privacy: text lives in locales/<lang>/legal.json; the company's
 * name, email, phone and address come from the platform settings.
 */
export function LegalPage({
    doc,
    meta,
    contact,
}: SiteProps & { doc: 'terms' | 'privacy' }) {
    const { t } = useFormat();
    usePageView(meta);
    const vars = {
        legalName: contact.legalName,
        email: contact.email || t('legal.noEmail'),
        phone: contact.phone || t('legal.noPhone'),
        address: contact.address || t('legal.noAddress'),
    };
    const sections = t(`legal.${doc}.sections`, {
        returnObjects: true,
        ...vars,
    }) as unknown as Section[];

    return (
        <>
            <Head title={t(`legal.${doc}.title`)} />
            <div className="min-h-svh bg-background text-foreground">
                <SiteHeader />
                <main className="mx-auto max-w-3xl px-4 py-14">
                    <p className="text-sm font-medium text-[#4264FB]">
                        {t('legal.updated', { date: t('legal.date') })}
                    </p>
                    <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                        {t(`legal.${doc}.title`)}
                    </h1>
                    <p className="mt-4 text-lg text-muted-foreground">
                        {t(`legal.${doc}.intro`, vars)}
                    </p>
                    <div className="mt-10 flex flex-col gap-8">
                        {Array.isArray(sections) &&
                            sections.map((s, i) => (
                                <section
                                    key={i}
                                    className="flex flex-col gap-3"
                                >
                                    <h2 className="text-xl font-bold">
                                        {i + 1}. {s.h}
                                    </h2>
                                    {s.p.map((para, j) => (
                                        <p
                                            key={j}
                                            className="leading-relaxed text-muted-foreground"
                                        >
                                            {para}
                                        </p>
                                    ))}
                                </section>
                            ))}
                    </div>
                </main>
                <SiteFooter contact={contact} />
                <MobileCtaBar contact={contact} />
            </div>
        </>
    );
}
