import { usePage } from '@inertiajs/react';
import { X } from 'lucide-react';
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useState,
    useSyncExternalStore,
} from 'react';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/hooks/use-format';
import { tourForPath, tours } from './tours';
import type { TourId, TourStep } from './tours';

/* ------------------------------------------------------------------ */
/* Which guide is open (shared by the header button, checklist, host)  */
/* ------------------------------------------------------------------ */

let active: TourId | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function startTour(id: TourId) {
    active = id;
    emit();
}

function endTour() {
    if (active) {
        markSeen(active);
    }

    active = null;
    emit();
}

function useActiveTour() {
    return useSyncExternalStore(
        (l) => {
            listeners.add(l);

            return () => listeners.delete(l);
        },
        () => active,
    );
}

/* Seen guides are remembered per browser (a convenience, not data). */
const seenKey = (id: TourId) => `onukrom.tour.${id}`;

function seen(id: TourId): boolean {
    try {
        return localStorage.getItem(seenKey(id)) === '1';
    } catch {
        return true; // storage blocked: never auto-open
    }
}

function markSeen(id: TourId) {
    try {
        localStorage.setItem(seenKey(id), '1');
    } catch {
        // ignore
    }
}

/** The guide for the page being shown (null on pages without one). */
export function useCurrentTour(): TourId | null {
    const { url } = usePage();

    return tourForPath(new URL(url, 'http://x').pathname);
}

/* ------------------------------------------------------------------ */
/* Host: spotlight + card                                              */
/* ------------------------------------------------------------------ */

const PAD = 6;

type Rect = { top: number; left: number; width: number; height: number };

function findTarget(step: TourStep): HTMLElement | null {
    if (!step.target) {
        return null;
    }

    const all = document.querySelectorAll<HTMLElement>(
        `[data-tour="${step.target}"]`,
    );

    // The first one that is actually on screen (sidebars hide on phones).
    return (
        [...all].find((el) => {
            const r = el.getBoundingClientRect();

            return r.width > 0 && r.height > 0;
        }) ?? null
    );
}

/**
 * Opens the page's guide on the first visit (or with ?tour=1 from the
 * getting-started list) and draws whichever guide is active.
 */
export function TourHost() {
    const { t, f } = useFormat();
    const current = useCurrentTour();
    const tourId = useActiveTour();
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);

    // Auto-open: ?tour=1, or the first time this person sees the page.
    useEffect(() => {
        if (!current) {
            return;
        }

        const forced = new URLSearchParams(window.location.search).has('tour');

        if (forced || !seen(current)) {
            const timer = window.setTimeout(() => startTour(current), 600);

            return () => window.clearTimeout(timer);
        }
    }, [current]);

    // Skip steps whose element is not on this page.
    const steps = tourId
        ? tours[tourId].filter((s) => s.target === null || findTarget(s))
        : [];
    const step = steps[Math.min(index, steps.length - 1)];

    useEffect(() => setIndex(0), [tourId]);

    const measure = useCallback(() => {
        const el = step ? findTarget(step) : null;

        if (!el) {
            setRect(null);

            return;
        }

        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }, [step]);

    useLayoutEffect(() => {
        const el = step ? findTarget(step) : null;
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        measure();
        const again = window.setTimeout(measure, 350); // after the scroll
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);

        return () => {
            window.clearTimeout(again);
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
        };
    }, [measure, step]);

    useEffect(() => {
        if (!tourId) {
            return;
        }

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                endTour();
            }
        };
        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [tourId]);

    if (!tourId || !step) {
        return null;
    }

    const last = index >= steps.length - 1;
    const cardWidth = Math.min(340, window.innerWidth - 32);
    // Card below the element when there is room, else above; centered when no element.
    const below = rect
        ? rect.top + rect.height + 200 < window.innerHeight
        : false;
    const cardStyle = rect
        ? {
              width: cardWidth,
              left: Math.max(
                  16,
                  Math.min(rect.left, window.innerWidth - cardWidth - 16),
              ),
              ...(below
                  ? { top: rect.top + rect.height + PAD + 10 }
                  : { bottom: window.innerHeight - rect.top + PAD + 10 }),
          }
        : {
              width: cardWidth,
              left: (window.innerWidth - cardWidth) / 2,
              top: Math.max(16, window.innerHeight / 2 - 120),
          };

    return (
        <div
            className="no-print fixed inset-0 z-[70]"
            role="dialog"
            aria-modal
            aria-label={t(`tour.${step.title}`)}
        >
            {/* Click-catcher + dim. With an element: a lit hole around it. */}
            <div className="absolute inset-0" onClick={endTour} />
            {rect ? (
                <div
                    className="pointer-events-none absolute rounded-md ring-2 ring-primary transition-all duration-200"
                    style={{
                        top: rect.top - PAD,
                        left: rect.left - PAD,
                        width: rect.width + PAD * 2,
                        height: rect.height + PAD * 2,
                        boxShadow: '0 0 0 9999px rgb(15 20 23 / 0.55)',
                    }}
                />
            ) : (
                <div className="pointer-events-none absolute inset-0 bg-[rgb(15_20_23/0.55)]" />
            )}

            <div
                className="absolute flex flex-col gap-3 rounded-md border bg-popover p-4 text-popover-foreground shadow-lg"
                style={cardStyle}
            >
                <div className="flex items-start gap-2">
                    <p className="flex-1 text-sm font-semibold">
                        {t(`tour.${step.title}`)}
                    </p>
                    <button
                        type="button"
                        onClick={endTour}
                        className="-mt-1 -mr-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={t('tour.common.skip')}
                    >
                        <X className="size-4" />
                    </button>
                </div>
                <p className="text-sm text-muted-foreground">
                    {t(`tour.${step.body}`)}
                </p>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {t('tour.common.step', {
                            n: f.num(index + 1),
                            total: f.num(steps.length),
                        })}
                    </span>
                    <div className="ml-auto flex gap-1.5">
                        {index > 0 && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setIndex(index - 1)}
                            >
                                {t('tour.common.back')}
                            </Button>
                        )}
                        <Button
                            size="sm"
                            autoFocus
                            onClick={() =>
                                last ? endTour() : setIndex(index + 1)
                            }
                        >
                            {last
                                ? t('tour.common.done')
                                : t('tour.common.next')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
