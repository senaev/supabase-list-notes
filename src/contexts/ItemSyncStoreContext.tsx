import { createContext, useRef } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { Subject } from 'rxjs';
import { forOwn } from 'senaev-utils/src/utils/Object/forOwn/forOwn';

import { OptimisticAsyncStore } from '../sync/ItemsSyncStore';
import { LocalItemRow } from '../sync/localDb';
import { COLLECTION_REPLICATION_OPTIONS, startReplication } from '../sync/replication';

import { useExistingLocalDbFacade } from './LocalDbContext';

const ItemSyncStoreContext = createContext<OptimisticAsyncStore<LocalItemRow> | null>(null);

ItemSyncStoreContext.displayName = 'ItemSyncStoreContext';

export const useItemSyncStoreContext = ({
    supabaseClient,
}: {
    supabaseClient: SupabaseClient;
}): OptimisticAsyncStore<LocalItemRow> => {
    const ref = useRef<OptimisticAsyncStore<LocalItemRow> | null>(null);

    const localDbFacade = useExistingLocalDbFacade();

    // eslint-disable-next-line react-hooks/refs -- intentional lazy useRef init (survives re-renders without useMemo's non-guaranteed memoization)
    if (!ref.current) {
        forOwn(localDbFacade.tables, (_table, name) => {
            startReplication({
                collectionName: String(name),
                supabase: supabaseClient,
                collection: localDbFacade.getCollections()[name],
                replicationOptions: COLLECTION_REPLICATION_OPTIONS,
                onError: (_error) => {},
                onActiveChange: (_isActive) => {},
                onReceived: (_record) => {},
                onSent: (_record) => {},
            });
        });

        const onErrorSubject = new Subject<Error>();

        const { items } = localDbFacade.tables;

        ref.current = new OptimisticAsyncStore<LocalItemRow>({
            subscribeUpdates: (callback) => {
                items
                    .observeAll((incomingItems) => {
                        callback(incomingItems);
                    })
                    .catch((error) => {
                        onErrorSubject.next(error);
                    });
            },
            create: (item) => items.put(item),
            update: (item) => items.put(item),
            onSubscribeError: (callback) => {
                onErrorSubject.subscribe(callback);
            },
            onAsyncStoreError: (error) => {
                // eslint-disable-next-line no-console
                console.error(error);
            },
        });
    }

    // eslint-disable-next-line react-hooks/refs -- intentional lazy useRef init (survives re-renders without useMemo's non-guaranteed memoization)
    return ref.current;
};
