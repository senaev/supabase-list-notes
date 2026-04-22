import { SupabaseClient } from "@supabase/supabase-js";
import { WithDeleted } from "rxdb";
import {
  replicateSupabase,
  RxSupabaseReplicationState,
} from "rxdb/plugins/replication-supabase";
import { localDb, LocalNoteItemRow, LocalNoteRow } from "./localDb";

type ReplicationState = {
  notes: RxSupabaseReplicationState<LocalNoteRow>;
  noteItems: RxSupabaseReplicationState<LocalNoteItemRow>;
};

function normalizeNoteItemPosition<T extends { position: number | string }>(
  item: T,
): T {
  return {
    ...item,
    position: Number(item.position),
  } as T;
}

async function startReplication(
  supabase: SupabaseClient,
): Promise<ReplicationState> {
  console.log("Starting replication");
  const collections = await localDb.getCollections();

  const notes = replicateSupabase<LocalNoteRow>({
    replicationIdentifier: "notes_temp_replication",
    collection: collections.notes_temp,
    client: supabase,
    tableName: "notes_temp",
    pull: {
      batchSize: 100,
    },
    push: {
      batchSize: 100,
    },
    live: true,
  });

  const noteItems = replicateSupabase<LocalNoteItemRow>({
    replicationIdentifier: "note_items_temp_replication",
    collection: collections.note_items_temp,
    client: supabase,
    tableName: "note_items_temp",
    pull: {
      batchSize: 500,
      modifier: async (item) => normalizeNoteItemPosition(item),
    },
    push: {
      batchSize: 500,
      modifier: async (item: WithDeleted<LocalNoteItemRow>) =>
        normalizeNoteItemPosition(item),
    },
    live: true,
  });

  notes.error$.subscribe((error) => {
    console.error("notes replication error", error);
  });
  noteItems.error$.subscribe((error) => {
    console.error("note_items replication error", error);
  });

  await Promise.all([
    notes.awaitInitialReplication(),
    noteItems.awaitInitialReplication(),
  ]);

  return { notes, noteItems };
}

let replicationPromise: Promise<ReplicationState> | null = null;
export async function ensureReplicationReady(
  supabase: SupabaseClient,
): Promise<ReplicationState> {
  if (!replicationPromise) {
    replicationPromise = startReplication(supabase).catch((error) => {
      replicationPromise = null;
      throw error;
    });
  }

  return replicationPromise;
}
