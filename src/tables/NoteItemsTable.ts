import { SupabaseClient } from "@supabase/supabase-js";
import { bootstrapLocalDbFromSupabase } from "../localDb/bootstrapLocalDbFromSupabase";
import { LocalNoteItemRow, localDb } from "../localDb/localDb";
import { NoteItem } from "../types/NoteItem";
import { SplitCommaAndTrim } from "../utils/SplitCommaAndTrim";

const TABLE_NAME = "note_items_temp";
const TABLE_COLUMNS =
  "id, note_id, is_child, title, position, created_at, updated_at, completed_at";
type TableColumns = SplitCommaAndTrim<typeof TABLE_COLUMNS>;

export class NoteItemsTable {
  constructor(private readonly supabase: SupabaseClient) {}

  public async create({
    id,
    note_id,
    title,
    position,
    completed_at,
    is_child,
  }: Pick<
    NoteItem,
    "id" | "note_id" | "title" | "position" | "completed_at" | "is_child"
  >): Promise<Pick<NoteItem, TableColumns>> {
    const now = new Date().toISOString();
    const localRow: LocalNoteItemRow = {
      id,
      note_id,
      title,
      position,
      completed_at,
      is_child,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await localDb.note_items_temp.put(localRow);
    void this.syncCreate(localRow);

    return this.toNoteItem(localRow);
  }

  public async readAll(
    noteId: string,
  ): Promise<Pick<NoteItem, TableColumns>[]> {
    await bootstrapLocalDbFromSupabase(this.supabase);

    const items = await localDb.note_items_temp.toArray();
    return items
      .filter((item) => item.note_id === noteId && item.deleted_at == null)
      .sort((first, second) => first.position - second.position)
      .map((item) => this.toNoteItem(item));
  }

  public async readAllNotes(): Promise<Pick<NoteItem, TableColumns>[]> {
    await bootstrapLocalDbFromSupabase(this.supabase);

    const items = await localDb.note_items_temp.toArray();
    return items
      .filter((item) => item.deleted_at == null)
      .sort((first, second) => first.position - second.position)
      .map((item) => this.toNoteItem(item));
  }

  public async update(
    itemId: string,
    updates: Partial<
      Pick<NoteItem, "title" | "position" | "completed_at" | "is_child">
    >,
  ): Promise<{ updated_at: string }> {
    const localRow = await localDb.note_items_temp.get(itemId);
    if (!localRow) {
      throw new Error(
        `NoteItemsTable.update(${itemId}) error: note item not found`,
      );
    }

    const updated_at = new Date().toISOString();
    await localDb.note_items_temp.put({
      ...localRow,
      ...updates,
      updated_at,
    });
    void this.syncUpdate(itemId, updates);

    return { updated_at };
  }

  public async setCompleted(
    itemId: string,
    checked: boolean,
  ): Promise<Pick<NoteItem, "completed_at" | "updated_at">> {
    const localRow = await localDb.note_items_temp.get(itemId);
    if (!localRow) {
      throw new Error(
        `NoteItemsTable.setCompleted(${itemId}) error: note item not found`,
      );
    }

    const updated_at = new Date().toISOString();
    const completed_at = checked ? updated_at : null;
    await localDb.note_items_temp.put({
      ...localRow,
      completed_at,
      updated_at,
    });
    void this.syncSetCompleted(itemId, checked);

    return { completed_at, updated_at };
  }

  public async delete(itemId: string): Promise<void> {
    const localRow = await localDb.note_items_temp.get(itemId);
    if (!localRow) {
      throw new Error(
        `NoteItemsTable.delete(${itemId}) error: note item not found`,
      );
    }

    await localDb.note_items_temp.put({
      ...localRow,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    void this.syncDelete(itemId);
  }

  private toNoteItem(row: LocalNoteItemRow): Pick<NoteItem, TableColumns> {
    return {
      id: row.id,
      note_id: row.note_id,
      is_child: row.is_child,
      title: row.title,
      position: row.position,
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at,
    };
  }

  private async syncCreate(localRow: LocalNoteItemRow): Promise<void> {
    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .upsert({
        id: localRow.id,
        note_id: localRow.note_id,
        title: localRow.title,
        position: localRow.position,
        completed_at: localRow.completed_at,
        is_child: localRow.is_child,
      })
      .select(TABLE_COLUMNS)
      .single();

    if (error) {
      console.error(`NoteItemsTable.syncCreate(${localRow.id})`, error);
      return;
    }

    await localDb.note_items_temp.put({
      ...localRow,
      created_at: data.created_at,
      updated_at: data.updated_at,
      completed_at: data.completed_at,
    });
  }

  private async syncUpdate(
    itemId: string,
    updates: Partial<
      Pick<NoteItem, "title" | "position" | "completed_at" | "is_child">
    >,
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .update(updates)
      .eq("id", itemId)
      .select(TABLE_COLUMNS)
      .single();

    if (error) {
      console.error(`NoteItemsTable.syncUpdate(${itemId})`, error);
      return;
    }

    const localRow = await localDb.note_items_temp.get(itemId);
    if (!localRow) {
      return;
    }

    await localDb.note_items_temp.put({
      ...localRow,
      title: data.title,
      position: data.position,
      is_child: data.is_child,
      created_at: data.created_at,
      updated_at: data.updated_at,
      completed_at: data.completed_at,
    });
  }

  private async syncSetCompleted(
    itemId: string,
    checked: boolean,
  ): Promise<void> {
    const { error, data } = await this.supabase.rpc(
      "set_note_item_completed_temp",
      {
        note_item_id_to_update: itemId,
        next_checked: checked,
      },
    );

    if (error) {
      console.error(`NoteItemsTable.syncSetCompleted(${itemId})`, error);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result) {
      return;
    }

    const localRow = await localDb.note_items_temp.get(itemId);
    if (!localRow) {
      return;
    }

    await localDb.note_items_temp.put({
      ...localRow,
      completed_at: result.completed_at,
      updated_at: result.updated_at,
    });
  }

  private async syncDelete(itemId: string): Promise<void> {
    const { error } = await this.supabase.rpc("soft_delete_note_item_temp", {
      note_item_id_to_delete: itemId,
    });

    if (error) {
      console.error(`NoteItemsTable.syncDelete(${itemId})`, error);
    }
  }
}
