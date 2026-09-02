import { SupabaseClient } from '@supabase/supabase-js';
import { WithDeleted } from 'rxdb';
import { replicateSupabase, RxSupabaseReplicationState } from 'rxdb/plugins/replication-supabase';

import { LocalCollections, LocalDbFacade, LocalItemRow } from './localDb';

type ReplicatedRowByTable = {
    items: LocalItemRow;
};

type ReplicableTableName = keyof ReplicatedRowByTable;

type ReplicateSupabaseOptions<T> = Parameters<typeof replicateSupabase<T>>[0];

const BATCH_SIZE = 500;

const COLLECTION_REPLICATION_OPTIONS: {
    [K in ReplicableTableName]: Omit<
        ReplicateSupabaseOptions<ReplicatedRowByTable[K]>,
        'collection' | 'client' | 'tableName'
    >;
} = {
    items: {
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
    },
};

export function startReplication<T extends ReplicableTableName>({
    collectionName,
    supabase,
    localDbFacade,
    onError,
    onActiveChange,
    onReceived,
    onSent,
}: {
    collectionName: T;
    supabase: SupabaseClient;
    localDbFacade: LocalDbFacade;
    onError: (error: unknown) => void;
    onActiveChange: (isActive: boolean) => void;
    onReceived: (record: ReplicatedRowByTable[T]) => void;
    onSent: (record: WithDeleted<ReplicatedRowByTable[T]>) => void;
}): RxSupabaseReplicationState<ReplicatedRowByTable[T]> {
    const collections: LocalCollections = localDbFacade.getCollections();
    const collection: LocalCollections[T] = collections[collectionName];

    const replicateConfig: ReplicateSupabaseOptions<ReplicatedRowByTable[T]> = {
        ...(COLLECTION_REPLICATION_OPTIONS[collectionName] as Omit<
            ReplicateSupabaseOptions<ReplicatedRowByTable[T]>,
            'collection' | 'client' | 'tableName'
        >),
        collection: collection as unknown as ReplicateSupabaseOptions<
            ReplicatedRowByTable[T]
        >['collection'],
        client: supabase,
        tableName: collectionName,
    };

    const replicationState: RxSupabaseReplicationState<ReplicatedRowByTable[T]> =
        replicateSupabase<ReplicatedRowByTable[T]>(replicateConfig);

    replicationState.error$.subscribe(onError);
    replicationState.active$.subscribe(onActiveChange);
    replicationState.received$.subscribe(onReceived);
    replicationState.sent$.subscribe(onSent);

    return replicationState;
}
