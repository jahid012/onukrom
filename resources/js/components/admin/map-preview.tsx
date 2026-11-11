import { cn } from '@/lib/utils';

export type MapPin = {
    x: number; // 0–100 (% of width)
    y: number; // 0–100 (% of height)
    kind: 'order' | 'shop' | 'staff';
    label?: string;
    accuracy?: number; // radius in px, drawn as a circle
};

const pinColor = {
    order: 'var(--chart-1)',
    shop: 'var(--chart-3)',
    staff: 'var(--chart-2)',
};

/**
 * Flat, dependency-free map illustration for the design preview.
 * The real panel will use react-leaflet + OpenStreetMap (spec §11.1).
 */
export function MapPreview({
    pins,
    trail,
    className,
    caption,
}: {
    pins: MapPin[];
    trail?: { x: number; y: number }[];
    className?: string;
    caption?: string;
}) {
    return (
        <figure className={cn('relative overflow-hidden', className)}>
            <svg
                viewBox="0 0 100 60"
                preserveAspectRatio="none"
                className="absolute inset-0 size-full"
                aria-hidden
            >
                <rect width="100" height="60" fill="var(--muted)" />
                {/* blocks */}
                {[
                    [4, 4, 22, 14],
                    [30, 4, 18, 14],
                    [52, 4, 26, 14],
                    [82, 4, 14, 14],
                    [4, 24, 22, 14],
                    [30, 24, 18, 14],
                    [52, 24, 12, 14],
                    [68, 24, 28, 14],
                    [4, 44, 40, 12],
                    [48, 44, 18, 12],
                    [70, 44, 26, 12],
                ].map(([x, y, w, h]) => (
                    <rect
                        key={`${x}-${y}`}
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        rx="1"
                        fill="var(--card)"
                    />
                ))}
                {/* a river-ish band and one main road */}
                <path
                    d="M0 41 C 25 37, 45 45, 100 40"
                    stroke="var(--info-soft)"
                    strokeWidth="3"
                    fill="none"
                />
                <path
                    d="M49 0 L 50 60"
                    stroke="var(--border)"
                    strokeWidth="1.6"
                />
                {trail && trail.length > 1 && (
                    <polyline
                        points={trail
                            .map((p) => `${p.x},${p.y * 0.6}`)
                            .join(' ')}
                        fill="none"
                        stroke="var(--chart-2)"
                        strokeWidth="0.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
            </svg>

            {pins.map((p, i) => (
                <div
                    key={i}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                >
                    {p.accuracy !== undefined && (
                        <span
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                            style={{
                                width: p.accuracy * 2,
                                height: p.accuracy * 2,
                                background:
                                    'color-mix(in oklab, var(--chart-1) 14%, transparent)',
                                borderColor:
                                    'color-mix(in oklab, var(--chart-1) 45%, transparent)',
                            }}
                            aria-hidden
                        />
                    )}
                    <span
                        className="relative block size-3.5 rounded-full ring-2 ring-card"
                        style={{ background: pinColor[p.kind] }}
                    />
                    {p.label && (
                        <span className="absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded-sm bg-card px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ring-1 ring-border">
                            {p.label}
                        </span>
                    )}
                </div>
            ))}

            {caption && (
                <figcaption className="absolute right-2 bottom-2 rounded-sm bg-card/90 px-1.5 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border">
                    {caption}
                </figcaption>
            )}
        </figure>
    );
}

export function MapLegend({
    items,
}: {
    items: { kind: MapPin['kind']; label: string }[];
}) {
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {items.map((i) => (
                <span key={i.kind} className="flex items-center gap-1.5">
                    <span
                        className="size-2.5 rounded-full"
                        style={{ background: pinColor[i.kind] }}
                        aria-hidden
                    />
                    {i.label}
                </span>
            ))}
        </div>
    );
}
