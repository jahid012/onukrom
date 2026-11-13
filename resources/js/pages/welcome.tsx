import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    BadgeCheck,
    BarChart3,
    Boxes,
    Check,
    ChevronDown,
    Crown,
    FileDown,
    Fingerprint,
    HandCoins,
    MapPin,
    MapPinned,
    Phone,
    ShieldCheck,
    ShoppingCart,
    Smartphone,
    Sparkles,
    Store,
    Tags,
    Truck,
    UserCog,
    Users,
    Wallet,
    WifiOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';
import { dashboard, login } from '@/routes';

/* Brand blue of the app (#4264FB) and its tints, used only on this page. */
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

/** Primary call to action (brand blue, sharp corners). */
function Cta({
    href,
    children,
    variant = 'solid',
    className,
}: {
    href: string | ReturnType<typeof login>;
    children: ReactNode;
    variant?: 'solid' | 'outline' | 'white';
    className?: string;
}) {
    const cls = cn(
        'inline-flex h-11 items-center justify-center gap-2 px-5 text-sm font-semibold transition-colors',
        variant === 'solid' && 'bg-[#4264FB] text-white hover:bg-[#2A47C7]',
        variant === 'outline' &&
            'border border-border bg-card text-foreground hover:bg-muted',
        variant === 'white' && 'bg-white text-[#141A2E] hover:bg-white/90',
        className,
    );

    return typeof href === 'string' && href.startsWith('tel:') ? (
        <a href={href} className={cls}>
            {children}
        </a>
    ) : (
        <Link href={href} className={cls}>
            {children}
        </Link>
    );
}

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
                'inline-flex items-center gap-2 border px-3 py-1 text-xs font-semibold tracking-wide uppercase',
                dark
                    ? 'border-white/20 text-white/80'
                    : 'border-[#4264FB]/30 bg-[#4264FB]/5 text-[#4264FB]',
            )}
        >
            <span className="size-1.5 bg-[#4264FB]" aria-hidden />
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
                'overflow-hidden border bg-card shadow-2xl shadow-[#4264FB]/10',
                className,
            )}
        >
            <div className="flex h-7 items-center gap-1.5 border-b bg-muted px-3">
                <span className="size-2.5 bg-[#F87171]" />
                <span className="size-2.5 bg-[#FBBF24]" />
                <span className="size-2.5 bg-[#34D399]" />
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

/** Phone frame around an app screenshot. */
function Phone_({
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
                'overflow-hidden border-[6px] border-[#141A2E] bg-white shadow-2xl',
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
        // Two waves + a rise to the right: looks like growing sales.
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
                    className="flex-1"
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
    appShots,
    plans,
    supportPhone,
}: {
    appShots: string[];
    plans: Plan[];
    supportPhone: string;
}) {
    const { t, f, locale } = useFormat();
    const { auth } = usePage().props;
    const start = auth.user ? dashboard() : login();
    const shot = (name: string) => appShots.find((s) => s.includes(name));
    const img = (name: string) => `/images/home/admin-${name}.webp`;

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

    const faqs = ['trial', 'internet', 'phones', 'pay', 'data', 'help'];

    return (
        <>
            <Head title={t('home.title')}>
                <meta name="description" content={t('home.metaDescription')} />
            </Head>

            <div className="min-h-svh bg-background text-foreground">
                {/* Announcement */}
                <Link
                    href={start}
                    className="flex items-center justify-center gap-2 bg-[#4264FB] px-4 py-2 text-center text-xs font-medium text-white sm:text-sm"
                >
                    <Sparkles className="size-3.5 shrink-0" />
                    {t('home.announce')}
                    <ArrowRight className="size-3.5 shrink-0" />
                </Link>

                {/* Nav */}
                <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
                    <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
                        <Link href="/" className="flex items-center gap-2">
                            <span className="flex size-8 items-center justify-center bg-[#4264FB] text-white">
                                <AppLogoIcon className="size-5 fill-current" />
                            </span>
                            <span className="text-lg font-bold">Onukrom</span>
                        </Link>
                        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
                            {['features', 'app', 'pricing', 'faq'].map((k) => (
                                <a
                                    key={k}
                                    href={`#${k}`}
                                    className="hover:text-foreground"
                                >
                                    {t(`home.nav.${k}`)}
                                </a>
                            ))}
                        </nav>
                        <div className="ml-auto flex items-center gap-2">
                            <LanguageSwitcher compact />
                            {!auth.user && (
                                <Link
                                    href={login()}
                                    className="hidden px-3 text-sm font-medium hover:text-[#4264FB] sm:inline"
                                >
                                    {t('home.login')}
                                </Link>
                            )}
                            <Cta href={start} className="h-9 px-4">
                                {auth.user
                                    ? t('home.openPanel')
                                    : t('home.startFree')}
                            </Cta>
                        </div>
                    </div>
                </header>

                {/* Hero */}
                <section className="relative">
                    <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 pt-14 text-center sm:pt-20">
                        <Eyebrow>{t('home.eyebrow')}</Eyebrow>
                        <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-6xl">
                            {t('home.headline')}
                        </h1>
                        <p className="max-w-2xl text-lg text-muted-foreground">
                            {t('home.subline')}
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            <Cta href={start}>
                                {auth.user
                                    ? t('home.openPanel')
                                    : t('home.startFree')}
                                <ArrowRight className="size-4" />
                            </Cta>
                            {supportPhone && (
                                <Cta
                                    href={`tel:${supportPhone}`}
                                    variant="outline"
                                >
                                    <Phone className="size-4" />
                                    {t('home.talk')}
                                </Cta>
                            )}
                        </div>
                        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                            {['trial', 'bangla', 'offline'].map((k) => (
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
                            <Phone_
                                src={shot('home')!}
                                alt={t('home.shots.app')}
                                className="absolute right-0 -bottom-10 hidden w-48 md:block lg:-right-6 lg:w-56"
                            />
                        )}
                    </div>
                </section>

                {/* Who uses it */}
                <section className="mx-auto max-w-6xl px-4 pt-24 pb-8">
                    <p className="text-center text-sm font-medium text-muted-foreground">
                        {t('home.rolesTitle')}
                    </p>
                    <ul className="mt-6 flex flex-wrap justify-center gap-3">
                        {roles.map(({ icon: Icon, key }) => (
                            <li
                                key={key}
                                className="flex items-center gap-2 border bg-card px-4 py-2.5 text-sm font-medium"
                            >
                                <Icon className="size-4 text-[#4264FB]" />
                                {t(`home.roles.${key}`)}
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Office panel */}
                <section
                    id="features"
                    className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20"
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
                    <div className="mt-10 grid grid-cols-1 gap-px border bg-border sm:grid-cols-3">
                        {[
                            { icon: BadgeCheck, key: 'approve' },
                            { icon: Truck, key: 'deliver' },
                            { icon: HandCoins, key: 'collect' },
                        ].map(({ icon: Icon, key }) => (
                            <div
                                key={key}
                                className="flex flex-col gap-3 bg-card p-6"
                            >
                                <Icon className="size-6 text-[#4264FB]" />
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

                {/* Field app: colourful cards */}
                <section
                    id="app"
                    className="scroll-mt-20 border-y bg-card py-20"
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
                                        'flex w-64 shrink-0 snap-start flex-col overflow-hidden bg-gradient-to-b text-white sm:w-72',
                                        bg,
                                    )}
                                >
                                    <div className="flex flex-col gap-2 p-5">
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
                                                className="block w-full border-[5px] border-b-0 border-black/80 shadow-2xl"
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

                {/* Reports: split with a gradient panel */}
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
                                    <span className="flex size-9 shrink-0 items-center justify-center bg-[#4264FB]/10 text-[#4264FB]">
                                        <Icon className="size-4" />
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
                    <div className="relative bg-gradient-to-br from-[#4264FB] via-[#5B7BFF] to-[#A5B8FF] p-6 sm:p-10 lg:col-span-3">
                        <Screen
                            src={img('reports')}
                            alt={t('home.shots.reports')}
                        />
                        <div className="absolute -bottom-5 left-4 flex items-center gap-2 border bg-card px-4 py-3 text-sm font-semibold shadow-xl sm:left-10">
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
                                    className="flex flex-col overflow-hidden border bg-background"
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

                {/* GPS / map */}
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
                                    className="absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-card text-[#4264FB] shadow-lg"
                                    style={{ left: `${x}%`, top: `${y}%` }}
                                >
                                    <MapPin className="size-4" />
                                </span>
                            ))}
                            <div className="absolute top-1/2 left-1/2 w-72 -translate-x-1/2 -translate-y-1/2 border bg-card p-4 shadow-2xl">
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
                                            <span className="bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92400E]">
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
                            <span className="absolute top-1/2 left-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-[#4264FB] shadow-[0_0_60px_#4264FB]">
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
                                    className="absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-white/20 bg-[#141A2E]"
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
                        <ol className="mt-12 grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-3">
                            {['company', 'setup', 'orders'].map((k, i) => (
                                <li
                                    key={k}
                                    className="flex flex-col gap-3 bg-[#0B1020] p-6"
                                >
                                    <span className="text-4xl font-extrabold text-[#4264FB]">
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
                                            'flex flex-col gap-4 border bg-card p-7',
                                            featured &&
                                                'border-[#4264FB] ring-2 ring-[#4264FB] md:-translate-y-3',
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="text-lg font-bold">
                                                {locale === 'bn' && p.name_bn
                                                    ? p.name_bn
                                                    : p.name}
                                            </p>
                                            {featured && (
                                                <span className="bg-[#4264FB] px-2 py-0.5 text-xs font-semibold text-white">
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
                                        <Cta
                                            href={start}
                                            variant={
                                                featured ? 'solid' : 'outline'
                                            }
                                            className="mt-auto"
                                        >
                                            {t('home.startFree')}
                                        </Cta>
                                    </div>
                                );
                            })}
                        </div>
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
                        <div className="mt-10 divide-y border-y">
                            {faqs.map((k) => (
                                <details key={k} className="group py-4">
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

                {/* Big call to action */}
                <section className="relative overflow-hidden bg-gradient-to-br from-[#2A47C7] via-[#4264FB] to-[#7C93FF] py-24 text-white">
                    <div className="absolute inset-x-0 bottom-0 opacity-30">
                        <Skyline />
                    </div>
                    <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 text-center">
                        <h2 className="text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">
                            {t('home.final.title')}
                        </h2>
                        <p className="text-lg text-white/85">
                            {t('home.final.text')}
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            <Cta href={start} variant="white">
                                {auth.user
                                    ? t('home.openPanel')
                                    : t('home.startFree')}
                                <ArrowRight className="size-4" />
                            </Cta>
                            {supportPhone && (
                                <a
                                    href={`tel:${supportPhone}`}
                                    className="inline-flex h-11 items-center gap-2 border border-white/40 px-5 text-sm font-semibold hover:bg-white/10"
                                >
                                    <Phone className="size-4" />
                                    {supportPhone}
                                </a>
                            )}
                        </div>
                        <ul className="flex flex-wrap justify-center gap-2 text-xs">
                            {['trial', 'bangla', 'offline'].map((k) => (
                                <li
                                    key={k}
                                    className="border border-white/30 px-3 py-1"
                                >
                                    {t(`home.trust.${k}`)}
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* Footer */}
                <footer className="bg-[#0B1020] text-white/70">
                    <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-14 sm:grid-cols-4">
                        <div className="col-span-2 flex flex-col gap-3 sm:col-span-1">
                            <span className="flex items-center gap-2 text-white">
                                <span className="flex size-8 items-center justify-center bg-[#4264FB]">
                                    <AppLogoIcon className="size-5 fill-current" />
                                </span>
                                <span className="text-lg font-bold">
                                    Onukrom
                                </span>
                            </span>
                            <p className="text-sm">{t('home.footer.about')}</p>
                        </div>
                        <div className="flex flex-col gap-2 text-sm">
                            <p className="font-semibold text-white">
                                {t('home.footer.product')}
                            </p>
                            {['features', 'app', 'pricing', 'faq'].map((k) => (
                                <a
                                    key={k}
                                    href={`#${k}`}
                                    className="hover:text-white"
                                >
                                    {t(`home.nav.${k}`)}
                                </a>
                            ))}
                        </div>
                        <div className="flex flex-col gap-2 text-sm">
                            <p className="font-semibold text-white">
                                {t('home.footer.account')}
                            </p>
                            <Link href={login()} className="hover:text-white">
                                {t('home.login')}
                            </Link>
                            <Link href={start} className="hover:text-white">
                                {t('home.startFree')}
                            </Link>
                        </div>
                        <div className="flex flex-col gap-2 text-sm">
                            <p className="font-semibold text-white">
                                {t('home.footer.contact')}
                            </p>
                            {supportPhone ? (
                                <a
                                    href={`tel:${supportPhone}`}
                                    className="flex items-center gap-1.5 hover:text-white"
                                >
                                    <Phone className="size-4" />
                                    {supportPhone}
                                </a>
                            ) : (
                                <span>{t('home.footer.bangladesh')}</span>
                            )}
                        </div>
                    </div>
                    <div className="border-t border-white/10">
                        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-5 text-xs">
                            <span>© {new Date().getFullYear()} Onukrom</span>
                            <span className="ml-auto">
                                {t('home.footer.made')}
                            </span>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
