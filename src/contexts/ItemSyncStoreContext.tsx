import { createContext, useRef } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { Subject } from 'rxjs';
import { forOwn } from 'senaev-utils/src/utils/Object/forOwn/forOwn';
import { mapObjectValues } from 'senaev-utils/src/utils/Object/mapObjectValues/mapObjectValues';

import { OptimisticAsyncStore, OptimisticAsyncStoresDict } from '../sync/ItemsSyncStore';
import { LocalCollectionsTypes, LocalItemRow } from '../sync/localDb';
import { COLLECTION_REPLICATION_OPTIONS, startReplication } from '../sync/replication';

import { useExistingLocalDb } from './LocalDbContext';

const ItemSyncStoreContext = createContext<OptimisticAsyncStore<LocalItemRow> | null>(null);

ItemSyncStoreContext.displayName = 'ItemSyncStoreContext';

export const useItemSyncStoresDictContext = ({
    supabaseClient,
}: {
    supabaseClient: SupabaseClient;
}): OptimisticAsyncStoresDict<LocalCollectionsTypes> => {
    const ref = useRef<OptimisticAsyncStoresDict<LocalCollectionsTypes> | null>(null);

    const localDb = useExistingLocalDb();

    // eslint-disable-next-line react-hooks/refs -- intentional lazy useRef init (survives re-renders without useMemo's non-guaranteed memoization)
    if (!ref.current) {
        const dict: OptimisticAsyncStoresDict<LocalCollectionsTypes> = mapObjectValues(
            localDb.tables,
            (table) => {
                const onErrorSubject = new Subject<Error>();

                return new OptimisticAsyncStore<LocalItemRow>({
                    subscribeUpdates: (callback) => {
                        table
                            .observeAll((incomingItems) => {
                                callback(incomingItems);
                            })
                            .catch((error) => {
                                onErrorSubject.next(error);
                            });
                    },
                    create: (item) => table.put(item),
                    update: (item) => table.put(item),
                    onSubscribeError: (callback) => {
                        onErrorSubject.subscribe(callback);
                    },
                    onAsyncStoreError: (error) => {
                        // eslint-disable-next-line no-console
                        console.error(error);
                    },
                });
            }
        );

        ref.current = dict;

        forOwn(localDb.tables, (_table, name) => {
            startReplication({
                tableName: String(name),
                supabase: supabaseClient,
                collection: localDb.getCollections()[name],
                replicationOptions: COLLECTION_REPLICATION_OPTIONS,
                onError: (_error) => {},
                onActiveChange: (_isActive) => {},
                onReceived: (_record) => {},
                onSent: (_record) => {},
            });
        });
    }

    // eslint-disable-next-line react-hooks/refs -- intentional lazy useRef init (survives re-renders without useMemo's non-guaranteed memoization)
    return ref.current;
};
