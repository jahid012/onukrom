import { router } from '@inertiajs/react';
import { CheckCircle2, ChevronRight, Circle, Rocket, X } from 'lucide-react';
import { useState } from 'react';
import { Panel, PanelHeader } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { allRoutesOf, useAdminData } from '@/data/admin/store';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';

type Step = { key: string; href: string; done: boolean };

const DISMISS_KEY = 'onukrom.gettingStarted.hidden';

function hidden(): boolean {
    try {
        return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
        return false;
    }
}

/**
 * Setup checklist on the dashboard, ticked from the company's real data.
 * "Show me" opens the page with its guide (?tour=1).
 */
export function GettingStarted() {
    const { t, f } = useFormat();
    const state = useAdminData();
    const [closed, setClosed] = useState(hidden);
    const routes = allRoutesOf(state);
    const field = state.staff.filter((s) =>
        s.roles.some((r) => r === 'sr' || r === 'dm'),
    );

    const steps: Step[] = [
        {
            key: 'company',
            href: '/company/settings',
            done: Boolean(state.settings.phone && state.settings.address),
        },
        { key: 'areas', href: '/areas', done: routes.length > 0 },
        { key: 'products', href: '/products', done: state.products.length > 0 },
        {
            key: 'stock',
            href: '/stock',
            done: Object.values(state.stock).some((w) =>
                Object.values(w).some((l) => l.onHand > 0),
            ),
        },
        {
            key: 'staff',
            href: '/staff',
            done:
                field.some((s) => s.roles.includes('sr')) &&
                field.some((s) => s.roles.includes('dm')),
        },
        { key: 'order', href: '/orders', done: state.orders.length > 0 },
    ];
    const doneCount = steps.filter((s) => s.done).length;
    const allDone = doneCount === steps.length;

    if (closed || (allDone && hidden())) {
        return null;
    }

    return (
        <Panel className="lg:col-span-3">
            <div data-tour="getting-started">
                <PanelHeader
                    title={t('setup.title')}
                    subtitle={t('setup.subtitle', {
                        done: f.num(doneCount),
                        total: f.num(steps.length),
                    })}
                    action={
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            aria-label={t('setup.hide')}
                            onClick={() => {
                                try {
                                    localStorage.setItem(DISMISS_KEY, '1');
                                } catch {
                                    // ignore
                                }

                                setClosed(true);
                            }}
                        >
                            <X className="size-4" />
                        </Button>
                    }
                />
                <div className="px-4 pt-3">
                    <div className="h-1.5 rounded-full bg-muted">
                        <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{
                                width: `${(doneCount / steps.length) * 100}%`,
                            }}
                        />
                    </div>
                </div>
                {allDone ? (
                    <p className="flex items-center gap-2 px-4 py-4 text-sm font-medium text-success-ink">
                        <Rocket className="size-4" />
                        {t('setup.allDone')}
                    </p>
                ) : (
                    <ol className="grid grid-cols-1 gap-px p-2 sm:grid-cols-2 xl:grid-cols-3">
                        {steps.map((s, i) => (
                            <li key={s.key}>
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.visit(`${s.href}?tour=1`)
                                    }
                                    className={cn(
                                        'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-muted',
                                        s.done && 'opacity-70',
                                    )}
                                >
                                    {s.done ? (
                                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                                    ) : (
                                        <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                                    )}
                                    <span className="min-w-0 flex-1">
                                        <span
                                            className={cn(
                                                'block text-sm font-medium',
                                                s.done && 'line-through',
                                            )}
                                        >
                                            {f.num(i + 1)}.{' '}
                                            {t(`setup.steps.${s.key}.title`)}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            {t(`setup.steps.${s.key}.text`)}
                                        </span>
                                    </span>
                                    {!s.done && (
                                        <span className="mt-0.5 flex shrink-0 items-center text-xs font-medium text-primary">
                                            {t('setup.showMe')}
                                            <ChevronRight className="size-3.5" />
                                        </span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </Panel>
    );
}
