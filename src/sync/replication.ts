import { SupabaseClient } from '@supabase/supabase-js';
import { RxCollection } from 'rxdb';
import { replicateSupabase, RxSupabaseReplicationState } from 'rxdb/plugins/replication-supabase';

import { LocalItemRow } from './localDb';

type ReplicateSupabaseOptions<T> = Parameters<typeof replicateSupabase<T>>[0];

const BATCH_SIZE = 500;

type ReplicationOptions<T extends Record<string, unknown>> = Omit<
    ReplicateSupabaseOptions<T>,
    'collection' | 'client' | 'tableName'
>;

export const COLLECTION_REPLICATION_OPTIONS: ReplicationOptions<LocalItemRow> = {
    replicationIdentifier: 'items_replication',
    // RxDB's Supabase replication plugin defaults to `_modified`, but
    // that column is named `modified_at` in schema.sql - RxDB reserves
    // leading-underscore field names for its own internals, so the
    // column can't use the plugin's default name.
    modifiedField: 'modified_at',
    pull: {
        batchSize: BATCH_SIZE,
    },
    push: {
        batchSize: BATCH_SIZE,
    },
    live: true,
};

export function startReplication<T extends Record<string, unknown>>({
    tableName,
    supabase,
    collection,
    replicationOptions,
    onError,
    onActiveChange,
    onReceived,
    onSent,
}: {
    tableName: string;
    supabase: SupabaseClient;
    collection: RxCollection<T>;
    replicationOptions: ReplicationOptions<T>;
    onError: (error: unknown) => void;
    onActiveChange: (isActive: boolean) => void;
    onReceived: (record: T) => void;
    onSent: (record: T) => void;
}): RxSupabaseReplicationState<T> {
    const replicateConfig: ReplicateSupabaseOptions<T> = {
        ...replicationOptions,
        collection,
        client: supabase,
        tableName,
    };

    const replicationState: RxSupabaseReplicationState<T> = replicateSupabase<T>(replicateConfig);

    replicationState.error$.subscribe(onError);
    replicationState.active$.subscribe(onActiveChange);
    replicationState.received$.subscribe(onReceived);
    replicationState.sent$.subscribe(onSent);

    return replicationState;
}
