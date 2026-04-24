import { SupabaseClient } from '@supabase/supabase-js';
import { WithDeleted } from 'rxdb';
import {
    replicateSupabase,
    RxSupabaseReplicationState,
} from 'rxdb/plugins/replication-supabase';

import {
    LocalCollections,
    LocalDbFacade,
    LocalNoteItemRow,
    LocalNoteRow,
} from './LocalDbFacade';

function normalizeNoteItemPosition<T extends { position: number | string }>(item: T): T {
    return {
        ...item,
        position: Number(item.position),
    } as T;
}

type ReplicatedRowByTable = {
    notes_temp: LocalNoteRow;
    note_items_temp: LocalNoteItemRow;
};

type ReplicableTableName = keyof ReplicatedRowByTable;

type ReplicateSupabaseOptions<T> = Parameters<typeof replicateSupabase<T>>[0];

const COLLECTION_REPLICATION_OPTIONS: { [K in ReplicableTableName]: Omit<ReplicateSupabaseOptions<ReplicatedRowByTable[K]>, 'collection' | 'client' | 'tableName'> } = {
    notes_temp: {
        replicationIdentifier: 'notes_temp_replication',
        pull: {
            batchSize: 100,
        },
        push: {
            batchSize: 100,
        },
    },
    note_items_temp: {
        replicationIdentifier: 'note_items_temp_replication',
        pull: {
            batchSize: 500,
            modifier: (item) => normalizeNoteItemPosition(item),
        },
        push: {
            batchSize: 500,
            modifier: (item: WithDeleted<LocalNoteItemRow>) => normalizeNoteItemPosition(item),
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
        ...COLLECTION_REPLICATION_OPTIONS[collectionName] as Omit<ReplicateSupabaseOptions<ReplicatedRowByTable[T]>, 'collection' | 'client' | 'tableName'>,
        collection: collection as ReplicateSupabaseOptions<ReplicatedRowByTable[T]>['collection'],
        client: supabase,
        tableName: collectionName,
    };

    const replicationState: RxSupabaseReplicationState<ReplicatedRowByTable[T]> = replicateSupabase<ReplicatedRowByTable[T]>(replicateConfig);

    replicationState.error$.subscribe(onError);
    replicationState.active$.subscribe(onActiveChange);
    replicationState.received$.subscribe(onReceived);
    replicationState.sent$.subscribe(onSent);

    return replicationState;
}
