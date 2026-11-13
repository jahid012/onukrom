import { router, usePage } from '@inertiajs/react';
import { Eye, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/hooks/use-format';
import { stop } from '@/routes/impersonation';

/** Shown on every page while platform staff view a company as its owner. */
export function ImpersonationBanner() {
    const { t } = useFormat();
    const { auth } = usePage().props;

    if (!auth.impersonator) {
        return null;
    }

    return (
        <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-1 bg-warning px-4 py-2 text-sm font-medium text-white md:px-6">
            <Eye className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
                {t('impersonation.viewing', {
                    name: auth.user.name,
                    who: auth.impersonator,
                })}
            </span>
            <Button
                size="sm"
                variant="secondary"
                className="h-7"
                onClick={() => router.post(stop.url())}
            >
                <LogOut className="size-3.5" />
                {t('impersonation.stop')}
            </Button>
        </div>
    );
}
