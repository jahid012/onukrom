import { ChevronDown, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const control =
    'h-9 rounded-md border bg-card text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20';

export function SearchInput({
    value,
    onChange,
    placeholder,
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    className?: string;
}) {
    return (
        <div className={cn('relative min-w-0', className)}>
            <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
            />
            <input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className={cn(
                    control,
                    'w-full pr-3 pl-8 placeholder:text-muted-foreground',
                )}
            />
        </div>
    );
}

export type Option = { value: string; label: string };

/** Flat native select — simple, accessible and works on every phone. */
export function SelectField({
    value,
    onChange,
    options,
    label,
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    label: string;
    className?: string;
}) {
    return (
        <div className={cn('relative', className)}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label={label}
                className={cn(control, 'w-full appearance-none pr-8 pl-3')}
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            <ChevronDown
                className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
            />
        </div>
    );
}

/** Row of filters above a table. */
export function FilterBar({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
            {children}
        </div>
    );
}

/** Flat on/off switch. */
export function Switch({
    checked,
    onChange,
    label,
    disabled = false,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn(
                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                checked ? 'bg-primary' : 'bg-input',
            )}
        >
            <span
                className={cn(
                    'size-4 rounded-full bg-white transition-transform',
                    checked ? 'translate-x-4.5' : 'translate-x-0.5',
                )}
            />
        </button>
    );
}

/** A settings row: label + help text on the left, control on the right. */
export function SettingRow({
    label,
    help,
    children,
}: {
    label: string;
    help?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                {help && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {help}
                    </p>
                )}
            </div>
            <div className="shrink-0 sm:w-56 sm:text-right">{children}</div>
        </div>
    );
}

export function TextField({
    value,
    onChange,
    label,
    type = 'text',
    suffix,
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    type?: 'text' | 'number' | 'tel';
    suffix?: string;
    className?: string;
}) {
    return (
        <div className={cn('relative', className)}>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label={label}
                className={cn(control, 'w-full px-3', suffix && 'pr-14')}
            />
            {suffix && (
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                    {suffix}
                </span>
            )}
        </div>
    );
}
