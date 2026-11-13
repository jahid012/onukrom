import { Link, usePage } from '@inertiajs/react';
import { MessageCircle, Phone, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useFormat } from '@/hooks/use-format';
import { initPixel, track } from '@/lib/meta-pixel';
import { cn } from '@/lib/utils';
import { dashboard, login, privacy, terms } from '@/routes';

export type SiteProps = {
    meta: { pixelId: string | null; eventId: string };
    contact: {
        phone: string;
        whatsapp: string;
        email: string;
        address: string;
        legalName: string;
    };
    leadSent: boolean;
};

/** Browser PageView with the same id the server sent to the Conversions API. */
export function usePageView(meta: SiteProps['meta']) {
    useEffect(() => {
        if (initPixel(meta.pixelId)) {
            track('PageView', {}, meta.eventId);
        }
    }, [meta.pixelId, meta.eventId]);
}

/** wa.me link for a Bangladeshi number (01… → 8801…). */
export function whatsappUrl(number: string, text: string): string {
    const digits = number.replace(/\D/g, '');
    const intl = digits.startsWith('0') ? `88${digits}` : digits;

    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

/** Call / WhatsApp links count as a "Contact" for ads (browser only). */
export function ContactLink({
    kind,
    number,
    className,
    children,
}: {
    kind: 'phone' | 'whatsapp';
    number: string;
    className?: string;
    children: ReactNode;
}) {
    const { t } = useFormat();
    const href =
        kind === 'phone'
            ? `tel:${number}`
            : whatsappUrl(number, t('home.whatsappText'));

    return (
        <a
            href={href}
            target={kind === 'whatsapp' ? '_blank' : undefined}
            rel={kind === 'whatsapp' ? 'noopener' : undefined}
            className={className}
            onClick={() => track('Contact', { content_name: kind })}
        >
            {children}
        </a>
    );
}

const btn = {
    solid: 'bg-[#4264FB] text-white hover:bg-[#2A47C7] shadow-sm shadow-[#4264FB]/30',
    outline: 'border border-border bg-card text-foreground hover:bg-muted',
    white: 'bg-white text-[#141A2E] hover:bg-white/90',
    whatsapp: 'bg-[#25D366] text-white hover:bg-[#1EBE5B]',
};

export function buttonClass(
    variant: keyof typeof btn = 'solid',
    size: 'md' | 'lg' = 'md',
) {
    return cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors',
        size === 'lg' ? 'h-12 px-6 text-base' : 'h-10 px-4 text-sm',
        btn[variant],
    );
}

export function SiteHeader({ announce = false }: { announce?: boolean }) {
    const { t } = useFormat();
    const { auth } = usePage().props;

    return (
        <>
            {announce && (
                <a
                    href="/#demo"
                    className="flex items-center justify-center gap-2 bg-[#4264FB] px-4 py-2 text-center text-xs font-medium text-white sm:text-sm"
                >
                    <Sparkles className="size-3.5 shrink-0" />
                    {t('home.announce')}
                </a>
            )}
            <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
                    <Link href="/" className="flex items-center gap-2">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-[#4264FB] text-white">
                            <AppLogoIcon className="size-5 fill-current" />
                        </span>
                        <span className="text-lg font-bold">Onukrom</span>
                    </Link>
                    <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
                        {['features', 'app', 'pricing', 'faq'].map((k) => (
                            <a
                                key={k}
                                href={`/#${k}`}
                                className="hover:text-foreground"
                            >
                                {t(`home.nav.${k}`)}
                            </a>
                        ))}
                    </nav>
                    <div className="ml-auto flex items-center gap-2">
                        <LanguageSwitcher compact />
                        <Link
                            href={auth.user ? dashboard() : login()}
                            className="hidden rounded-lg px-3 py-2 text-sm font-medium hover:text-[#4264FB] sm:inline"
                        >
                            {auth.user ? t('home.openPanel') : t('home.login')}
                        </Link>
                        <a href="/#demo" className={buttonClass('solid')}>
                            {t('home.ctaDemo')}
                        </a>
                    </div>
                </div>
            </header>
        </>
    );
}

export function SiteFooter({ contact }: { contact: SiteProps['contact'] }) {
    const { t } = useFormat();

    return (
        <footer className="bg-[#0B1020] pb-20 text-white/70 md:pb-0">
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-14 sm:grid-cols-4">
                <div className="col-span-2 flex flex-col gap-3 sm:col-span-1">
                    <span className="flex items-center gap-2 text-white">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-[#4264FB]">
                            <AppLogoIcon className="size-5 fill-current" />
                        </span>
                        <span className="text-lg font-bold">Onukrom</span>
                    </span>
                    <p className="text-sm">{t('home.footer.about')}</p>
                </div>
                <div className="flex flex-col gap-2 text-sm">
                    <p className="font-semibold text-white">
                        {t('home.footer.product')}
                    </p>
                    {['features', 'app', 'pricing', 'faq'].map((k) => (
                        <a key={k} href={`/#${k}`} className="hover:text-white">
                            {t(`home.nav.${k}`)}
                        </a>
                    ))}
                </div>
                <div className="flex flex-col gap-2 text-sm">
                    <p className="font-semibold text-white">
                        {t('home.footer.legal')}
                    </p>
                    <Link href={terms()} className="hover:text-white">
                        {t('home.footer.terms')}
                    </Link>
                    <Link href={privacy()} className="hover:text-white">
                        {t('home.footer.privacy')}
                    </Link>
                    <Link href={login()} className="hover:text-white">
                        {t('home.login')}
                    </Link>
                </div>
                <div className="flex flex-col gap-2 text-sm">
                    <p className="font-semibold text-white">
                        {t('home.footer.contact')}
                    </p>
                    {contact.phone && (
                        <ContactLink
                            kind="phone"
                            number={contact.phone}
                            className="flex items-center gap-1.5 hover:text-white"
                        >
                            <Phone className="size-4" />
                            {contact.phone}
                        </ContactLink>
                    )}
                    {contact.whatsapp && (
                        <ContactLink
                            kind="whatsapp"
                            number={contact.whatsapp}
                            className="flex items-center gap-1.5 hover:text-white"
                        >
                            <MessageCircle className="size-4" />
                            WhatsApp
                        </ContactLink>
                    )}
                    {contact.email && (
                        <a
                            href={`mailto:${contact.email}`}
                            className="hover:text-white"
                        >
                            {contact.email}
                        </a>
                    )}
                    <span>
                        {contact.address || t('home.footer.bangladesh')}
                    </span>
                </div>
            </div>
            <div className="border-t border-white/10">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-5 text-xs">
                    <span>
                        © {new Date().getFullYear()} {contact.legalName}
                    </span>
                    <span className="ml-auto">{t('home.footer.made')}</span>
                </div>
            </div>
        </footer>
    );
}

/** Phones: call, WhatsApp and demo always one tap away. */
export function MobileCtaBar({ contact }: { contact: SiteProps['contact'] }) {
    const { t } = useFormat();

    return (
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t bg-background/95 p-2 backdrop-blur md:hidden">
            {contact.phone && (
                <ContactLink
                    kind="phone"
                    number={contact.phone}
                    className={cn(buttonClass('outline'), 'px-3')}
                >
                    <Phone className="size-4" />
                    <span className="sr-only">{t('home.call')}</span>
                </ContactLink>
            )}
            {contact.whatsapp && (
                <ContactLink
                    kind="whatsapp"
                    number={contact.whatsapp}
                    className={cn(buttonClass('whatsapp'), 'px-3')}
                >
                    <MessageCircle className="size-4" />
                    <span className="sr-only">WhatsApp</span>
                </ContactLink>
            )}
            <a href="/#demo" className={cn(buttonClass('solid'), 'flex-1')}>
                {t('home.ctaDemo')}
            </a>
        </div>
    );
}
