import { usePage } from '@inertiajs/react';
import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import PlatformLayout from '@/layouts/platform-layout';
import type { BreadcrumbItem } from '@/types';

export default function AppLayout({
    breadcrumbs = [],
    children,
}: {
    breadcrumbs?: BreadcrumbItem[];
    children: React.ReactNode;
}) {
    const { auth } = usePage().props;

    // Platform staff opening their own account settings: no company panel.
    if (auth.user?.platform_role && !auth.impersonator) {
        return (
            <PlatformLayout breadcrumbs={breadcrumbs}>
                {children}
            </PlatformLayout>
        );
    }

    return (
        <AppLayoutTemplate breadcrumbs={breadcrumbs}>
            {children}
        </AppLayoutTemplate>
    );
}
