import { useSignal } from 'senaev-utils/src/utils/Signal/useSignal';

import { ItemsSyncStore } from './ItemsSyncStore';
import type { EditableFields, Item, NetworkSyncStatus } from './types';

export interface UseItemsSyncResult {
    items: Item[];
    error: string | null;
    networkSyncStatus: NetworkSyncStatus;
    addItem: (title: string, type: string) => string;
    updateItem: (id: string, patch: Partial<EditableFields>) => void;
    removeItem: (id: string) => void;
}

export function useItemsSync({
    itemSyncStore,
}: {
    itemSyncStore: ItemsSyncStore;
}): UseItemsSyncResult {
    const items = useSignal(itemSyncStore.itemsSignal);
    const error = useSignal(itemSyncStore.errorSignal);
    const networkSyncStatus = useSignal(itemSyncStore.networkSyncStatusSignal);

    return {
        items,
        error,
        networkSyncStatus,
        addItem: itemSyncStore.addItem,
        updateItem: itemSyncStore.updateItem,
        removeItem: itemSyncStore.removeItem,
    };
}
