import { Head } from '@inertiajs/react';
import {
    ArrowRight,
    BadgeCheck,
    BarChart3,
    Boxes,
    Check,
    ChevronDown,
    Crown,
    FileDown,
    FileX2,
    Fingerprint,
    HandCoins,
    MapPin,
    MapPinned,
    MapPinOff,
    MessageCircle,
    ShieldCheck,
    ShoppingCart,
    Smartphone,
    Store,
    Tags,
    Truck,
    UserCog,
    Users,
    Wallet,
    WalletCards,
    WifiOff,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { LeadForm } from '@/components/public/lead-form';
import {
    ContactLink,
    MobileCtaBar,
    SiteFooter,
    SiteHeader,
    buttonClass,
    usePageView,
} from '@/components/public/site';
import type { SiteProps } from '@/components/public/site';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';

const brand = '#4264FB';

type Plan = {
    key: string;
    name: string;
    name_bn: string | null;
    price: number;
    staffLimit: number;
};

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Eyebrow({
    children,
    dark = false,
}: {
    children: ReactNode;
    dark?: boolean;
}) {
    return (
        <span
            className={cn(
                'inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase',
                dark
                    ? 'border-white/20 text-white/80'
                    : 'border-[#4264FB]/25 bg-[#4264FB]/5 text-[#4264FB]',
            )}
        >
            <span className="size-1.5 rounded-full bg-[#4264FB]" aria-hidden />
            {children}
        </span>
    );
}

function SectionHead({
    eyebrow,
    title,
    text,
    dark = false,
}: {
    eyebrow: string;
    title: string;
    text?: string;
    dark?: boolean;
}) {
    return (
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
            <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
            <h2 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
                {title}
            </h2>
            {text && (
                <p
                    className={cn(
                        'text-base',
                        dark ? 'text-white/70' : 'text-muted-foreground',
                    )}
                >
                    {text}
                </p>
            )}
        </div>
    );
}

/** Browser-window frame around a panel screenshot. */
function Screen({
    src,
    alt,
    className,
    eager = false,
}: {
    src: string;
    alt: string;
    className?: string;
    eager?: boolean;
}) {
    return (
        <figure
            className={cn(
                'overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-[#4264FB]/10',
                className,
            )}
        >
            <div className="flex h-8 items-center gap-1.5 border-b bg-muted px-4">
                <span className="size-2.5 rounded-full bg-[#F87171]" />
                <span className="size-2.5 rounded-full bg-[#FBBF24]" />
                <span className="size-2.5 rounded-full bg-[#34D399]" />
            </div>
            <img
                src={src}
                alt={alt}
                width={1440}
                height={900}
                loading={eager ? 'eager' : 'lazy'}
                className="block h-auto w-full"
            />
        </figure>
    );
}

function PhoneFrame({
    src,
    alt,
    className,
}: {
    src: string;
    alt: string;
    className?: string;
}) {
    return (
        <figure
            className={cn(
                'overflow-hidden rounded-[2rem] border-[7px] border-[#141A2E] bg-white shadow-2xl',
                className,
            )}
        >
            <img
                src={src}
                alt={alt}
                loading="lazy"
                width={720}
                height={1456}
                className="block h-auto w-full"
            />
        </figure>
    );
}

/** The skyline of bars under the hero (decoration). */
function Skyline() {
    const bars = Array.from({ length: 64 }, (_, i) => {
        const x = i / 63;
        const h =
            0.28 +
            0.22 * Math.sin(x * 9) ** 2 +
            0.18 * Math.sin(x * 23 + 1) ** 2 +
            0.32 * x;

        return Math.min(1, h);
    });

    return (
        <div
            className="pointer-events-none flex h-56 items-end gap-[3px] sm:h-72"
            aria-hidden
        >
            {bars.map((h, i) => (
                <span
                    key={i}
                    className="flex-1 rounded-t-md"
                    style={{
                        height: `${h * 100}%`,
                        background: `linear-gradient(to top, ${brand}, ${brand}cc 40%, ${brand}33)`,
                        opacity: 0.35 + 0.65 * (i / 63),
                    }}
                />
            ))}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Welcome({
    meta,
    contact,
    leadSent,
    appShots,
    plans,
    teamSizes,
}: SiteProps & {
    appShots: string[];
    plans: Plan[];
    teamSizes: string[];
}) {
    const { t, f, locale } = useFormat();
    usePageView(meta);
    const shot = (name: string) => appShots.find((s) => s.includes(name));
    const img = (name: string) => `/images/home/admin-${name}.webp`;

    const pains: { icon: LucideIcon; key: string }[] = [
        { icon: FileX2, key: 'memo' },
        { icon: MapPinOff, key: 'visit' },
        { icon: WalletCards, key: 'cash' },
        { icon: Boxes, key: 'stock' },
    ];

    const roles: { icon: LucideIcon; key: string }[] = [
        { icon: Crown, key: 'owner' },
        { icon: UserCog, key: 'manager' },
        { icon: ShoppingCart, key: 'sr' },
        { icon: Truck, key: 'dm' },
        { icon: Wallet, key: 'accounts' },
    ];

    const fieldCards: {
        key: string;
        shot?: string;
        icon: LucideIcon;
        bg: string;
    }[] = [
        {
            key: 'order',
            shot: shot('order'),
            icon: ShoppingCart,
            bg: 'from-[#4264FB] to-[#2A47C7]',
        },
        {
            key: 'shops',
            shot: shot('shops'),
            icon: Store,
            bg: 'from-[#0EA5A4] to-[#0B7C7B]',
        },
        {
            key: 'trip',
            shot: shot('trip'),
            icon: Truck,
            bg: 'from-[#F97316] to-[#C2410C]',
        },
        {
            key: 'offline',
            shot: shot('refresh'),
            icon: WifiOff,
            bg: 'from-[#8B5CF6] to-[#6D28D9]',
        },
        {
            key: 'home',
            shot: shot('home'),
            icon: Smartphone,
            bg: 'from-[#141A2E] to-[#2B3352]',
        },
    ];

    const grid: { key: string; icon: LucideIcon; image: string }[] = [
        { key: 'collections', icon: HandCoins, image: img('collections') },
        { key: 'deliveries', icon: Truck, image: img('deliveries') },
        { key: 'stock', icon: Boxes, image: img('stock') },
        { key: 'pricing', icon: Tags, image: img('pricing') },
        { key: 'areas', icon: MapPinned, image: img('areas') },
        { key: 'staff', icon: Users, image: img('staff') },
    ];

    const faqs = [
        'trial',
        'phones',
        'internet',
        'price',
        'import',
        'data',
        'help',
    ];

    return (
        <>
            <Head title={t('home.title')}>
                <meta name="description" content={t('home.metaDescription')} />
                <meta property="og:title" content={t('home.title')} />
                <meta
                    property="og:description"
                    content={t('home.metaDescription')}
                />
                <meta
                    property="og:image"
                    content="/images/home/admin-dashboard.webp"
                />
            </Head>

            <div className="min-h-svh bg-background text-foreground">
                <SiteHeader announce />

                {/* Hero */}
                <section className="relative">
                    <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 pt-14 text-center sm:pt-20">
                        <Eyebrow>{t('home.eyebrow')}</Eyebrow>
                        <h1 className="text-4xl leading-[1.12] font-extrabold tracking-tight sm:text-6xl">
                            {t('home.headline')}
                        </h1>
                        <p className="max-w-2xl text-lg text-muted-foreground">
                            {t('home.subline')}
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            <a
                                href="#demo"
                                className={buttonClass('solid', 'lg')}
                            >
                                {t('home.ctaDemo')}
                                <ArrowRight className="size-4" />
                            </a>
                            {contact.whatsapp && (
                                <ContactLink
                                    kind="whatsapp"
                                    number={contact.whatsapp}
                                    className={buttonClass('outline', 'lg')}
                                >
                                    <MessageCircle className="size-4 text-[#25D366]" />
                                    {t('home.ctaWhatsapp')}
                                </ContactLink>
                            )}
                        </div>
                        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                            {['trial', 'card', 'bangla'].map((k) => (
                                <li
                                    key={k}
                                    className="flex items-center gap-1.5"
                                >
                                    <Check className="size-4 text-[#4264FB]" />
                                    {t(`home.trust.${k}`)}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="mt-10 overflow-hidden">
                        <Skyline />
                    </div>
                    <div className="relative mx-auto -mt-24 max-w-6xl px-4 sm:-mt-36">
                        <Screen
                            src={img('dashboard')}
                            alt={t('home.shots.dashboard')}
                            eager
                        />
                        {shot('home') && (
                            <PhoneFrame
                                src={shot('home')!}
                                alt={t('home.shots.app')}
                                className="absolute right-0 -bottom-10 hidden w-48 md:block lg:-right-6 lg:w-56"
                            />
                        )}
                    </div>
                </section>

                {/* Who uses it */}
                <section className="mx-auto max-w-6xl px-4 pt-24 pb-6">
                    <p className="text-center text-sm font-medium text-muted-foreground">
                        {t('home.rolesTitle')}
                    </p>
                    <ul className="mt-6 flex flex-wrap justify-center gap-3">
                        {roles.map(({ icon: Icon, key }) => (
                            <li
                                key={key}
                                className="flex items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-medium"
                            >
                                <Icon className="size-4 text-[#4264FB]" />
                                {t(`home.roles.${key}`)}
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Problems we fix */}
                <section className="mx-auto max-w-6xl px-4 py-20">
                    <SectionHead
                        eyebrow={t('home.pains.eyebrow')}
                        title={t('home.pains.title')}
                        text={t('home.pains.text')}
                    />
                    <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {pains.map(({ icon: Icon, key }) => (
                            <article
                                key={key}
                                className="flex flex-col gap-4 rounded-2xl border bg-card p-6"
                            >
                                <div className="flex items-start gap-3">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
                                        <Icon className="size-5" />
                                    </span>
                                    <div>
                                        <p className="font-semibold">
                                            {t(
                                                `home.pains.items.${key}.problem`,
                                            )}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {t(`home.pains.items.${key}.cost`)}
                                        </p>
                                    </div>
                                </div>
                                <p className="flex items-start gap-2 rounded-xl bg-[#4264FB]/5 p-3 text-sm">
                                    <Check className="mt-0.5 size-4 shrink-0 text-[#4264FB]" />
                                    <span>
                                        <span className="font-semibold text-[#4264FB]">
                                            {t('home.pains.with')}
                                        </span>{' '}
                                        {t(`home.pains.items.${key}.fix`)}
                                    </span>
                                </p>
                            </article>
                        ))}
                    </div>
                </section>

                {/* Demo form, early */}
                <section
                    id="demo"
                    className="scroll-mt-20 bg-gradient-to-br from-[#EEF2FF] via-background to-[#EEF2FF] py-20 dark:from-[#141A2E] dark:to-[#141A2E]"
                >
                    <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 lg:grid-cols-2">
                        <div className="flex flex-col gap-5">
                            <Eyebrow>{t('home.form.eyebrow')}</Eyebrow>
                            <h2 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
                                {t('home.form.heading')}
                            </h2>
                            <p className="text-lg text-muted-foreground">
                                {t('home.form.text')}
                            </p>
                            <ul className="flex flex-col gap-3">
                                {['call', 'setup', 'train', 'trial'].map(
                                    (k) => (
                                        <li
                                            key={k}
                                            className="flex items-start gap-3"
                                        >
                                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#4264FB] text-white">
                                                <Check className="size-3.5" />
                                            </span>
                                            {t(`home.form.benefits.${k}`)}
                                        </li>
                                    ),
                                )}
                            </ul>
                        </div>
                        <LeadForm teamSizes={teamSizes} sent={leadSent} />
                    </div>
                </section>

                {/* Office panel */}
                <section
                    id="features"
                    className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24"
                >
                    <SectionHead
                        eyebrow={t('home.panel.eyebrow')}
                        title={t('home.panel.title')}
                        text={t('home.panel.text')}
                    />
                    <Screen
                        src={img('orders')}
                        alt={t('home.shots.orders')}
                        className="mt-12"
                    />
                    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
                        {[
                            { icon: BadgeCheck, key: 'approve' },
                            { icon: Truck, key: 'deliver' },
                            { icon: HandCoins, key: 'collect' },
                        ].map(({ icon: Icon, key }) => (
                            <div
                                key={key}
                                className="flex flex-col gap-3 rounded-2xl border bg-card p-6"
                            >
                                <span className="flex size-10 items-center justify-center rounded-xl bg-[#4264FB]/10 text-[#4264FB]">
                                    <Icon className="size-5" />
                                </span>
                                <p className="font-semibold">
                                    {t(`home.panel.${key}.title`)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {t(`home.panel.${key}.text`)}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Field app */}
                <section
                    id="app"
                    className="scroll-mt-20 border-y bg-card py-24"
                >
                    <div className="mx-auto max-w-6xl px-4">
                        <SectionHead
                            eyebrow={t('home.field.eyebrow')}
                            title={t('home.field.title')}
                            text={t('home.field.text')}
                        />
                    </div>
                    <div className="mx-auto mt-12 flex max-w-6xl snap-x gap-4 overflow-x-auto px-4 pb-4">
                        {fieldCards.map(
                            ({ key, shot: src, icon: Icon, bg }) => (
                                <article
                                    key={key}
                                    className={cn(
                                        'flex w-64 shrink-0 snap-start flex-col overflow-hidden rounded-3xl bg-gradient-to-b text-white sm:w-72',
                                        bg,
                                    )}
                                >
                                    <div className="flex flex-col gap-2 p-6">
                                        <Icon className="size-5 opacity-90" />
                                        <p className="text-lg leading-snug font-bold">
                                            {t(`home.field.cards.${key}.title`)}
                                        </p>
                                        <p className="text-sm text-white/80">
                                            {t(`home.field.cards.${key}.text`)}
                                        </p>
                                    </div>
                                    {src ? (
                                        <div className="mt-auto h-72 overflow-hidden px-6">
                                            <img
                                                src={src}
                                                alt={t(
                                                    `home.field.cards.${key}.title`,
                                                )}
                                                loading="lazy"
                                                className="block w-full rounded-t-[1.5rem] border-[6px] border-b-0 border-black/80 shadow-2xl"
                                            />
                                        </div>
                                    ) : (
                                        <div className="mt-auto flex h-72 items-center justify-center">
                                            <Icon className="size-20 opacity-30" />
                                        </div>
                                    )}
                                </article>
                            ),
                        )}
                    </div>
                </section>

                {/* Reports */}
                <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-24 lg:grid-cols-5">
                    <div className="flex flex-col gap-5 lg:col-span-2">
                        <Eyebrow>{t('home.reports.eyebrow')}</Eyebrow>
                        <h2 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
                            {t('home.reports.title')}
                        </h2>
                        <ul className="flex flex-col gap-5">
                            {[
                                { icon: BarChart3, key: 'charts' },
                                { icon: FileDown, key: 'pdf' },
                                { icon: Wallet, key: 'dues' },
                            ].map(({ icon: Icon, key }) => (
                                <li key={key} className="flex gap-3">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#4264FB]/10 text-[#4264FB]">
                                        <Icon className="size-5" />
                                    </span>
                                    <div>
                                        <p className="font-semibold">
                                            {t(`home.reports.${key}.title`)}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {t(`home.reports.${key}.text`)}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="relative rounded-3xl bg-gradient-to-br from-[#4264FB] via-[#5B7BFF] to-[#A5B8FF] p-6 sm:p-10 lg:col-span-3">
                        <Screen
                            src={img('reports')}
                            alt={t('home.shots.reports')}
                        />
                        <div className="absolute -bottom-5 left-4 flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-semibold shadow-xl sm:left-10">
                            <FileDown className="size-4 text-[#4264FB]" />
                            {t('home.reports.chip')}
                        </div>
                    </div>
                </section>

                {/* Six-card grid */}
                <section className="border-t bg-card py-24">
                    <div className="mx-auto max-w-6xl px-4">
                        <SectionHead
                            eyebrow={t('home.grid.eyebrow')}
                            title={t('home.grid.title')}
                            text={t('home.grid.text')}
                        />
                        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {grid.map(({ key, icon: Icon, image }) => (
                                <article
                                    key={key}
                                    className="flex flex-col overflow-hidden rounded-2xl border bg-background transition-shadow hover:shadow-lg"
                                >
                                    <div className="h-44 overflow-hidden border-b bg-muted">
                                        {/* Zoom past the panel sidebar onto the page itself. */}
                                        <img
                                            src={image}
                                            alt={t(
                                                `home.grid.items.${key}.title`,
                                            )}
                                            loading="lazy"
                                            className="block h-auto max-w-none"
                                            style={{
                                                width: '200%',
                                                marginLeft: '-36%',
                                                marginTop: '-7%',
                                            }}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5 p-5">
                                        <p className="flex items-center gap-2 font-semibold">
                                            <Icon className="size-4 text-[#4264FB]" />
                                            {t(`home.grid.items.${key}.title`)}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {t(`home.grid.items.${key}.text`)}
                                        </p>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                {/* GPS */}
                <section className="relative overflow-hidden py-24">
                    <div
                        className="absolute inset-0 opacity-60"
                        style={{
                            backgroundImage: `radial-gradient(${brand}55 1px, transparent 1.5px)`,
                            backgroundSize: '18px 18px',
                            maskImage:
                                'radial-gradient(ellipse at center, black 30%, transparent 75%)',
                        }}
                        aria-hidden
                    />
                    <div className="relative mx-auto max-w-6xl px-4">
                        <SectionHead
                            eyebrow={t('home.gps.eyebrow')}
                            title={t('home.gps.title')}
                            text={t('home.gps.text')}
                        />
                        <div className="relative mx-auto mt-12 h-80 max-w-3xl">
                            {[
                                [18, 30],
                                [32, 62],
                                [48, 24],
                                [62, 58],
                                [76, 34],
                                [86, 70],
                                [24, 78],
                                [55, 82],
                            ].map(([x, y], i) => (
                                <span
                                    key={i}
                                    className="absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card text-[#4264FB] shadow-lg"
                                    style={{ left: `${x}%`, top: `${y}%` }}
                                >
                                    <MapPin className="size-4" />
                                </span>
                            ))}
                            <div className="absolute top-1/2 left-1/2 w-72 -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-5 shadow-2xl">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">
                                    {t('home.gps.cardTitle')}
                                </p>
                                <ul className="mt-3 flex flex-col gap-2 text-sm">
                                    {['far', 'mock', 'accuracy'].map((k) => (
                                        <li
                                            key={k}
                                            className="flex items-center justify-between gap-2"
                                        >
                                            <span>
                                                {t(`home.gps.flags.${k}`)}
                                            </span>
                                            <span className="rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-xs font-medium text-[#92400E]">
                                                {t('home.gps.flagged')}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Dark: control + how it works */}
                <section className="bg-[#0B1020] py-24 text-white">
                    <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 lg:grid-cols-2">
                        <div
                            className="relative mx-auto aspect-square w-full max-w-md"
                            aria-hidden
                        >
                            {[88, 68, 48, 30].map((s) => (
                                <span
                                    key={s}
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15"
                                    style={{ width: `${s}%`, height: `${s}%` }}
                                />
                            ))}
                            <span className="absolute top-1/2 left-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-[#4264FB] shadow-[0_0_60px_#4264FB]">
                                <ShieldCheck className="size-9" />
                            </span>
                            {[
                                // Inset from the edge so nothing pokes out on narrow screens.
                                { icon: UserCog, x: 50, y: 6 },
                                { icon: Smartphone, x: 94, y: 50 },
                                { icon: Fingerprint, x: 50, y: 94 },
                                { icon: WifiOff, x: 6, y: 50 },
                            ].map(({ icon: Icon, x, y }, i) => (
                                <span
                                    key={i}
                                    className="absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#141A2E]"
                                    style={{ left: `${x}%`, top: `${y}%` }}
                                >
                                    <Icon className="size-5 text-[#8EA2FF]" />
                                </span>
                            ))}
                        </div>
                        <div className="flex flex-col gap-6">
                            <Eyebrow dark>{t('home.control.eyebrow')}</Eyebrow>
                            <h2 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
                                {t('home.control.title')}
                            </h2>
                            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                {['roles', 'device', 'gps', 'offline'].map(
                                    (k) => (
                                        <li
                                            key={k}
                                            className="flex flex-col gap-1"
                                        >
                                            <p className="flex items-center gap-2 font-semibold">
                                                <Check className="size-4 text-[#8EA2FF]" />
                                                {t(
                                                    `home.control.items.${k}.title`,
                                                )}
                                            </p>
                                            <p className="text-sm text-white/65">
                                                {t(
                                                    `home.control.items.${k}.text`,
                                                )}
                                            </p>
                                        </li>
                                    ),
                                )}
                            </ul>
                        </div>
                    </div>

                    <div className="mx-auto mt-24 max-w-6xl px-4">
                        <SectionHead
                            dark
                            eyebrow={t('home.steps.eyebrow')}
                            title={t('home.steps.title')}
                        />
                        <ol className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
                            {['company', 'setup', 'orders'].map((k, i) => (
                                <li
                                    key={k}
                                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                                >
                                    <span className="flex size-11 items-center justify-center rounded-full bg-[#4264FB] text-lg font-extrabold">
                                        {f.num(i + 1)}
                                    </span>
                                    <p className="text-lg font-semibold">
                                        {t(`home.steps.items.${k}.title`)}
                                    </p>
                                    <p className="text-sm text-white/65">
                                        {t(`home.steps.items.${k}.text`)}
                                    </p>
                                </li>
                            ))}
                        </ol>
                        <div className="mt-10 flex justify-center">
                            <a
                                href="#demo"
                                className={buttonClass('white', 'lg')}
                            >
                                {t('home.ctaDemo')}
                                <ArrowRight className="size-4" />
                            </a>
                        </div>
                    </div>
                </section>

                {/* Prices */}
                {plans.length > 0 && (
                    <section
                        id="pricing"
                        className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24"
                    >
                        <SectionHead
                            eyebrow={t('home.pricing.eyebrow')}
                            title={t('home.pricing.title')}
                            text={t('home.pricing.text')}
                        />
                        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
                            {plans.map((p, i) => {
                                const featured = plans.length === 3 && i === 1;

                                return (
                                    <div
                                        key={p.key}
                                        className={cn(
                                            'flex flex-col gap-4 rounded-3xl border bg-card p-7',
                                            featured &&
                                                'border-[#4264FB] shadow-xl ring-2 ring-[#4264FB] md:-translate-y-3',
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="text-lg font-bold">
                                                {locale === 'bn' && p.name_bn
                                                    ? p.name_bn
                                                    : p.name}
                                            </p>
                                            {featured && (
                                                <span className="rounded-full bg-[#4264FB] px-2.5 py-0.5 text-xs font-semibold text-white">
                                                    {t('home.pricing.popular')}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-4xl font-extrabold tabular-nums">
                                            {f.taka(p.price)}
                                            <span className="text-sm font-normal text-muted-foreground">
                                                {' '}
                                                / {t('home.pricing.month')}
                                            </span>
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {t('home.pricing.perStaff', {
                                                price: f.taka(
                                                    Math.round(
                                                        p.price /
                                                            Math.max(
                                                                1,
                                                                p.staffLimit,
                                                            ),
                                                    ),
                                                ),
                                            })}
                                        </p>
                                        <ul className="flex flex-col gap-2 text-sm">
                                            {[
                                                t('home.pricing.staff', {
                                                    n: f.num(p.staffLimit),
                                                }),
                                                t('home.pricing.app'),
                                                t('home.pricing.reports'),
                                                t('home.pricing.support'),
                                            ].map((line) => (
                                                <li
                                                    key={line}
                                                    className="flex items-center gap-2"
                                                >
                                                    <Check className="size-4 text-[#4264FB]" />
                                                    {line}
                                                </li>
                                            ))}
                                        </ul>
                                        <a
                                            href="#demo"
                                            className={cn(
                                                buttonClass(
                                                    featured
                                                        ? 'solid'
                                                        : 'outline',
                                                ),
                                                'mt-auto',
                                            )}
                                        >
                                            {t('home.pricing.cta')}
                                        </a>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <X className="size-4" />
                            {t('home.pricing.noContract')}
                        </p>
                    </section>
                )}

                {/* FAQ */}
                <section
                    id="faq"
                    className="scroll-mt-20 border-t bg-card py-24"
                >
                    <div className="mx-auto max-w-3xl px-4">
                        <SectionHead
                            eyebrow={t('home.faq.eyebrow')}
                            title={t('home.faq.title')}
                        />
                        <div className="mt-10 flex flex-col gap-3">
                            {faqs.map((k) => (
                                <details
                                    key={k}
                                    className="group rounded-2xl border bg-background px-5 py-4 open:shadow-sm"
                                >
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                                        {t(`home.faq.items.${k}.q`)}
                                        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                                    </summary>
                                    <p className="mt-3 text-sm text-muted-foreground">
                                        {t(`home.faq.items.${k}.a`)}
                                    </p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Final call to action */}
                <section className="px-4 py-16">
                    <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#2A47C7] via-[#4264FB] to-[#7C93FF] px-6 py-16 text-white">
                        <div className="absolute inset-x-0 bottom-0 opacity-25">
                            <Skyline />
                        </div>
                        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
                            <h2 className="text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">
                                {t('home.final.title')}
                            </h2>
                            <p className="text-lg text-white/85">
                                {t('home.final.text')}
                            </p>
                            <div className="flex flex-wrap justify-center gap-3">
                                <a
                                    href="#demo"
                                    className={buttonClass('white', 'lg')}
                                >
                                    {t('home.ctaDemo')}
                                    <ArrowRight className="size-4" />
                                </a>
                                {contact.whatsapp && (
                                    <ContactLink
                                        kind="whatsapp"
                                        number={contact.whatsapp}
                                        className={buttonClass(
                                            'whatsapp',
                                            'lg',
                                        )}
                                    >
                                        <MessageCircle className="size-4" />
                                        {t('home.ctaWhatsapp')}
                                    </ContactLink>
                                )}
                            </div>
                            <ul className="flex flex-wrap justify-center gap-2 text-xs">
                                {['trial', 'card', 'bangla'].map((k) => (
                                    <li
                                        key={k}
                                        className="rounded-full border border-white/30 px-3 py-1"
                                    >
                                        {t(`home.trust.${k}`)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                <SiteFooter contact={contact} />
                <MobileCtaBar contact={contact} />
            </div>
        </>
    );
}
