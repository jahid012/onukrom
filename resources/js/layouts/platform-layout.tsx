import { Link, usePage } from '@inertiajs/react';
import {
    Building2,
    CreditCard,
    Inbox,
    LayoutDashboard,
    LifeBuoy,
    Moon,
    Settings,
    Sun,
    Tags,
    UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { FlashMessages } from '@/components/flash-messages';
import { NavUser } from '@/components/nav-user';
import { Button } from '@/components/ui/button';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarTrigger,
} from '@/components/ui/sidebar';
import { useAppearance } from '@/hooks/use-appearance';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { dashboard, settings as platformSettings } from '@/routes/platform';
import { index as companiesIndex } from '@/routes/platform/companies';
import { index as invoicesIndex } from '@/routes/platform/invoices';
import { index as leadsIndex } from '@/routes/platform/leads';
import { index as plansIndex } from '@/routes/platform/plans';
import { index as supportIndex } from '@/routes/platform/support';
import { index as teamIndex } from '@/routes/platform/team';
import type { BreadcrumbItem } from '@/types';

type Item = {
    title: string;
    icon: LucideIcon;
    href: ReturnType<typeof dashboard>;
    superOnly?: boolean;
};

const groups: { label: string; items: Item[] }[] = [
    {
        label: 'Platform',
        items: [
            { title: 'Dashboard', icon: LayoutDashboard, href: dashboard() },
            { title: 'Companies', icon: Building2, href: companiesIndex() },
            { title: 'Leads', icon: Inbox, href: leadsIndex() },
            { title: 'Support', icon: LifeBuoy, href: supportIndex() },
        ],
    },
    {
        label: 'Billing',
        items: [
            {
                title: 'Invoices',
                icon: CreditCard,
                href: invoicesIndex(),
                superOnly: true,
            },
            {
                title: 'Plans & prices',
                icon: Tags,
                href: plansIndex(),
                superOnly: true,
            },
        ],
    },
    {
        label: 'Admin',
        items: [
            {
                title: 'Team',
                icon: UsersRound,
                href: teamIndex(),
                superOnly: true,
            },
            {
                title: 'Settings',
                icon: Settings,
                href: platformSettings(),
                superOnly: true,
            },
        ],
    },
];

/**
 * Onukrom's own panel (super admin + support staff). English only: it is an
 * internal tool. Company pages use AppLayout and the company's language.
 */
export default function PlatformLayout({
    children,
    breadcrumbs = [],
}: {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
}) {
    const { auth } = usePage().props;
    const { isCurrentUrl, isCurrentOrParentUrl } = useCurrentUrl();
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const dark = resolvedAppearance === 'dark';
    const isSuper = auth.user.platform_role === 'super_admin';

    return (
        <AppShell variant="sidebar">
            <Sidebar collapsible="icon" variant="sidebar">
                <SidebarHeader className="border-b border-sidebar-border">
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton size="lg" asChild>
                                <Link href={dashboard()}>
                                    <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                                        <AppLogoIcon className="size-5 fill-current" />
                                    </div>
                                    <div className="ml-1 grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-semibold">
                                            Onukrom
                                        </span>
                                        <span className="truncate text-xs text-muted-foreground">
                                            {isSuper
                                                ? 'Super admin'
                                                : 'Support'}
                                        </span>
                                    </div>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent className="gap-0 py-2">
                    {groups.map((group) => {
                        const items = group.items.filter(
                            (i) => isSuper || !i.superOnly,
                        );

                        if (items.length === 0) {
                            return null;
                        }

                        return (
                            <SidebarGroup key={group.label} className="py-1">
                                <SidebarGroupLabel className="h-7 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                    {group.label}
                                </SidebarGroupLabel>
                                <SidebarMenu>
                                    {items.map((item) => (
                                        <SidebarMenuItem key={item.title}>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={
                                                    item.href.url ===
                                                    dashboard().url
                                                        ? isCurrentUrl(
                                                              item.href,
                                                          )
                                                        : isCurrentOrParentUrl(
                                                              item.href,
                                                          )
                                                }
                                                tooltip={{
                                                    children: item.title,
                                                }}
                                            >
                                                <Link href={item.href}>
                                                    <item.icon />
                                                    <span>{item.title}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroup>
                        );
                    })}
                </SidebarContent>
                <SidebarFooter className="border-t border-sidebar-border">
                    <NavUser />
                </SidebarFooter>
            </Sidebar>
            <AppContent variant="sidebar" className="min-w-0 overflow-x-clip">
                <header className="no-print sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 md:px-6">
                    <SidebarTrigger className="-ml-1" />
                    <div className="hidden min-w-0 flex-1 sm:block">
                        <Breadcrumbs breadcrumbs={breadcrumbs} />
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={dark ? 'Light mode' : 'Dark mode'}
                            onClick={() =>
                                updateAppearance(dark ? 'light' : 'dark')
                            }
                        >
                            {dark ? (
                                <Sun className="size-4" />
                            ) : (
                                <Moon className="size-4" />
                            )}
                        </Button>
                    </div>
                </header>
                {children}
            </AppContent>
            <FlashMessages />
        </AppShell>
    );
}
