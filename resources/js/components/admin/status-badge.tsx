import { cn } from '@/lib/utils';

export type Tone =
    | 'neutral'
    | 'primary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info';

const tones: Record<Tone, { box: string; dot: string }> = {
    neutral: {
        box: 'bg-muted text-muted-foreground',
        dot: 'bg-muted-foreground',
    },
    primary: { box: 'bg-accent text-accent-foreground', dot: 'bg-primary' },
    success: { box: 'bg-success-soft text-success-ink', dot: 'bg-success' },
    warning: { box: 'bg-warning-soft text-warning-ink', dot: 'bg-warning' },
    danger: { box: 'bg-danger-soft text-danger-ink', dot: 'bg-danger' },
    info: { box: 'bg-info-soft text-info-ink', dot: 'bg-info' },
};

/** Flat status pill: tinted fill + dot + text (never color alone). */
export function StatusBadge({
    tone,
    label,
    className,
}: {
    tone: Tone;
    label: string;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                tones[tone].box,
                className,
            )}
        >
            <span
                className={cn('size-1.5 rounded-full', tones[tone].dot)}
                aria-hidden
            />
            {label}
        </span>
    );
}

/** Small count pill used in tabs and sidebars. */
export function CountPill({
    value,
    tone = 'neutral',
}: {
    value: string;
    tone?: Tone;
}) {
    return (
        <span
            className={cn(
                'min-w-6 rounded-full px-1.5 py-px text-center text-[11px] font-semibold tabular-nums',
                tones[tone].box,
            )}
        >
            {value}
        </span>
    );
}
