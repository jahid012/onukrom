import { cn } from '@/lib/utils';

export type MapPoint = { lat: number; lng: number; color: string };

const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export const hasMapbox = Boolean(token);

/**
 * A real map picture from the Mapbox Static Images API — no map library
 * needed. `color` is a hex colour without '#'. Zoom fits all points.
 */
export function MapboxStatic({
    points,
    className,
    caption,
}: {
    points: MapPoint[];
    className?: string;
    caption?: string;
}) {
    if (!token || points.length === 0) {
        return null;
    }

    const overlay = points
        .map((p) => `pin-l+${p.color}(${p.lng.toFixed(6)},${p.lat.toFixed(6)})`)
        .join(',');
    const view =
        points.length === 1 ? `${points[0].lng},${points[0].lat},15` : 'auto';
    const src = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlay}/${view}/640x384@2x?padding=60&access_token=${token}`;

    return (
        <figure className={cn('relative overflow-hidden bg-muted', className)}>
            <img
                src={src}
                alt={caption ?? ''}
                className="absolute inset-0 size-full object-cover"
                loading="lazy"
            />
            {caption && (
                <figcaption className="absolute bottom-2 left-2 rounded bg-background/90 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {caption}
                </figcaption>
            )}
        </figure>
    );
}
