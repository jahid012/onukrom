import { useForm } from '@inertiajs/react';
import { CheckCircle2, Loader2, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFormat } from '@/hooks/use-format';
import { newEventId, rememberUtm, track } from '@/lib/meta-pixel';
import { cn } from '@/lib/utils';
import { store } from '@/routes/lead';
import { buttonClass } from './site';

const input =
    'h-12 w-full rounded-xl border bg-background px-4 text-base outline-none transition-colors focus:border-[#4264FB] focus:ring-4 focus:ring-[#4264FB]/15';

/**
 * Demo request: few fields, big inputs, phone first-class. On success the
 * browser fires "Lead" with the same event id the server sends to Meta.
 */
export function LeadForm({
    teamSizes,
    sent,
}: {
    teamSizes: string[];
    sent: boolean;
}) {
    const { t } = useFormat();
    const [done, setDone] = useState(sent);
    const form = useForm({
        name: '',
        phone: '',
        company: '',
        team_size: '',
        website: '', // honeypot
        utm: {} as Record<string, string>,
        event_id: '',
    });

    useEffect(() => {
        form.setData('utm', rememberUtm());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (done) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center shadow-xl">
                <CheckCircle2 className="size-12 text-[#16A34A]" />
                <p className="text-xl font-bold">
                    {t('home.form.thanksTitle')}
                </p>
                <p className="text-muted-foreground">
                    {t('home.form.thanksText', {
                        phone: form.data.phone || '',
                    })}
                </p>
            </div>
        );
    }

    return (
        <form
            className="flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-xl sm:p-8"
            onSubmit={(e) => {
                e.preventDefault();
                const eventId = newEventId('Lead');
                form.transform((d) => ({ ...d, event_id: eventId }));
                form.post(store.url(), {
                    preserveScroll: true,
                    onSuccess: () => {
                        track(
                            'Lead',
                            {
                                content_name: 'Demo request',
                                team_size: form.data.team_size,
                            },
                            eventId,
                        );
                        setDone(true);
                    },
                });
            }}
        >
            <p className="text-lg font-bold">{t('home.form.title')}</p>
            <label className="grid gap-1.5 text-sm font-medium">
                {t('home.form.name')}
                <input
                    className={input}
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    autoComplete="name"
                    required
                />
                {form.errors.name && (
                    <span className="text-xs text-red-600">
                        {form.errors.name}
                    </span>
                )}
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
                {t('home.form.phone')}
                <input
                    className={input}
                    value={form.data.phone}
                    onChange={(e) => form.setData('phone', e.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="01XXXXXXXXX"
                    required
                />
                {form.errors.phone && (
                    <span className="text-xs text-red-600">
                        {form.errors.phone}
                    </span>
                )}
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
                {t('home.form.company')}
                <input
                    className={input}
                    value={form.data.company}
                    onChange={(e) => form.setData('company', e.target.value)}
                    autoComplete="organization"
                />
            </label>
            <div className="grid gap-1.5 text-sm font-medium">
                {t('home.form.teamSize')}
                <div className="grid grid-cols-4 gap-2">
                    {teamSizes.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => form.setData('team_size', s)}
                            className={cn(
                                'h-11 rounded-xl border text-sm font-semibold transition-colors',
                                form.data.team_size === s
                                    ? 'border-[#4264FB] bg-[#4264FB]/10 text-[#4264FB]'
                                    : 'hover:bg-muted',
                            )}
                            aria-pressed={form.data.team_size === s}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>
            {/* Honeypot: hidden from people, filled by bots. */}
            <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.data.website}
                onChange={(e) => form.setData('website', e.target.value)}
                className="hidden"
                aria-hidden
            />
            <button
                type="submit"
                disabled={form.processing}
                className={cn(buttonClass('solid', 'lg'), 'mt-2 w-full')}
            >
                {form.processing && <Loader2 className="size-4 animate-spin" />}
                {t('home.form.submit')}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3" />
                {t('home.form.privacy')}
            </p>
        </form>
    );
}
