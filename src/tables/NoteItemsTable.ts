import { SupabaseClient } from "@supabase/supabase-js";
import { Subscription } from "rxjs";
import { ensureReplicationReady } from "../localDb/replication";
import { LocalNoteItemRow, localDb } from "../localDb/localDb";
import { NoteItem } from "../types/NoteItem";
import { SplitCommaAndTrim } from "../utils/SplitCommaAndTrim";

const TABLE_COLUMNS =
  "id, note_id, is_child, title, position, created_at, modified_at, completed_at";
type TableColumns = SplitCommaAndTrim<typeof TABLE_COLUMNS>;

export class NoteItemsTable {
  constructor(private readonly supabase?: SupabaseClient) {}

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
      _modified: now,
    };

    await localDb.note_items_temp.put(localRow);

    return this.toNoteItem(localRow);
  }

  public async readAll(
    noteId: string,
  ): Promise<Pick<NoteItem, TableColumns>[]> {
    if (this.supabase) {
      await ensureReplicationReady(this.supabase);
    }

    const items = await localDb.note_items_temp.toArray();
    return items
      .filter((item) => item.note_id === noteId)
      .sort((first, second) => first.position - second.position)
      .map((item) => this.toNoteItem(item));
  }

  public async observeAll(
    noteId: string,
    onChange: (items: Pick<NoteItem, TableColumns>[]) => void,
  ): Promise<Subscription> {
    if (this.supabase) {
      await ensureReplicationReady(this.supabase);
    }

    return localDb.note_items_temp.observeAll((items) => {
      onChange(
        items
          .filter((item) => item.note_id === noteId)
          .sort((first, second) => first.position - second.position)
          .map((item) => this.toNoteItem(item)),
      );
    });
  }

  public async readAllNotes(): Promise<Pick<NoteItem, TableColumns>[]> {
    if (this.supabase) {
      await ensureReplicationReady(this.supabase);
    }

    const items = await localDb.note_items_temp.toArray();
    return items
      .sort((first, second) => first.position - second.position)
      .map((item) => this.toNoteItem(item));
  }

  public async observeAllNotes(
    onChange: (items: Pick<NoteItem, TableColumns>[]) => void,
  ): Promise<Subscription> {
    if (this.supabase) {
      await ensureReplicationReady(this.supabase);
    }

    return localDb.note_items_temp.observeAll((items) => {
      onChange(
        items
          .sort((first, second) => first.position - second.position)
          .map((item) => this.toNoteItem(item)),
      );
    });
  }

  public async update(
    itemId: string,
    updates: Partial<
      Pick<NoteItem, "title" | "position" | "completed_at" | "is_child">
    >,
  ): Promise<{ modified_at: string }> {
    const localRow = await localDb.note_items_temp.get(itemId);
    if (!localRow) {
      throw new Error(
        `NoteItemsTable.update(${itemId}) error: note item not found`,
      );
    }

    const modified_at = new Date().toISOString();
    await localDb.note_items_temp.put({
      ...localRow,
      ...updates,
      _modified: modified_at,
    });

    return { modified_at };
  }

  public async setCompleted(
    itemId: string,
    checked: boolean,
  ): Promise<Pick<NoteItem, "completed_at" | "modified_at">> {
    const localRow = await localDb.note_items_temp.get(itemId);
    if (!localRow) {
      throw new Error(
        `NoteItemsTable.setCompleted(${itemId}) error: note item not found`,
      );
    }

    const modified_at = new Date().toISOString();
    const completed_at = checked ? modified_at : null;
    await localDb.note_items_temp.put({
      ...localRow,
      completed_at,
      _modified: modified_at,
    });

    return { completed_at, modified_at };
  }

  public async delete(itemId: string): Promise<void> {
    await localDb.note_items_temp.remove(itemId);
  }

  private toNoteItem(row: LocalNoteItemRow): Pick<NoteItem, TableColumns> {
    return {
      id: row.id,
      note_id: row.note_id,
      is_child: row.is_child,
      title: row.title,
      position: row.position,
      created_at: row.created_at,
      modified_at: row._modified,
      completed_at: row.completed_at,
    };
  }
}
