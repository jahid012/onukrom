import { CountPill } from '@/components/admin/status-badge';
import type { Tone } from '@/components/admin/status-badge';
import { cn } from '@/lib/utils';

export type TabItem<V extends string> = {
    value: V;
    label: string;
    count?: string;
    tone?: Tone;
};

/** Flat underline tabs for switching views inside a page. */
export function Tabs<V extends string>({
    items,
    value,
    onChange,
    className,
}: {
    items: TabItem<V>[];
    value: V;
    onChange: (value: V) => void;
    className?: string;
}) {
    return (
        <div
            role="tablist"
            data-tour="page-tabs"
            className={cn('flex gap-1 overflow-x-auto border-b', className)}
        >
            {items.map((item) => {
                const active = item.value === value;

                return (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(item.value)}
                        className={cn(
                            '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors',
                            active
                                ? 'border-primary font-medium text-foreground'
                                : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {item.label}
                        {item.count !== undefined && (
                            <CountPill
                                value={item.count}
                                tone={
                                    active
                                        ? (item.tone ?? 'primary')
                                        : 'neutral'
                                }
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
