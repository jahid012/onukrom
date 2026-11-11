import type { Locale } from '@/i18n';

/**
 * Money, number and date formatting for Bangladesh.
 * Both locales use lakh/crore grouping (১৮,৪২,৩০০ / 18,42,300); Bangla
 * shows Bangla digits and month names. Demo data is in taka — the real API
 * sends integer paisa (spec §6), so divide by 100 first.
 */
export type Formatter = ReturnType<typeof createFormatter>;

const tags: Record<Locale, string> = { bn: 'bn-BD', en: 'en-IN' };

const shortUnits: Record<Locale, { k: string; l: string; cr: string }> = {
    bn: { k: ' হাজার', l: ' লাখ', cr: ' কোটি' },
    en: { k: 'k', l: 'L', cr: 'Cr' },
};

export function createFormatter(locale: Locale) {
    const tag = tags[locale];
    const int = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
    const dec1 = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
    const units = shortUnits[locale];

    const num = (value: number) => int.format(Math.round(value));

    return {
        locale,
        num,
        taka: (value: number) => `৳ ${num(value)}`,
        /** Short form for axes and tight spaces: ৳ 12.4k / ৳ ১২.৪ হাজার */
        takaShort(value: number) {
            const abs = Math.abs(value);

            if (abs >= 1_00_00_000) {
                return `৳ ${dec1.format(value / 1_00_00_000)}${units.cr}`;
            }

            if (abs >= 1_00_000) {
                return `৳ ${dec1.format(value / 1_00_000)}${units.l}`;
            }

            if (abs >= 1_000) {
                return `৳ ${int.format(value / 1_000)}${units.k}`;
            }

            return `৳ ${num(value)}`;
        },
        percent: (value: number, digits = 0) =>
            `${new Intl.NumberFormat(tag, {
                minimumFractionDigits: digits,
                maximumFractionDigits: digits,
            }).format(value)}%`,
        signedPercent: (value: number) =>
            `${value >= 0 ? '+' : '−'}${dec1.format(Math.abs(value))}%`,
        date: (date: Date, options: Intl.DateTimeFormatOptions) =>
            new Intl.DateTimeFormat(tag, options).format(date),
    };
}
