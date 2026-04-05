import { SupabaseClient } from "@supabase/supabase-js";
import { NOTES_LIST_TABLE_NAME } from "../const/NOTES_LIST_TABLE_NAME";
import { NoteRecord } from "../controllers/NotesList";
import { bootstrapLocalDbFromSupabase } from "../localDb/bootstrapLocalDbFromSupabase";
import { LocalNoteRow, localDb } from "../localDb/localDb";
import { SplitCommaAndTrim } from "../utils/SplitCommaAndTrim";

const TABLE_COLUMNS = "id, title, created_at, updated_at";
type TableColumns = SplitCommaAndTrim<typeof TABLE_COLUMNS>;

export class NotesListTable {
  constructor(private readonly supabase: SupabaseClient) {}

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
      updated_at: now,
      deleted_at: null,
    };

    await localDb.notes_temp.put(localRow);
    void this.syncCreate(localRow);

    return this.toNoteRecord(localRow);
  }

  public async readAll(): Promise<Pick<NoteRecord, TableColumns>[]> {
    await bootstrapLocalDbFromSupabase(this.supabase);

    const notes = await localDb.notes_temp.toArray();

    return notes
      .filter((note) => note.deleted_at == null)
      .map((note) => this.toNoteRecord(note));
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
      updated_at: new Date().toISOString(),
    };

    await localDb.notes_temp.put(updatedLocalRow);
    void this.syncUpdate(id, updates);
  }

  public async delete(id: string): Promise<void> {
    const localRow = await localDb.notes_temp.get(id);
    if (!localRow) {
      throw new Error(`NotesListTable.delete(${id}) error: note not found`);
    }

    await localDb.notes_temp.put({
      ...localRow,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    void this.syncDelete(id);
  }

  private toNoteRecord(row: LocalNoteRow): Pick<NoteRecord, TableColumns> {
    return {
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private async syncCreate(localRow: LocalNoteRow): Promise<void> {
    const { data, error } = await this.supabase
      .from(NOTES_LIST_TABLE_NAME)
      .upsert({
        id: localRow.id,
        title: localRow.title,
      })
      .select(TABLE_COLUMNS)
      .single();

    if (error) {
      console.error(`NotesListTable.syncCreate(${localRow.id})`, error);
      return;
    }

    await localDb.notes_temp.put({
      ...localRow,
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  }

  private async syncUpdate(
    id: string,
    updates: {
      title?: string;
    },
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from(NOTES_LIST_TABLE_NAME)
      .update(updates)
      .eq("id", id)
      .select(TABLE_COLUMNS)
      .single();

    if (error) {
      console.error(`NotesListTable.syncUpdate(${id})`, error);
      return;
    }

    const localRow = await localDb.notes_temp.get(id);
    if (!localRow) {
      return;
    }

    await localDb.notes_temp.put({
      ...localRow,
      title: data.title,
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  }

  private async syncDelete(id: string): Promise<void> {
    const { error } = await this.supabase.rpc("soft_delete_note_temp", {
      note_id_to_delete: id,
    });

    if (error) {
      // TODO: showError
      console.error(`NotesListTable.syncDelete(${id})`, error);
    }
  }
}
