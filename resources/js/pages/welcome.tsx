import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    BarChart3,
    FileDown,
    MapPinned,
    Phone,
    ShoppingCart,
    Smartphone,
    Truck,
    WifiOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';
import { dashboard, login } from '@/routes';

type Plan = {
    key: string;
    name: string;
    name_bn: string | null;
    price: number;
    staffLimit: number;
};

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
                'overflow-hidden rounded-lg border bg-card shadow-xl',
                className,
            )}
        >
            <div className="flex h-7 items-center gap-1.5 border-b bg-muted px-3">
                <span className="size-2.5 rounded-full bg-danger/60" />
                <span className="size-2.5 rounded-full bg-warning/60" />
                <span className="size-2.5 rounded-full bg-success/60" />
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
function PhoneShot({ src, alt }: { src: string; alt: string }) {
    return (
        <figure className="w-44 shrink-0 overflow-hidden rounded-[1.6rem] border-[6px] border-foreground/90 bg-card shadow-xl sm:w-52">
            <img
                src={src}
                alt={alt}
                loading="lazy"
                className="block h-auto w-full"
            />
        </figure>
    );
}

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
    const signedIn = Boolean(auth.user);

    const features: { icon: LucideIcon; key: string; img: string }[] = [
        {
            icon: ShoppingCart,
            key: 'orders',
            img: '/images/home/admin-orders.webp',
        },
        {
            icon: BarChart3,
            key: 'reports',
            img: '/images/home/admin-reports.webp',
        },
        { icon: MapPinned, key: 'areas', img: '/images/home/admin-areas.webp' },
        { icon: Truck, key: 'stock', img: '/images/home/admin-stock.webp' },
    ];

    return (
        <>
            <Head title={t('home.title')}>
                <meta name="description" content={t('home.metaDescription')} />
            </Head>

            <div className="min-h-svh bg-background text-foreground">
                {/* Top bar */}
                <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
                    <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
                        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                            <AppLogoIcon className="size-5 fill-current" />
                        </div>
                        <span className="font-semibold">Onukrom</span>
                        <div className="ml-auto flex items-center gap-2">
                            <LanguageSwitcher compact />
                            <Button asChild size="sm">
                                <Link href={signedIn ? dashboard() : login()}>
                                    {signedIn
                                        ? t('home.openPanel')
                                        : t('home.login')}
                                </Link>
                            </Button>
                        </div>
                    </div>
                </header>

                {/* Hero: one line of text, the product does the talking */}
                <section className="mx-auto max-w-6xl px-4 pt-12 pb-8 text-center sm:pt-16">
                    <h1 className="mx-auto max-w-3xl text-3xl leading-tight font-bold tracking-tight sm:text-5xl">
                        {t('home.headline')}
                    </h1>
                    <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
                        {t('home.subline')}
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <Button asChild size="lg">
                            <Link href={signedIn ? dashboard() : login()}>
                                {signedIn
                                    ? t('home.openPanel')
                                    : t('home.start')}
                                <ArrowRight className="size-4" />
                            </Link>
                        </Button>
                        {supportPhone && (
                            <Button asChild size="lg" variant="outline">
                                <a href={`tel:${supportPhone}`}>
                                    <Phone className="size-4" />
                                    {supportPhone}
                                </a>
                            </Button>
                        )}
                    </div>
                </section>

                <section className="relative mx-auto max-w-6xl px-4 pb-16">
                    <Screen
                        src="/images/home/admin-dashboard.webp"
                        alt={t('home.shots.dashboard')}
                        eager
                    />
                    {appShots[0] && (
                        <div className="absolute right-2 -bottom-2 hidden md:block lg:right-[-1rem]">
                            <PhoneShot
                                src={appShots[0]}
                                alt={t('home.shots.app')}
                            />
                        </div>
                    )}
                </section>

                {/* Three facts, icon-first */}
                <section className="border-y bg-card">
                    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-10 sm:grid-cols-3">
                        {[
                            { icon: Smartphone, key: 'app' },
                            { icon: WifiOff, key: 'offline' },
                            { icon: FileDown, key: 'pdf' },
                        ].map(({ icon: Icon, key }) => (
                            <div key={key} className="flex items-start gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                                    <Icon className="size-5" />
                                </span>
                                <div>
                                    <p className="font-semibold">
                                        {t(`home.facts.${key}.title`)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {t(`home.facts.${key}.text`)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Gallery: big pictures, one line each */}
                <section className="mx-auto max-w-6xl px-4 py-16">
                    <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
                        {t('home.galleryTitle')}
                    </h2>
                    <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
                        {features.map(({ icon: Icon, key, img }) => (
                            <div key={key} className="flex flex-col gap-3">
                                <Screen
                                    src={img}
                                    alt={t(`home.shots.${key}`)}
                                />
                                <p className="flex items-center gap-2 font-semibold">
                                    <Icon className="size-4 text-primary" />
                                    {t(`home.shots.${key}`)}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* The app, if we have pictures of it */}
                {appShots.length > 0 && (
                    <section className="border-y bg-card">
                        <div className="mx-auto max-w-6xl px-4 py-16">
                            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
                                {t('home.appTitle')}
                            </h2>
                            <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
                                {t('home.appText')}
                            </p>
                            <div className="mt-10 flex gap-5 overflow-x-auto pb-4 sm:justify-center">
                                {appShots.map((src) => (
                                    <PhoneShot
                                        key={src}
                                        src={src}
                                        alt={t('home.shots.app')}
                                    />
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* Prices */}
                {plans.length > 0 && (
                    <section className="mx-auto max-w-6xl px-4 py-16">
                        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
                            {t('home.pricesTitle')}
                        </h2>
                        <p className="mt-2 text-center text-muted-foreground">
                            {t('home.pricesText')}
                        </p>
                        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                            {plans.map((p) => (
                                <div
                                    key={p.key}
                                    className="flex flex-col gap-2 rounded-lg border bg-card p-6"
                                >
                                    <p className="font-semibold">
                                        {locale === 'bn' && p.name_bn
                                            ? p.name_bn
                                            : p.name}
                                    </p>
                                    <p className="text-3xl font-bold tabular-nums">
                                        {f.taka(p.price)}
                                        <span className="text-sm font-normal text-muted-foreground">
                                            {' '}
                                            / {t('home.month')}
                                        </span>
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {t('home.staffUpTo', {
                                            n: f.num(p.staffLimit),
                                        })}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <footer className="border-t bg-card">
                    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-6 text-sm text-muted-foreground">
                        <span>© {new Date().getFullYear()} Onukrom</span>
                        {supportPhone && (
                            <a
                                href={`tel:${supportPhone}`}
                                className="ml-auto flex items-center gap-1.5 hover:text-foreground"
                            >
                                <Phone className="size-4" />
                                {supportPhone}
                            </a>
                        )}
                    </div>
                </footer>
            </div>
        </>
    );
}
