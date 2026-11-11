import { usePage } from '@inertiajs/react';

/** Read a query-string value from the current Inertia URL (e.g. ?tab=pending). */
export function useQuery(name: string): string | null {
    const { url } = usePage();

    return new URL(url, 'http://localhost').searchParams.get(name);
}
