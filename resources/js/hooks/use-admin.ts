import { useFormat } from '@/hooks/use-format';

/**
 * Helpers shared by the admin pages: translation + formatting + names that
 * have a Bangla variant (`name_bn`) + "time ago".
 */
export function useAdmin() {
    const base = useFormat();
    const { t, f, locale } = base;

    const name = (item: { name: string; name_bn?: string }) =>
        locale === 'bn' && item.name_bn ? item.name_bn : item.name;

    const ago = (minutes: number) => {
        if (minutes < 1) {
            return t('admin.time.justNow');
        }

        if (minutes < 60) {
            return t('admin.time.minAgo', { n: f.num(minutes) });
        }

        if (minutes < 24 * 60) {
            return t('admin.time.hoursAgo', {
                n: f.num(Math.floor(minutes / 60)),
            });
        }

        return t('admin.time.daysAgo', {
            n: f.num(Math.floor(minutes / 1440)),
        });
    };

    /** "2 ctn + 6 pcs" from base units and a pack size. */
    const qty = (pcs: number, packSize: number) => {
        const ctn = Math.floor(pcs / packSize);
        const rest = pcs % packSize;

        if (ctn === 0) {
            return t('admin.unit.pcs', { n: f.num(rest) });
        }

        if (rest === 0) {
            return t('admin.unit.ctn', { n: f.num(ctn) });
        }

        return t('admin.unit.mixed', { ctn: f.num(ctn), pcs: f.num(rest) });
    };

    return { ...base, name, ago, qty };
}
