import { Moon, Sun } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { GlobalSearch } from '@/components/global-search';
import { LanguageSwitcher } from '@/components/language-switcher';
import { NotificationsMenu } from '@/components/notifications-menu';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAppearance } from '@/hooks/use-appearance';
import { useFormat } from '@/hooks/use-format';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const { t } = useFormat();
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const dark = resolvedAppearance === 'dark';

    return (
        <header className="no-print sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <div className="hidden sm:block">
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>

            <GlobalSearch />

            <div className="flex shrink-0 items-center gap-1">
                <LanguageSwitcher compact className="hidden sm:inline-flex" />
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={
                        dark ? t('common.lightMode') : t('common.darkMode')
                    }
                    onClick={() => updateAppearance(dark ? 'light' : 'dark')}
                >
                    {dark ? (
                        <Sun className="size-4" />
                    ) : (
                        <Moon className="size-4" />
                    )}
                </Button>
                <NotificationsMenu />
            </div>
        </header>
    );
}
