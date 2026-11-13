import {
    ArrowDownRight,
    ArrowUpRight,
    CircleAlert,
    CircleCheck,
    Clock,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';

/** Flat card: solid surface + 1px border, no shadow. */
export function Panel({
    className,
    children,
    tour,
}: {
    className?: string;
    children: ReactNode;
    /** Marks the panel for a page guide step (data-tour). */
    tour?: string;
}) {
    return (
        <section
            data-tour={tour}
            className={cn(
                'flex min-w-0 flex-col rounded-md border bg-card text-card-foreground',
                className,
            )}
        >
            {children}
        </section>
    );
}

export function PanelHeader({
    title,
    subtitle,
    action,
}: {
    title: string;
    subtitle?: string;
    action?: ReactNode;
}) {
    return (
        <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b px-4 py-3">
            <div className="min-w-0">
                <h2 className="text-sm font-semibold">{title}</h2>
                {subtitle && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {subtitle}
                    </p>
                )}
            </div>
            {action}
        </header>
    );
}

/** Change vs previous period — arrow + sign + text, never color alone. */
export function Delta({
    value,
    goodWhenUp = true,
}: {
    value: number;
    goodWhenUp?: boolean;
}) {
    const { f } = useFormat();
    const up = value >= 0;
    const good = up === goodWhenUp;
    const Icon = up ? ArrowUpRight : ArrowDownRight;

    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
                good
                    ? 'bg-success-soft text-success-ink'
                    : 'bg-danger-soft text-danger-ink',
            )}
        >
            <Icon className="size-3.5" aria-hidden />
            {f.signedPercent(value)}
        </span>
    );
}

/** Thin flat progress meter. */
export function Meter({
    value,
    max,
    tone = 'primary',
    className,
    label,
}: {
    value: number;
    max: number;
    tone?: 'primary' | 'warning' | 'danger';
    className?: string;
    label?: string;
}) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;

    return (
        <div
            role="meter"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-label={label}
            className={cn('h-1.5 w-full rounded-full bg-muted', className)}
        >
            <div
                className={cn(
                    'h-full rounded-full',
                    tone === 'primary' && 'bg-primary',
                    tone === 'warning' && 'bg-warning',
                    tone === 'danger' && 'bg-danger',
                )}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

/** Last-sync indicator for field staff: icon + text + color. */
export function SyncStatus({ minutes }: { minutes: number }) {
    const { t, f } = useFormat();

    if (minutes >= 24 * 60) {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-danger-ink">
                <CircleAlert className="size-3.5" aria-hidden />
                {t('time.hoursAgo', { n: f.num(Math.floor(minutes / 60)) })}
            </span>
        );
    }

    if (minutes >= 30) {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-warning-ink">
                <Clock className="size-3.5" aria-hidden />
                {t('time.minAgo', { n: f.num(minutes) })}
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
            <CircleCheck className="size-3.5 text-success" aria-hidden />
            {t('time.minAgo', { n: f.num(minutes) })}
        </span>
    );
}
