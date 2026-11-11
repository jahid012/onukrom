import { MoreHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';

export type RowAction = {
    label: string;
    icon?: LucideIcon;
    onSelect: () => void;
    danger?: boolean;
    hidden?: boolean;
};

/** "⋯" menu at the end of a table row. */
export function RowMenu({ actions }: { actions: RowAction[] }) {
    const { t } = useFormat();
    const visible = actions.filter((a) => !a.hidden);

    if (visible.length === 0) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={t('admin.actions.more')}
                >
                    <MoreHorizontal className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
                {visible.map((a) => (
                    <DropdownMenuItem
                        key={a.label}
                        onSelect={a.onSelect}
                        className={cn(
                            a.danger && 'text-danger-ink focus:text-danger-ink',
                        )}
                    >
                        {a.icon && (
                            <a.icon
                                className={cn(
                                    'size-4',
                                    a.danger && 'text-danger-ink',
                                )}
                            />
                        )}
                        {a.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
