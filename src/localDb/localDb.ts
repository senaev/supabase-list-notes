import Dexie, { Table } from "dexie";

export type LocalNoteRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LocalNoteItemRow = {
  id: string;
  note_id: string;
  is_child: boolean;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
};

type LocalMetaRow = {
  key: string;
  value: string;
};

const LOCAL_BOOTSTRAP_KEY = "supabase_bootstrap_v1";

class LocalNotesDatabase extends Dexie {
  public notes_temp!: Table<LocalNoteRow, string>;
  public note_items_temp!: Table<LocalNoteItemRow, string>;
  public meta!: Table<LocalMetaRow, string>;

  public constructor() {
    super("supabase-list-notes-local-db");

    this.version(1).stores({
      notes_temp: "id, updated_at, deleted_at",
      note_items_temp: "id, note_id, updated_at, deleted_at, position",
      meta: "key",
    });
  }

  public async isBootstrapComplete(): Promise<boolean> {
    const row = await this.meta.get(LOCAL_BOOTSTRAP_KEY);
    return row?.value === "done";
  }

  public async markBootstrapComplete(): Promise<void> {
    await this.meta.put({
      key: LOCAL_BOOTSTRAP_KEY,
      value: "done",
    });
  }
}

export const localDb = new LocalNotesDatabase();
