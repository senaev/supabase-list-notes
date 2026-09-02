export type Item = {
    id: string;
    title: string;
    type: string;
    checked_at: string | null;
    created_at: string;
    modified_at: string;
    update_index: number;
};

export type RequiredFields = Pick<Item, 'id' | 'title' | 'type'>;
export type EditableFields = Pick<Item, 'title' | 'checked_at' | 'type'>;

export type NetworkSyncStatus = 'offline' | 'syncing' | 'synced';
