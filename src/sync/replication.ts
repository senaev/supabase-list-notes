import { SupabaseClient } from '@supabase/supabase-js';
import { WithDeleted } from 'rxdb';
import { replicateSupabase, RxSupabaseReplicationState } from 'rxdb/plugins/replication-supabase';

import { LocalCollections, LocalCollectionsTypes, LocalDbFacade } from './localDb';

type ReplicableTableName = keyof LocalCollectionsTypes;

type ReplicateSupabaseOptions<T> = Parameters<typeof replicateSupabase<T>>[0];

const BATCH_SIZE = 500;

const COLLECTION_REPLICATION_OPTIONS: {
    [K in ReplicableTableName]: Omit<
        ReplicateSupabaseOptions<LocalCollectionsTypes[K]>,
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
    localDbFacade: LocalDbFacade<LocalCollectionsTypes>;
    onError: (error: unknown) => void;
    onActiveChange: (isActive: boolean) => void;
    onReceived: (record: LocalCollectionsTypes[T]) => void;
    onSent: (record: WithDeleted<LocalCollectionsTypes[T]>) => void;
}): RxSupabaseReplicationState<LocalCollectionsTypes[T]> {
    const collections: LocalCollections = localDbFacade.getCollections();
    const collection: LocalCollections[T] = collections[collectionName];

    const replicateConfig: ReplicateSupabaseOptions<LocalCollectionsTypes[T]> = {
        ...(COLLECTION_REPLICATION_OPTIONS[collectionName] as Omit<
            ReplicateSupabaseOptions<LocalCollectionsTypes[T]>,
            'collection' | 'client' | 'tableName'
        >),
        collection: collection as unknown as ReplicateSupabaseOptions<
            LocalCollectionsTypes[T]
        >['collection'],
        client: supabase,
        tableName: collectionName,
    };

    const replicationState: RxSupabaseReplicationState<LocalCollectionsTypes[T]> =
        replicateSupabase<LocalCollectionsTypes[T]>(replicateConfig);

    replicationState.error$.subscribe(onError);
    replicationState.active$.subscribe(onActiveChange);
    replicationState.received$.subscribe(onReceived);
    replicationState.sent$.subscribe(onSent);

    return replicationState;
}
