export type Item = {
    id: string;
    title: string;
    // Required; defaults to DEFAULT_ITEM_TYPE (see const/DEFAULT_ITEM_TYPE)
    // client-side on creation - there's no DB-level default (see schema.sql).
    type: string;
    checked_at: string | null;
    created_at: string;
    modified_at: string;
};

export type EditableFields = Pick<Item, 'title' | 'checked_at' | 'type'>;

/**
 * "offline" also covers a persistently failing sync (e.g. Supabase itself
 * unreachable, RLS/schema errors) - from the user's perspective that looks
 * the same as no network, and this app has no separate UI for it (see
 * ItemsSyncStore's hasReplicationErrorSignal).
 */
export type NetworkSyncStatus = 'offline' | 'syncing' | 'synced';
