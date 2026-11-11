import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';

export type Column<T> = {
    key: string;
    header: ReactNode;
    cell: (row: T) => ReactNode;
    align?: 'left' | 'right' | 'center';
    className?: string;
};

const alignClass = {
    left: 'text-left',
    right: 'text-right',
    center: 'text-center',
};

/**
 * Static data table (design preview). Server-side paging, sorting and
 * filtering will plug in later via spatie/laravel-query-builder (spec §11).
 */
export function DataTable<T>({
    columns,
    rows,
    rowKey,
    selected,
    onSelectedChange,
    minWidth = 760,
    rowClassName,
}: {
    columns: Column<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    selected?: Set<string>;
    onSelectedChange?: (next: Set<string>) => void;
    minWidth?: number;
    rowClassName?: (row: T) => string | undefined;
}) {
    const { t } = useFormat();
    const selectable = Boolean(selected && onSelectedChange);
    const allSelected =
        selectable &&
        rows.length > 0 &&
        rows.every((r) => selected!.has(rowKey(r)));

    const toggleAll = () => {
        if (!onSelectedChange) {
            return;
        }

        onSelectedChange(allSelected ? new Set() : new Set(rows.map(rowKey)));
    };

    const toggle = (key: string) => {
        if (!selected || !onSelectedChange) {
            return;
        }

        const next = new Set(selected);

        if (next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }

        onSelectedChange(next);
    };

    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                <SearchX className="size-8 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">{t('admin.table.empty')}</p>
                <p className="text-xs text-muted-foreground">
                    {t('admin.table.emptyHelp')}
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth }}>
                <thead className="border-b bg-background">
                    <tr>
                        {selectable && (
                            <th className="w-10 px-4 py-2">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={toggleAll}
                                    aria-label={t('admin.table.selectAll')}
                                />
                            </th>
                        )}
                        {columns.map((c) => (
                            <th
                                key={c.key}
                                className={cn(
                                    'px-4 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground',
                                    alignClass[c.align ?? 'left'],
                                    c.className,
                                )}
                            >
                                {c.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {rows.map((row) => {
                        const key = rowKey(row);
                        const isSelected = selected?.has(key) ?? false;

                        return (
                            <tr
                                key={key}
                                className={cn(
                                    'hover:bg-muted/60',
                                    isSelected &&
                                        'bg-accent/60 hover:bg-accent/60',
                                    rowClassName?.(row),
                                )}
                            >
                                {selectable && (
                                    <td className="px-4 py-2.5">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggle(key)}
                                            aria-label={t(
                                                'admin.table.selectRow',
                                            )}
                                        />
                                    </td>
                                )}
                                {columns.map((c) => (
                                    <td
                                        key={c.key}
                                        className={cn(
                                            'px-4 py-2.5 align-middle',
                                            alignClass[c.align ?? 'left'],
                                            c.className,
                                        )}
                                    >
                                        {c.cell(row)}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/** Client-side paging over the rows shown in a table. */
export function usePaged<T>(rows: T[], size = 10) {
    const [page, setPage] = useState(1);
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const current = Math.min(page, pages);
    const start = (current - 1) * size;

    return {
        rows: rows.slice(start, start + size),
        page: current,
        pages,
        from: rows.length === 0 ? 0 : start + 1,
        to: Math.min(start + size, rows.length),
        total: rows.length,
        setPage,
    };
}

export type Paged<T> = ReturnType<typeof usePaged<T>>;

/** "Showing 1–10 of 24" + previous / next. */
export function TableFooter<T>({ paged }: { paged: Paged<T> }) {
    const { t, f } = useFormat();

    if (paged.total === 0) {
        return null;
    }

    return (
        <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs text-muted-foreground">
            <span className="tabular-nums">
                {t('admin.table.showing', {
                    from: f.num(paged.from),
                    to: f.num(paged.to),
                    total: f.num(paged.total),
                })}
            </span>
            {paged.pages > 1 && (
                <div className="flex gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={paged.page === 1}
                        onClick={() => paged.setPage(paged.page - 1)}
                    >
                        <ChevronLeft className="size-3.5" />
                        {t('admin.table.previous')}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={paged.page === paged.pages}
                        onClick={() => paged.setPage(paged.page + 1)}
                    >
                        {t('admin.table.next')}
                        <ChevronRight className="size-3.5" />
                    </Button>
                </div>
            )}
        </div>
    );
}

/** Sticky bar shown when rows are selected. */
export function BulkBar({
    count,
    children,
    onClear,
}: {
    count: number;
    children: ReactNode;
    onClear: () => void;
}) {
    const { t, f } = useFormat();

    if (count === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-2 border-b bg-accent px-4 py-2">
            <span className="text-sm font-medium text-accent-foreground">
                {t('admin.table.selected', { n: f.num(count) })}
            </span>
            <div className="flex flex-wrap gap-2">{children}</div>
            <button
                type="button"
                onClick={onClear}
                className="ml-auto text-xs text-accent-foreground underline underline-offset-4"
            >
                {t('admin.actions.clearSelection')}
            </button>
        </div>
    );
}
