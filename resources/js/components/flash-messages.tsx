import { usePage } from '@inertiajs/react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { useFormat } from '@/hooks/use-format';

/**
 * Messages the server sends after a form post: success / error become
 * toasts; `secret` (a generated login) opens a dialog so it can be copied —
 * it is shown only this once.
 */
export function FlashMessages() {
    const { t } = useFormat();
    const { flash } = usePage().props;
    const [secret, setSecret] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }

        if (flash?.error) {
            toast.error(flash.error);
        }

        if (flash?.secret) {
            setSecret(flash.secret);
            setCopied(false);
        }
    }, [flash]);

    return (
        <Dialog
            open={secret !== null}
            onOpenChange={(o) => !o && setSecret(null)}
        >
            <DialogContent className="sm:max-w-md">
                <DialogTitle className="flex items-center gap-2">
                    <KeyRound className="size-4" />
                    {t('flash.secretTitle')}
                </DialogTitle>
                <DialogDescription>{t('flash.secretText')}</DialogDescription>
                <code className="rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all select-all">
                    {secret}
                </code>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            void navigator.clipboard?.writeText(secret ?? '');
                            setCopied(true);
                        }}
                    >
                        {copied ? (
                            <Check className="size-4" />
                        ) : (
                            <Copy className="size-4" />
                        )}
                        {copied ? t('flash.copied') : t('flash.copy')}
                    </Button>
                    <Button onClick={() => setSecret(null)}>
                        {t('flash.done')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
