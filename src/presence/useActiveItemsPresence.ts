import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';
import { useSignal } from 'senaev-utils/src/utils/Signal/useSignal';

import { ActiveEditorEmojisByItemId, ActiveItemsPresenceStore } from './ActiveItemsPresenceStore';

export interface UseActiveItemsPresenceResult {
    /** Item id -> animal avatars of everyone *else* on that item right now. */
    emojisByItemId: ActiveEditorEmojisByItemId;
    /**
     * Reports that this tab is editing or has focused the given item, and
     * keeps it claimed for another idle interval. Cheap to call on every
     * keystroke - only an actual change of item hits the network.
     */
    setActiveItem: (itemId: string) => void;
}

/**
 * Thin React binding for ActiveItemsPresenceStore, which owns all of the
 * Realtime channel lifecycle outside of React. Deliberately shaped exactly
 * like useItemsSync: one store instance per component lifetime (via lazy
 * useRef, so it survives re-renders without relying on useMemo's
 * non-guaranteed memoization), pointed at whichever Supabase client is
 * current, with its `emojisByItemIdSignal` wired into React through
 * `useSignal` (a thin `useSyncExternalStore` wrapper).
 */
export function useActiveItemsPresence(client: SupabaseClient): UseActiveItemsPresenceResult {
    const storeRef = useRef<ActiveItemsPresenceStore | undefined>(undefined);

    /* eslint-disable react-hooks/refs -- intentional lazy useRef store init, per the docstring above;
       storeRef.current is guaranteed set synchronously below, and is read (not mutated) for the rest of this render. */
    if (!storeRef.current) {
        storeRef.current = new ActiveItemsPresenceStore();
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

    const emojisByItemId = useSignal(store.emojisByItemIdSignal);

    return {
        emojisByItemId,
        setActiveItem: store.setActiveItem,
    };
    /* eslint-enable react-hooks/refs */
}
