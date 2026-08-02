import { createContext, useRef } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

import { ItemsSyncStore } from '../sync/ItemsSyncStore';

const ItemSyncStoreContext = createContext<ItemsSyncStore | null>(null);

ItemSyncStoreContext.displayName = 'ItemSyncStoreContext';

export const useItemSyncStoreContext = ({
    supabaseClient,
}: {
    supabaseClient: SupabaseClient;
}): ItemsSyncStore => {
    const ref = useRef<ItemsSyncStore | null>(null);

    // eslint-disable-next-line react-hooks/refs -- intentional lazy useRef init (survives re-renders without useMemo's non-guaranteed memoization)
    if (!ref.current) {
        ref.current = new ItemsSyncStore(supabaseClient);
    }

    // eslint-disable-next-line react-hooks/refs -- intentional lazy useRef init (survives re-renders without useMemo's non-guaranteed memoization)
    return ref.current;
};
