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

export async function startReplication<T extends ReplicableTableName>(collectionName: T, supabase: SupabaseClient, localDbFacade: LocalDbFacade): Promise<RxSupabaseReplicationState<ReplicatedRowByTable[T]>> {
    const collections: LocalCollections = await localDbFacade.getCollections();
    const collection: LocalCollections[T] = collections[collectionName];

    const replicateConfig: ReplicateSupabaseOptions<ReplicatedRowByTable[T]> = {
        ...COLLECTION_REPLICATION_OPTIONS[collectionName] as Omit<ReplicateSupabaseOptions<ReplicatedRowByTable[T]>, 'collection' | 'client' | 'tableName'>,
        collection: collection as ReplicateSupabaseOptions<ReplicatedRowByTable[T]>['collection'],
        client: supabase,
        tableName: collectionName,
    };

    const replicationState: RxSupabaseReplicationState<ReplicatedRowByTable[T]> = replicateSupabase<ReplicatedRowByTable[T]>(replicateConfig);

    replicationState.error$.subscribe((error) => {
        // eslint-disable-next-line no-console
        console.error('notes replication error', error);
    });

    await replicationState.awaitInitialReplication();

    return replicationState;
}
