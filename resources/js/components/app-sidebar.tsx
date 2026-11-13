import { Link } from '@inertiajs/react';
import {
    BarChart3,
    CreditCard,
    LifeBuoy,
    LayoutDashboard,
    Map,
    Package,
    Settings,
    ShieldCheck,
    ShoppingCart,
    Store,
    Tags,
    Truck,
    Undo2,
    Users,
    Wallet,
    Warehouse,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { mainWarehouseId, useAdminData } from '@/data/admin/store';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useFormat } from '@/hooks/use-format';
import { dashboard } from '@/routes';
import { index as areasIndex } from '@/routes/areas';
import { index as billingIndex } from '@/routes/billing';
import { index as collectionsIndex } from '@/routes/collections';
import { settings as companySettings } from '@/routes/company';
import { index as deliveriesIndex } from '@/routes/deliveries';
import { index as ordersIndex } from '@/routes/orders';
import { index as pricingIndex } from '@/routes/pricing';
import { index as productsIndex } from '@/routes/products';
import { index as reportsIndex } from '@/routes/reports';
import { index as returnsIndex } from '@/routes/returns';
import { index as rolesIndex } from '@/routes/roles';
import { index as shopsIndex } from '@/routes/shops';
import { index as staffIndex } from '@/routes/staff';
import { index as stockIndex } from '@/routes/stock';
import { index as supportIndex } from '@/routes/support';

type MenuItem = {
    key: string; // translation key under nav.*
    icon: LucideIcon;
    href: ReturnType<typeof dashboard>;
};

type MenuGroup = { key: string; items: MenuItem[] };

const menu: MenuGroup[] = [
    {
        key: 'overview',
        items: [
            { key: 'dashboard', icon: LayoutDashboard, href: dashboard() },
            { key: 'reports', icon: BarChart3, href: reportsIndex() },
        ],
    },
    {
        key: 'sales',
        items: [
            {
                key: 'orders',
                icon: ShoppingCart,
                href: ordersIndex(),
            },
            { key: 'deliveries', icon: Truck, href: deliveriesIndex() },
            { key: 'collections', icon: Wallet, href: collectionsIndex() },
            { key: 'returns', icon: Undo2, href: returnsIndex() },
        ],
    },
    {
        key: 'customers',
        items: [
            { key: 'shops', icon: Store, href: shopsIndex() },
            { key: 'areas', icon: Map, href: areasIndex() },
        ],
    },
    {
        key: 'catalog',
        items: [
            { key: 'products', icon: Package, href: productsIndex() },
            { key: 'pricing', icon: Tags, href: pricingIndex() },
            { key: 'stock', icon: Warehouse, href: stockIndex() },
        ],
    },
    {
        key: 'team',
        items: [
            { key: 'staff', icon: Users, href: staffIndex() },
            { key: 'roles', icon: ShieldCheck, href: rolesIndex() },
            { key: 'settings', icon: Settings, href: companySettings() },
        ],
    },
    {
        key: 'account',
        items: [
            { key: 'billing', icon: CreditCard, href: billingIndex() },
            { key: 'support', icon: LifeBuoy, href: supportIndex() },
        ],
    },
];

export function AppSidebar() {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const { t, f } = useFormat();
    const state = useAdminData();
    const { orders, shops, products, stock, collections, deposits } = state;

    // Live counts of things waiting for the office.
    const badges: Record<string, number> = {
        orders: orders.filter((o) => o.status === 'pending').length,
        collections:
            collections.filter((c) => c.status === 'pending').length +
            deposits.filter((d) => d.status === 'waiting').length,
        shops: shops.filter((s) => s.status === 'pending_approval').length,
        stock: products.filter((p) => {
            const l = stock[mainWarehouseId(state)]?.[p.id];

            return (
                p.active &&
                l !== undefined &&
                l.onHand - l.reserved < p.reorderAt
            );
        }).length,
    };

    return (
        <Sidebar collapsible="icon" variant="sidebar">
            <SidebarHeader className="border-b border-sidebar-border">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="gap-0 py-2" data-tour="sidebar">
                {menu.map((group) => (
                    <SidebarGroup key={group.key} className="py-1">
                        <SidebarGroupLabel className="h-7 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                            {t(`nav.groups.${group.key}`)}
                        </SidebarGroupLabel>
                        <SidebarMenu>
                            {group.items.map((item) => {
                                const title = t(`nav.${item.key}`);

                                return (
                                    <SidebarMenuItem key={item.key}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isCurrentOrParentUrl(
                                                item.href,
                                            )}
                                            tooltip={{ children: title }}
                                            className="data-[active=true]:font-medium"
                                        >
                                            <Link href={item.href} prefetch>
                                                <item.icon />
                                                <span>{title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                        {badges[item.key] ? (
                                            <SidebarMenuBadge className="rounded-full bg-accent text-accent-foreground tabular-nums">
                                                {f.num(badges[item.key])}
                                            </SidebarMenuBadge>
                                        ) : null}
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroup>
                ))}
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border">
                {/* On phones the top-bar switcher is hidden; offer it here. */}
                <LanguageSwitcher className="w-fit sm:hidden" />
                <PlanUsage />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}

function PlanUsage() {
    const { t } = useFormat();
    const { company } = useAdminData();

    return (
        <div className="flex flex-col gap-2 rounded-md border border-sidebar-border p-3 text-xs group-data-[collapsible=icon]:hidden">
            <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                    {t('plan.name', { plan: t(`plan.${company.plan}`) })}
                </span>
                <span className="truncate text-muted-foreground">
                    {t('plan.code', { code: company.code })}
                </span>
            </div>
            <Usage
                label={t('plan.staff')}
                used={company.staffUsed}
                limit={company.staffLimit}
            />
            <Usage
                label={t('plan.sms')}
                used={company.smsUsed}
                limit={company.smsLimit}
            />
        </div>
    );
}

function Usage({
    label,
    used,
    limit,
}: {
    label: string;
    used: number;
    limit: number;
}) {
    const { f } = useFormat();

    return (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between text-muted-foreground">
                <span>{label}</span>
                <span className="tabular-nums">
                    {f.num(used)} / {f.num(limit)}
                </span>
            </div>
            <div className="h-1 rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-primary"
                    style={{
                        width: `${limit > 0 ? Math.min(100, (used / limit) * 100) : 0}%`,
                    }}
                />
            </div>
        </div>
    );
}
