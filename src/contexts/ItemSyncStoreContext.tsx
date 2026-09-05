import { createContext, useRef } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { forOwn } from 'senaev-utils/src/utils/Object/forOwn/forOwn';

import { OptimisticSyncTable } from '../sync/OptimisticSyncTable/OptimisticSyncTable';
import { LocalItemRow } from '../sync/localDb';
import { COLLECTION_REPLICATION_OPTIONS, startReplication } from '../sync/replication';

import { useExistingLocalDb } from './LocalDbContext';

const ItemSyncStoreContext = createContext<OptimisticSyncTable<LocalItemRow> | null>(null);

ItemSyncStoreContext.displayName = 'ItemSyncStoreContext';

export const useItemSyncStoresDictContext = ({
    supabaseClient,
}: {
    supabaseClient: SupabaseClient;
}): void => {
    const ref = useRef<boolean>(false);

    const { localDb } = useExistingLocalDb();

    // eslint-disable-next-line react-hooks/refs -- intentional lazy useRef init (survives re-renders without useMemo's non-guaranteed memoization)
    if (!ref.current) {
        forOwn(localDb.tables, (_table, name) => {
            console.log('start replication');
            startReplication({
                tableName: String(name),
                supabase: supabaseClient,
                collection: localDb.getCollections()[name],
                replicationOptions: COLLECTION_REPLICATION_OPTIONS,
                onError: (_error) => {
                    // TODO
                },
                onActiveChange: (_isActive) => {
                    // TODO
                },
                onReceived: (_record) => {
                    // TODO
                },
                onSent: (_record) => {
                    // TODO
                },
            });
        });

        ref.current = true;
    }
};
