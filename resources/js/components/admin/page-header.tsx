import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Page title row: title + description on the left, actions on the right. */
export function PageHeader({
    title,
    description,
    actions,
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
                <h1
                    className="text-xl font-semibold tracking-tight"
                    data-tour="page-title"
                >
                    {title}
                </h1>
                {description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {actions && (
                <div
                    className="flex flex-wrap items-center gap-2"
                    data-tour="page-actions"
                >
                    {actions}
                </div>
            )}
        </div>
    );
}

/** Standard page body spacing used by every admin page. */
export function PageBody({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-1 flex-col gap-4 p-4 md:p-6', className)}>
            {children}
        </div>
    );
}
