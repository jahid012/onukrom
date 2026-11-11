import { Loader2, ShieldAlert, WifiOff } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { loadState, startSync, useAdminData } from '@/data/admin/store';

/**
 * Pages render only after the company's data has arrived from the server,
 * so no page ever has to deal with an empty store.
 */
export function DataGate({ children }: { children: React.ReactNode }) {
    const { t } = useTranslation();
    const { ready, loadError } = useAdminData();

    useEffect(() => startSync(), []);

    if (ready) {
        return children;
    }

    if (loadError) {
        const Icon = loadError === 'forbidden' ? ShieldAlert : WifiOff;

        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <Icon className="size-8 text-muted-foreground" />
                <p className="max-w-sm text-sm text-muted-foreground">
                    {t(`admin.sync.load.${loadError}`)}
                </p>
                {loadError !== 'forbidden' && (
                    <Button variant="outline" onClick={() => void loadState()}>
                        {t('admin.sync.retry')}
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-1 items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('admin.sync.loading')}
        </div>
    );
}
