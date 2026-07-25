export type Item = {
  id: string;
  title: string;
  // Kept in the DB schema for parity with the reference sync design, but
  // there's no UI for it in this app - always null.
  type: string | null;
  checked_at: string | null;
  created_at: string;
  // Server-authoritative last-write timestamp. Named `_modified` (rather
  // than e.g. `updated_at`) to match the RxDB Supabase replication plugin's
  // default `modifiedField`, so no config override is needed for it.
  _modified: string;
};

export type EditableFields = Pick<Item, "title" | "checked_at">;
