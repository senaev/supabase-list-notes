import { SupabaseClient } from "@supabase/supabase-js";
import { NOTES_LIST_TABLE_NAME } from "../const/NOTES_LIST_TABLE_NAME";
import { NoteRecord } from "../controllers/NotesList";
import { SplitCommaAndTrim } from "../utils/SplitCommaAndTrim";

const TABLE_COLUMNS = "id, title, created_at, updated_at";
type TableColumns = SplitCommaAndTrim<typeof TABLE_COLUMNS>;

const VIEW_NAME = "notes_with_counts_temp";
const VIEW_COLUMNS =
  "id, title, created_at, updated_at, items_count, open_items_count";
type ViewColumns = SplitCommaAndTrim<typeof VIEW_COLUMNS>;

export class NotesListTable {
  constructor(private readonly supabase: SupabaseClient) {}

  public async create({
    id,
    title,
  }: {
    id: string;
    title: string;
  }): Promise<Pick<NoteRecord, TableColumns>> {
    const { data, error } = await this.supabase
      .from(NOTES_LIST_TABLE_NAME)
      .insert({ id, title })
      .select(TABLE_COLUMNS)
      .single();

    if (error) {
      throw new Error(`NotesListTable.create: ${error.message}`);
    }

    return data;
  }

  public async readAll(): Promise<Pick<NoteRecord, ViewColumns>[]> {
    const { error, data } = await this.supabase
      .from(VIEW_NAME)
      .select(VIEW_COLUMNS);

    if (error) {
      throw new Error(`NotesListTable.readAll error: ${error.message}`);
    }

    return data;
  }

  public async update(
    id: string,
    updates: {
      title?: string;
    },
  ): Promise<void> {
    const { error } = await this.supabase
      .from(NOTES_LIST_TABLE_NAME)
      .update(updates)
      .eq("id", id)
      .select(TABLE_COLUMNS)
      .single();

    if (error) {
      throw new Error(`NotesListTable.update(${id}) error: ${error.message}`);
    }
  }

  public async delete(id: string): Promise<void> {
    const { error } = await this.supabase.rpc("soft_delete_note_temp", {
      note_id_to_delete: id,
    });

    if (error) {
      throw new Error(`NotesListTable.delete(${id}) error: ${error.message}`);
    }
  }
}
