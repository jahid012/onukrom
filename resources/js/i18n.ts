import { router } from '@inertiajs/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import bn from '@/locales/bn.json';
import en from '@/locales/en.json';

export type Locale = 'bn' | 'en';

export const locales: { code: Locale; label: string; short: string }[] = [
    { code: 'bn', label: 'বাংলা', short: 'বাং' },
    { code: 'en', label: 'English', short: 'EN' },
];

export const DEFAULT_LOCALE: Locale = 'bn';

function normalize(value: unknown): Locale {
    return value === 'en' ? 'en' : 'bn';
}

/** The server renders <html lang="…"> from the `locale` cookie (default bn). */
const initial: Locale =
    typeof document === 'undefined'
        ? DEFAULT_LOCALE
        : normalize(document.documentElement.lang);

type Messages = Record<string, unknown>;

/**
 * Per-page files (locales/bn/orders.json …) are merged in under their file
 * name, so `orders.title` lives in locales/<lang>/orders.json.
 */
const pageFiles = {
    bn: import.meta.glob<Messages>('./locales/bn/*.json', {
        eager: true,
        import: 'default',
    }),
    en: import.meta.glob<Messages>('./locales/en/*.json', {
        eager: true,
        import: 'default',
    }),
};

function withPages(core: Messages, files: Record<string, Messages>) {
    const merged: Messages = { ...core };

    for (const [file, messages] of Object.entries(files)) {
        const namespace = file
            .split('/')
            .pop()!
            .replace(/\.json$/, '');
        merged[namespace] = messages;
    }

    return merged;
}

void i18n.use(initReactI18next).init({
    resources: {
        bn: { translation: withPages(bn, pageFiles.bn) },
        en: { translation: withPages(en, pageFiles.en) },
    },
    lng: initial,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
});

export function applyLocale(locale: Locale): void {
    if (i18n.language !== locale) {
        void i18n.changeLanguage(locale);
    }

    if (typeof document !== 'undefined') {
        document.documentElement.lang = locale;
    }
}

// Keep the UI in sync with the server's `locale` prop on every visit.
if (typeof window !== 'undefined') {
    router.on('navigate', (event) => {
        applyLocale(normalize(event.detail.page.props.locale));
    });
}

export default i18n;
