import { createContext, useRef } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';

import { ItemsSyncStore } from '../sync/ItemsSyncStore';

import { useExistingLocalDbFacade } from './LocalDbFacadeContext';

const ItemSyncStoreContext = createContext<ItemsSyncStore | null>(null);

ItemSyncStoreContext.displayName = 'ItemSyncStoreContext';

export const useItemSyncStoreContext = ({
    supabaseClient,
}: {
    supabaseClient: SupabaseClient;
}): ItemsSyncStore => {
    const ref = useRef<ItemsSyncStore | null>(null);

    const localDbFacade = useExistingLocalDbFacade();

    // eslint-disable-next-line react-hooks/refs -- intentional lazy useRef init (survives re-renders without useMemo's non-guaranteed memoization)
    if (!ref.current) {
        const supabaseControllerClientSignal = new Signal<SupabaseClient | undefined>(
            supabaseClient
        );

        ref.current = new ItemsSyncStore({
            supabaseControllerClientSignal,
            localDbFacade,
            showError: (error) => {
                // eslint-disable-next-line no-console
                console.error(error);
            },
        });
    }

    // eslint-disable-next-line react-hooks/refs -- intentional lazy useRef init (survives re-renders without useMemo's non-guaranteed memoization)
    return ref.current;
};
