import { useSyncExternalStore } from 'react';

/**
 * Tiny in-memory store (no dependency). The state survives Inertia page
 * visits because the module stays loaded; a full reload resets it.
 * Holds the admin data loaded from the server (see data/admin/store.ts).
 */
export function createStore<T>(initial: T) {
    let state = initial;
    const listeners = new Set<() => void>();

    return {
        get: () => state,
        set: (update: (current: T) => T) => {
            state = update(state);
            listeners.forEach((listener) => listener());
        },
        subscribe: (listener: () => void) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
    };
}

export type Store<T> = ReturnType<typeof createStore<T>>;

/** Subscribe a component to the whole state object (stable between updates). */
export function useStoreState<T>(store: Store<T>): T {
    return useSyncExternalStore(store.subscribe, store.get, store.get);
}
