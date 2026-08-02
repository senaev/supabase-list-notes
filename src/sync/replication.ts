import type { SupabaseClient } from '@supabase/supabase-js';
import type { RxCollection } from 'rxdb';
import { replicateSupabase, RxSupabaseReplicationState } from 'rxdb/plugins/replication-supabase';

import { ITEMS_TABLE_NAME } from '../const/ITEMS_TABLE_NAME';

import type { LocalItemRow } from './localDb';

const BATCH_SIZE = 500;

export function startItemsReplication({
    collection,
    client,
}: {
    collection: RxCollection<LocalItemRow>;
    client: SupabaseClient;
}): RxSupabaseReplicationState<LocalItemRow> {
    return replicateSupabase<LocalItemRow>({
        replicationIdentifier: `${ITEMS_TABLE_NAME}-supabase-replication`,
        tableName: ITEMS_TABLE_NAME,
        modifiedField: 'modified_at',
        client,
        collection,
        live: true,
        pull: {
            batchSize: BATCH_SIZE,
        },
        push: {
            batchSize: BATCH_SIZE,
        },
    });
}
