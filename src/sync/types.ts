export type Item = {
  id: string;
  title: string;
  // Required; defaults to DEFAULT_ITEM_TYPE (see const/DEFAULT_ITEM_TYPE)
  // client-side on creation - there's no DB-level default (see schema.sql).
  type: string;
  checked_at: string | null;
  created_at: string;
  // Server-authoritative last-write timestamp. Named `_modified` (rather
  // than e.g. `updated_at`) to match the RxDB Supabase replication plugin's
  // default `modifiedField`, so no config override is needed for it.
  _modified: string;
};

export type EditableFields = Pick<Item, "title" | "checked_at" | "type">;
