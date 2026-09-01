import { createContext, useRef } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { Subject } from 'rxjs';

import { ItemsSyncStore } from '../sync/ItemsSyncStore';
import { startReplication } from '../sync/replication';

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
        startReplication({
            collectionName: 'items',
            supabase: supabaseClient,
            localDbFacade,
            onError: (_error) => {},
            onActiveChange: (_isActive) => {},
            onReceived: (_record) => {},
            onSent: (_record) => {},
        });

        const onErrorSubject = new Subject<Error>();

        ref.current = new ItemsSyncStore({
            remoteStorage: {
                subscribe: (callback) => {
                    localDbFacade.notes_temp
                        .observeAll((incomingItems) => {
                            callback(incomingItems);
                        })
                        .catch((error) => {
                            onErrorSubject.next(error);
                        });
                },
                subscribeError: (callback) => {
                    onErrorSubject.subscribe(callback);
                },
                addItem: (item) => localDbFacade.notes_temp.put(item),
                updateItem: (item) => localDbFacade.notes_temp.put(item),
            },
            showError: (error) => {
                // eslint-disable-next-line no-console
                console.error(error);
            },
        });
    }

    // eslint-disable-next-line react-hooks/refs -- intentional lazy useRef init (survives re-renders without useMemo's non-guaranteed memoization)
    return ref.current;
};
