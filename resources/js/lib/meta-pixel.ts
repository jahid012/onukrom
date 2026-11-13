/**
 * Meta Pixel (browser half). The server sends the same events through the
 * Conversions API with the same event id, so Meta counts each one once.
 * Nothing loads until the platform has set a Pixel ID.
 */
type Fbq = ((...args: unknown[]) => void) & {
    callMethod?: (...args: unknown[]) => void;
    queue: unknown[];
    push: Fbq;
    loaded: boolean;
    version: string;
    disablePushState?: boolean;
};

declare global {
    interface Window {
        fbq?: Fbq;
        _fbq?: Fbq;
    }
}

let initialised: string | null = null;

export function initPixel(pixelId: string | null | undefined): boolean {
    if (!pixelId || typeof window === 'undefined') {
        return false;
    }

    if (initialised === pixelId) {
        return true;
    }

    if (!window.fbq) {
        // Meta's standard loader: queue calls until fbevents.js arrives.
        const fbq = function (...args: unknown[]) {
            if (fbq.callMethod) {
                fbq.callMethod(...args);
            } else {
                fbq.queue.push(args);
            }
        } as Fbq;
        fbq.queue = [];
        fbq.push = fbq;
        fbq.loaded = true;
        fbq.version = '2.0';
        window.fbq = fbq;
        window._fbq ??= fbq;

        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://connect.facebook.net/en_US/fbevents.js';
        document.head.appendChild(script);
    }

    // The Pixel otherwise fires its own PageView (no event id) on every
    // history change; Inertia visits and #anchor links would be counted twice
    // and never match the server's PageView. We track PageView ourselves.
    window.fbq.disablePushState = true;
    window.fbq('init', pixelId);
    initialised = pixelId;

    return true;
}

/** A standard event (PageView, Lead, Contact, …), deduplicated by eventId. */
export function track(
    event: string,
    data: Record<string, unknown> = {},
    eventId?: string,
): void {
    if (!initialised || !window.fbq) {
        return;
    }

    window.fbq('track', event, data, eventId ? { eventID: eventId } : {});
}

export function newEventId(event: string): string {
    const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return `${event.toLowerCase()}.${id}`;
}

/* UTM tags from the ad link, kept for the visit (per-tab convenience). */
const UTM_KEYS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
];

export function rememberUtm(): Record<string, string> {
    const fromUrl: Record<string, string> = {};
    const params = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach((k) => {
        const v = params.get(k);

        if (v) {
            fromUrl[k] = v.slice(0, 150);
        }
    });

    try {
        if (Object.keys(fromUrl).length > 0) {
            sessionStorage.setItem('onukrom.utm', JSON.stringify(fromUrl));

            return fromUrl;
        }

        return JSON.parse(
            sessionStorage.getItem('onukrom.utm') ?? '{}',
        ) as Record<string, string>;
    } catch {
        return fromUrl;
    }
}
