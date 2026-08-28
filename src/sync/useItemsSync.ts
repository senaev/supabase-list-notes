import { useSignal } from 'senaev-utils/src/utils/Signal/useSignal';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';

import { ItemsSyncStore } from './ItemsSyncStore';
import type { EditableFields, Item, NetworkSyncStatus, RequiredFields } from './types';

export interface UseItemsSyncResult {
    items: Item[];
    typesByPopularity: string[];
    networkSyncStatus: NetworkSyncStatus;
    addItem: (newItem: RequiredFields) => void;
    updateItem: (id: string, fields: Partial<EditableFields>) => void;
    delete: (id: string) => void;
}

export function useItemsSync({
    itemSyncStore,
}: {
    itemSyncStore: ItemsSyncStore;
}): UseItemsSyncResult {
    const items = useSignal(itemSyncStore.recordsSignal);
    const typesByPopularity = useSignal(itemSyncStore.typesByPopularitySignal);

    // TODO: implement
    const networkSyncStatusSignal = new Signal<NetworkSyncStatus>('synced');
    const networkSyncStatus = useSignal(networkSyncStatusSignal);

    return {
        items,
        typesByPopularity,
        networkSyncStatus,
        addItem: itemSyncStore.addItem,
        updateItem: itemSyncStore.updateItem,
        delete: itemSyncStore.delete,
    };
}
