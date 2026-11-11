import { useTranslation } from 'react-i18next';
import type { Locale } from '@/i18n';
import { createFormatter } from '@/lib/format';

/**
 * Translation + locale-aware formatting in one hook. Using it (instead of
 * importing formatters directly) makes the component re-render when the
 * language changes.
 */
export function useFormat() {
    const { t, i18n } = useTranslation();
    const locale: Locale = i18n.language === 'en' ? 'en' : 'bn';

    return { t, f: createFormatter(locale), locale };
}
