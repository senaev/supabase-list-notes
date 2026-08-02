import type { SupabaseClient } from '@supabase/supabase-js';
import type { RxCollection } from 'rxdb';
import { replicateSupabase, RxSupabaseReplicationState } from 'rxdb/plugins/replication-supabase';
import { ITEMS_TABLE_NAME } from '../const/ITEMS_TABLE_NAME';
import type { LocalItemRow } from './localDb';

const BATCH_SIZE = 500;

/**
 * Both `deletedField` and `modifiedField` are left at their plugin defaults
 * (`_deleted` / `_modified`), matching the real Postgres column names - see
 * schema.sql, where `_modified` is unconditionally server-stamped on every
 * write by a DB trigger, which is exactly what this plugin expects of a
 * modified-field column: it strips the field from every push payload and
 * relies entirely on the server to set the authoritative value.
 */
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
