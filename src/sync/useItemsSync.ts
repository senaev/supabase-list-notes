import { useSignal } from 'senaev-utils/src/utils/Signal/useSignal';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';

import { getTypesByPopularity } from '../utils/getTypesByPopularity';

import { ItemOwnParams, ItemsSyncStore, SynchedItem } from './ItemsSyncStore';
import type { EditableFields, Item, NetworkSyncStatus } from './types';
import { LocalItemRow } from './localDb';

export interface UseItemsSyncResult {
    items: Item[];
    typesByPopularity: string[];
    networkSyncStatus: NetworkSyncStatus;
    addItem: (newItem: ItemOwnParams<LocalItemRow>) => {
        id: SynchedItem['id'];
    };
    updateItem: (id: string, fields: Partial<EditableFields>) => void;
    delete: (id: string) => void;
}

function toItem(row: LocalItemRow): Item {
    return {
        id: row.id,
        title: row.title,
        type: row.type,
        checked_at: row.checked_at,
        created_at: row.created_at,
        modified_at: row.modified_at,
        update_index: row.update_index,
    };
}

export function useItemsSync({
    itemSyncStore,
}: {
    itemSyncStore: ItemsSyncStore<LocalItemRow>;
}): UseItemsSyncResult {
    const itemRows = useSignal(itemSyncStore.recordsSignal);

    const items = itemRows.map(toItem);

    // TODO: implement
    const networkSyncStatusSignal = new Signal<NetworkSyncStatus>('synced');
    const networkSyncStatus = useSignal(networkSyncStatusSignal);

    const typesByPopularity = getTypesByPopularity(items);

    return {
        items,
        typesByPopularity,
        networkSyncStatus,
        addItem: itemSyncStore.addItem,
        updateItem: itemSyncStore.updateItem,
        delete: itemSyncStore.delete,
    };
}
