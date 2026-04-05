import { SupabaseClient } from "@supabase/supabase-js";
import {
  localDb,
} from "./localDb";

const NOTES_TABLE_NAME = "notes_temp";
const NOTE_ITEMS_TABLE_NAME = "note_items_temp";

const NOTES_SYNC_COLUMNS = "id, title, created_at, updated_at, deleted_at";
const NOTE_ITEMS_SYNC_COLUMNS =
  "id, note_id, is_child, title, position, created_at, updated_at, completed_at, deleted_at";

async function runBootstrapFromSupabase(
  supabase: SupabaseClient,
): Promise<void> {
  const [
    { data: notes, error: notesError },
    { data: noteItems, error: noteItemsError },
  ] = await Promise.all([
    supabase.from(NOTES_TABLE_NAME).select(NOTES_SYNC_COLUMNS),
    supabase.from(NOTE_ITEMS_TABLE_NAME).select(NOTE_ITEMS_SYNC_COLUMNS),
  ]);

  if (notesError) {
    throw new Error(
      `bootstrapLocalDbFromSupabase(notes) error: ${notesError.message}`,
    );
  }

  if (noteItemsError) {
    throw new Error(
      `bootstrapLocalDbFromSupabase(note_items) error: ${noteItemsError.message}`,
    );
  }

      await localDb.transaction(
        "rw",
        localDb.notes_temp,
        localDb.note_items_temp,
        localDb.meta,
        async () => {
          await localDb.notes_temp.bulkPut(notes ?? []);
          await localDb.note_items_temp.bulkPut(noteItems ?? []);
          await localDb.markBootstrapComplete();
        },
      );
}

let bootstrapPromise: Promise<void> | null = null;

export async function bootstrapLocalDbFromSupabase(
  supabase: SupabaseClient,
): Promise<void> {
  if (await localDb.isBootstrapComplete()) {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrapFromSupabase(supabase).finally(() => {
      bootstrapPromise = null;
    });
  }

  await bootstrapPromise;
}
