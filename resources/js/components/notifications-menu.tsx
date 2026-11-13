import { router } from '@inertiajs/react';
import {
    Bell,
    BellOff,
    MapPinOff,
    PackageMinus,
    ShoppingCart,
    Store,
    Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { markNotificationsRead, useAdminData } from '@/data/admin/store';
import type { NotificationKind } from '@/data/admin/store';
import { useAdmin } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';

const icons: Record<NotificationKind, LucideIcon> = {
    order: ShoppingCart,
    location: MapPinOff,
    deposit: Wallet,
    shop: Store,
    stock: PackageMinus,
};

export function NotificationsMenu() {
    const { t, f, ago } = useAdmin();
    const { notifications, orders } = useAdminData();
    const pending = orders.filter((o) => o.status === 'pending').length;

    // Numbers in the text use the current language digits; the order count is live.
    const params = (kind: NotificationKind, text: Record<string, string>) =>
        Object.fromEntries(
            Object.entries(
                kind === 'order' ? { ...text, n: String(pending) } : text,
            ).map(([k, v]) => [k, /^\d+$/.test(v) ? f.num(Number(v)) : v]),
        );
    const unread = notifications.filter((n) => !n.read).length;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    data-tour="notifications"
                    aria-label={t('header.notifications', { n: f.num(unread) })}
                >
                    <Bell className="size-4" />
                    {unread > 0 && (
                        <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">
                            {f.num(unread)}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                    {t('header.notificationsTitle')}
                    {unread > 0 && (
                        <button
                            type="button"
                            className="text-xs font-normal text-muted-foreground underline-offset-4 hover:underline"
                            onClick={(e) => {
                                e.preventDefault();
                                markNotificationsRead();
                            }}
                        >
                            {t('header.markRead')}
                        </button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 && (
                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                        <BellOff className="size-6 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            {t('header.noNotifications')}
                        </p>
                    </div>
                )}
                {notifications.map((n) => {
                    const Icon = icons[n.kind];

                    return (
                        <DropdownMenuItem
                            key={n.id}
                            className="items-start gap-3 py-2"
                            onSelect={() => router.visit(n.href)}
                        >
                            <Icon
                                className={cn(
                                    'mt-0.5 size-4',
                                    n.read
                                        ? 'text-muted-foreground'
                                        : 'text-primary',
                                )}
                            />
                            <span className="min-w-0 flex-1">
                                <span
                                    className={cn(
                                        'block text-sm',
                                        !n.read && 'font-medium',
                                    )}
                                >
                                    {t(
                                        `header.notification.${n.kind}`,
                                        params(n.kind, n.text),
                                    )}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                    {ago(n.minutesAgo)}
                                </span>
                            </span>
                            {!n.read && (
                                <span
                                    className="mt-1.5 size-2 rounded-full bg-primary"
                                    aria-hidden
                                />
                            )}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
