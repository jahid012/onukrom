import { router } from '@inertiajs/react';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Locale } from '@/i18n';
import { applyLocale, locales } from '@/i18n';
import { cn } from '@/lib/utils';
import { update } from '@/routes/locale';

function switchTo(locale: Locale) {
    applyLocale(locale); // instant UI switch
    router.post(
        update(),
        { locale },
        { preserveScroll: true, preserveState: true },
    );
}

/**
 * Flat segmented switch: বাংলা | English.
 * `compact` shows short labels (বাং | EN) for the top bar.
 */
export function LanguageSwitcher({
    compact = false,
    className,
}: {
    compact?: boolean;
    className?: string;
}) {
    const { t, i18n } = useTranslation();
    const current = i18n.language === 'en' ? 'en' : 'bn';

    return (
        <div
            role="radiogroup"
            aria-label={t('common.switchLanguage')}
            className={cn(
                'inline-flex items-center gap-0.5 rounded-md border bg-card p-0.5',
                className,
            )}
        >
            {compact && (
                <Languages
                    className="mx-1 size-3.5 text-muted-foreground"
                    aria-hidden
                />
            )}
            {locales.map((l) => {
                const active = current === l.code;

                return (
                    <button
                        key={l.code}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        lang={l.code}
                        onClick={() => !active && switchTo(l.code)}
                        className={cn(
                            'rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none',
                            active
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                    >
                        {compact ? l.short : l.label}
                    </button>
                );
            })}
        </div>
    );
}
