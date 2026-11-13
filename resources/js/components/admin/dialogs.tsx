import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';

/**
 * Standard modal with a form: title, description, body, Cancel + submit.
 * `onSubmit` returns false to keep the dialog open (e.g. validation failed).
 */
export function FormDialog({
    open,
    onOpenChange,
    title,
    description,
    children,
    submitLabel,
    onSubmit,
    destructive = false,
    disabled = false,
    wide = false,
    hideCancel = false,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children?: ReactNode;
    submitLabel: string;
    onSubmit: () => boolean | void;
    destructive?: boolean;
    disabled?: boolean;
    wide?: boolean;
    hideCancel?: boolean;
}) {
    const { t } = useFormat();

    const submit = (e: FormEvent) => {
        e.preventDefault();

        if (onSubmit() !== false) {
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cn(
                    'max-h-[90svh] overflow-y-auto',
                    wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
                )}
            >
                <form onSubmit={submit} className="grid gap-4">
                    <div className="grid gap-1.5">
                        <DialogTitle>{title}</DialogTitle>
                        {description && (
                            <DialogDescription>{description}</DialogDescription>
                        )}
                    </div>
                    {children}
                    <DialogFooter className="gap-2">
                        {!hideCancel && (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => onOpenChange(false)}
                            >
                                {t('admin.actions.cancel')}
                            </Button>
                        )}
                        <Button
                            type="submit"
                            variant={destructive ? 'destructive' : 'default'}
                            disabled={disabled}
                        >
                            {submitLabel}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Confirmation for a single action. With `reasonLabel` it asks for a
 * reason (required) — used for rejecting orders, payments and returns.
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    onConfirm,
    destructive = false,
    reasonLabel,
    reasonOptions,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    confirmLabel: string;
    onConfirm: (reason: string) => void;
    destructive?: boolean;
    reasonLabel?: string;
    reasonOptions?: string[];
}) {
    const [reason, setReason] = useState('');

    return (
        <FormDialog
            open={open}
            onOpenChange={(next) => {
                onOpenChange(next);

                if (!next) {
                    setReason('');
                }
            }}
            title={title}
            description={description}
            submitLabel={confirmLabel}
            destructive={destructive}
            disabled={Boolean(reasonLabel) && reason.trim() === ''}
            onSubmit={() => {
                onConfirm(reason.trim());
                setReason('');
            }}
        >
            {reasonLabel && (
                <Field label={reasonLabel}>
                    {reasonOptions && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                            {reasonOptions.map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setReason(r)}
                                    className={cn(
                                        'rounded-full border px-2.5 py-1 text-xs',
                                        reason === r
                                            ? 'border-primary bg-accent text-accent-foreground'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    )}
                    <TextArea
                        value={reason}
                        onChange={setReason}
                        label={reasonLabel}
                    />
                </Field>
            )}
        </FormDialog>
    );
}

/** Label + control + optional help/error, for forms in dialogs. */
export function Field({
    label,
    help,
    error,
    children,
    className,
}: {
    label: string;
    help?: string;
    error?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <label className={cn('grid gap-1.5 text-sm', className)}>
            <span className="font-medium">{label}</span>
            {children}
            {help && !error && (
                <span className="text-xs text-muted-foreground">{help}</span>
            )}
            {error && <span className="text-xs text-danger-ink">{error}</span>}
        </label>
    );
}

const control =
    'h-9 w-full rounded-md border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20';

export function TextInput({
    value,
    onChange,
    type = 'text',
    placeholder,
    required = false,
    inputMode,
    autoFocus,
    min,
    step,
}: {
    value: string;
    onChange: (value: string) => void;
    type?: 'text' | 'number' | 'tel' | 'email' | 'date';
    placeholder?: string;
    required?: boolean;
    inputMode?: 'numeric' | 'decimal' | 'tel';
    autoFocus?: boolean;
    min?: number;
    step?: number | 'any';
}) {
    return (
        <input
            className={control}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            inputMode={inputMode}
            autoFocus={autoFocus}
            min={min}
            step={step}
        />
    );
}

export function TextArea({
    value,
    onChange,
    label,
}: {
    value: string;
    onChange: (value: string) => void;
    label: string;
}) {
    return (
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            rows={3}
            className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
        />
    );
}
