import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Panel } from '@/components/dashboard/primitives';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';

/** Avatar initials + name + secondary line (staff, SR, DM). */
export function Person({
    name,
    sub,
    size = 'md',
}: {
    name: string;
    sub?: string;
    size?: 'sm' | 'md';
}) {
    const initials = useInitials();

    return (
        <div className="flex min-w-0 items-center gap-2.5">
            <span
                className={cn(
                    'flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground',
                    size === 'md' ? 'size-8 text-xs' : 'size-6 text-[10px]',
                )}
            >
                {initials(name)}
            </span>
            <div className="min-w-0">
                <p className="truncate text-sm font-medium">{name}</p>
                {sub && (
                    <p className="truncate text-xs text-muted-foreground">
                        {sub}
                    </p>
                )}
            </div>
        </div>
    );
}

/** Flat colored square with the first letter — stand-in for product images. */
export function Thumb({ label, hue }: { label: string; hue: number }) {
    return (
        <span
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold"
            style={{
                background: `oklch(0.94 0.04 ${hue})`,
                color: `oklch(0.42 0.09 ${hue})`,
            }}
            aria-hidden
        >
            {label.slice(0, 1)}
        </span>
    );
}

/** Two-line cell: main text + muted secondary text. */
export function Stack({ main, sub }: { main: ReactNode; sub?: ReactNode }) {
    return (
        <div className="min-w-0">
            <div className="truncate text-sm">{main}</div>
            {sub && (
                <div className="truncate text-xs text-muted-foreground">
                    {sub}
                </div>
            )}
        </div>
    );
}

/** Small stat tile for page summary rows. */
export function MiniStat({
    icon: Icon,
    label,
    value,
    note,
    tone = 'neutral',
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    note?: string;
    tone?: 'neutral' | 'warning' | 'danger' | 'success';
}) {
    return (
        <Panel className="flex-row items-center gap-3 p-4">
            <span
                className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-md',
                    tone === 'neutral' && 'bg-accent text-accent-foreground',
                    tone === 'warning' && 'bg-warning-soft text-warning-ink',
                    tone === 'danger' && 'bg-danger-soft text-danger-ink',
                    tone === 'success' && 'bg-success-soft text-success-ink',
                )}
            >
                <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">
                    {label}
                </p>
                <p className="text-lg leading-tight font-semibold tabular-nums">
                    {value}
                </p>
                {note && (
                    <p className="truncate text-xs text-muted-foreground">
                        {note}
                    </p>
                )}
            </div>
        </Panel>
    );
}

/** Label/value list used in detail side panels. */
export function KeyValues({
    items,
}: {
    items: { label: string; value: ReactNode }[];
}) {
    return (
        <dl className="divide-y">
            {items.map((i) => (
                <div
                    key={i.label}
                    className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm"
                >
                    <dt className="text-muted-foreground">{i.label}</dt>
                    <dd className="text-right font-medium">{i.value}</dd>
                </div>
            ))}
        </dl>
    );
}
