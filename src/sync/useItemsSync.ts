import { useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useSignal } from 'senaev-utils/src/utils/Signal/useSignal';

import { ItemsSyncStore } from './ItemsSyncStore';
import type { EditableFields, Item, NetworkSyncStatus } from './types';

export interface UseItemsSyncResult {
    /** All non-deleted items, in no particular order - callers decide sorting. */
    items: Item[];
    error: string | null;
    /** Drives the badge on MainPageHeader's logo - see NetworkSyncStatus. */
    networkSyncStatus: NetworkSyncStatus;
    /** Creates an item (title may be empty, e.g. to start editing immediately)
     * and returns its id synchronously for optimistic focus handling. The
     * item itself only appears in `items` once the local database write
     * completes (typically within a few ms). `type` defaults to
     * DEFAULT_ITEM_TYPE when omitted - pass it explicitly to copy an
     * existing item's type (e.g. when splitting an item into two). */
    addItem: (title: string, type?: string) => string;
    updateItem: (id: string, patch: Partial<EditableFields>) => void;
    /** Soft-deletes the item (RxDB's `_deleted` tombstone) so Realtime
     * tombstones are reliably delivered to other tabs/devices. */
    removeItem: (id: string) => void;
}

/**
 * Thin React binding for ItemsSyncStore, which owns all of the actual RxDB
 * lifecycle/sync logic outside of React. One store instance is created per
 * component lifetime (via lazy useRef, so it survives re-renders without
 * relying on useMemo's non-guaranteed memoization) and pointed at whichever
 * Supabase client is current; its `itemsSignal`/`errorSignal` are wired
 * into React via `useSignal` (a thin `useSyncExternalStore` wrapper), so
 * this component re-renders on every emission exactly like it would with
 * local `useState`.
 */
export function useItemsSync(client: SupabaseClient): UseItemsSyncResult {
    const storeRef = useRef<ItemsSyncStore | undefined>(undefined);

    /* eslint-disable react-hooks/refs -- intentional lazy useRef store init, per the docstring above;
       storeRef.current is guaranteed set synchronously below, and is read (not mutated) for the rest of this render. */
    if (!storeRef.current) {
        storeRef.current = new ItemsSyncStore();
    }

    const store = storeRef.current;

    useEffect(() => {
        store.setClient(client);
    }, [store, client]);

    useEffect(
        () => () => {
            store.dispose();
        },
        [store]
    );

    const items = useSignal(store.itemsSignal);
    const error = useSignal(store.errorSignal);
    const networkSyncStatus = useSignal(store.networkSyncStatusSignal);

    return {
        items,
        error,
        networkSyncStatus,
        addItem: store.addItem,
        updateItem: store.updateItem,
        removeItem: store.removeItem,
    };
    /* eslint-enable react-hooks/refs */
}
