import { SupabaseClient } from "@supabase/supabase-js";
import { Subscription } from "rxjs";
import { NoteRecord } from "../controllers/NotesList";
import { ensureReplicationReady } from "../localDb/replication";
import { LocalNoteRow, localDb } from "../localDb/localDb";
import { SplitCommaAndTrim } from "../utils/SplitCommaAndTrim";

const TABLE_COLUMNS = "id, title, created_at, modified_at";
type TableColumns = SplitCommaAndTrim<typeof TABLE_COLUMNS>;

export class NotesListTable {
  constructor(private readonly supabase?: SupabaseClient) {}

  public async create({
    id,
    title,
  }: {
    id: string;
    title: string;
  }): Promise<Pick<NoteRecord, TableColumns>> {
    const now = new Date().toISOString();
    const localRow: LocalNoteRow = {
      id,
      title,
      created_at: now,
      _modified: now,
    };

    await localDb.notes_temp.put(localRow);

    return this.toNoteRecord(localRow);
  }

  public async readAll(): Promise<Pick<NoteRecord, TableColumns>[]> {
    if (this.supabase) {
      await ensureReplicationReady(this.supabase);
    }

    const notes = await localDb.notes_temp.toArray();

    return notes.map((note) => this.toNoteRecord(note));
  }

  public async observeAll(
    onChange: (notes: Pick<NoteRecord, TableColumns>[]) => void,
  ): Promise<Subscription> {
    if (this.supabase) {
      await ensureReplicationReady(this.supabase);
    }

    return localDb.notes_temp.observeAll((notes) => {
      onChange(notes.map((note) => this.toNoteRecord(note)));
    });
  }

  public async update(
    id: string,
    updates: {
      title?: string;
    },
  ): Promise<void> {
    const localRow = await localDb.notes_temp.get(id);
    if (!localRow) {
      throw new Error(`NotesListTable.update(${id}) error: note not found`);
    }

    const updatedLocalRow: LocalNoteRow = {
      ...localRow,
      ...updates,
      _modified: new Date().toISOString(),
    };

    await localDb.notes_temp.put(updatedLocalRow);
  }

  public async delete(id: string): Promise<void> {
    await localDb.notes_temp.remove(id);
  }

  private toNoteRecord(row: LocalNoteRow): Pick<NoteRecord, TableColumns> {
    return {
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      modified_at: row._modified,
    };
  }
}
