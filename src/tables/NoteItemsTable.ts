import { SupabaseClient } from "@supabase/supabase-js";
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
    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .insert({
        id,
        note_id,
        title,
        position,
        completed_at,
        is_child,
      })
      .select(TABLE_COLUMNS)
      .single();

    if (error) {
      throw new Error(`NoteItemsTable.create: ${error.message}`);
    }

    return data;
  }

  public async readAll(
    noteId: string,
  ): Promise<Pick<NoteItem, TableColumns>[]> {
    const { error, data } = await this.supabase
      .from(TABLE_NAME)
      .select(TABLE_COLUMNS)
      .eq("note_id", noteId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(
        `NoteItemsTable.readAll: Error loading list items for id=[${noteId}] error=[${error.message}]`,
      );
    }

    return data;
  }

  public async update(
    itemId: string,
    updates: Partial<
      Pick<NoteItem, "title" | "position" | "completed_at" | "is_child">
    >,
  ): Promise<{ updated_at: string }> {
    const { error, data } = await this.supabase
      .from(TABLE_NAME)
      .update(updates)
      .eq("id", itemId)
      .select(TABLE_COLUMNS)
      .single();

    if (error) {
      throw new Error(
        `NoteItemsTable.update(${itemId}) error: ${error.message}`,
      );
    }

    return {
      updated_at: data.updated_at,
    };
  }

  public async setCompleted(
    itemId: string,
    checked: boolean,
  ): Promise<Pick<NoteItem, "completed_at" | "updated_at">> {
    const { error, data } = await this.supabase.rpc(
      "set_note_item_completed_temp",
      {
        note_item_id_to_update: itemId,
        next_checked: checked,
      },
    );

    if (error) {
      throw new Error(
        `NoteItemsTable.setCompleted(${itemId}) error: ${error.message}`,
      );
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result) {
      throw new Error(
        `NoteItemsTable.setCompleted(${itemId}) error: empty response`,
      );
    }

    return {
      completed_at: result.completed_at,
      updated_at: result.updated_at,
    };
  }

  public async delete(itemId: string): Promise<void> {
    const { error } = await this.supabase.rpc("soft_delete_note_item_temp", {
      note_item_id_to_delete: itemId,
    });

    if (error) {
      throw new Error(
        `NoteItemsTable.delete(${itemId}) error: ${error.message}`,
      );
    }
  }
}
