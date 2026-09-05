import { createContext, useRef } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { forOwn } from 'senaev-utils/src/utils/Object/forOwn/forOwn';
import { mapObjectValues } from 'senaev-utils/src/utils/Object/mapObjectValues/mapObjectValues';

import { OptimisticAsyncStore, OptimisticSyncTable } from '../sync/OptimisticAsyncStore';
import { LocalCollectionsTypes, LocalItemRow } from '../sync/localDb';
import { COLLECTION_REPLICATION_OPTIONS, startReplication } from '../sync/replication';

import { useExistingLocalDb } from './LocalDbContext';

const ItemSyncStoreContext = createContext<OptimisticAsyncStore<LocalItemRow> | null>(null);

ItemSyncStoreContext.displayName = 'ItemSyncStoreContext';

export const useItemSyncStoresDictContext = ({
    supabaseClient,
}: {
    supabaseClient: SupabaseClient;
}): OptimisticSyncTable<LocalCollectionsTypes> => {
    const ref = useRef<OptimisticSyncTable<LocalCollectionsTypes> | null>(null);

    const localDb = useExistingLocalDb();

    // eslint-disable-next-line react-hooks/refs -- intentional lazy useRef init (survives re-renders without useMemo's non-guaranteed memoization)
    if (!ref.current) {
        const dict: OptimisticSyncTable<LocalCollectionsTypes> = mapObjectValues(
            localDb.tables,
            (table) => new OptimisticAsyncStore<LocalItemRow>(table)
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
