import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';
import { subscribeSignalAndCallWithCurrentValue } from 'senaev-utils/src/utils/Signal/subscribeSignalAndCallWithCurrentValue/subscribeSignalAndCallWithCurrentValue';

import { noop } from '../utils/noop';

import { pickNewerRow } from './pickNewerRow';
import { EditableFields } from './types';

export type StoreItemInternalParams = {
    id: string;
    created_at: string;
    modified_at: string;
    update_index: number;
    _deleted: boolean;
};

export type StoreItemItemOwnParams<T extends StoreItemInternalParams> = Omit<
    T,
    keyof StoreItemInternalParams
>;

type AsyncStorage<T extends StoreItemInternalParams> = {
    readonly items: Signal<T[]>;
    readonly put: (item: T) => Promise<void>;
};

type PendingOptimisticCreate<T extends StoreItemInternalParams> = {
    item: T;
    writePromise: Promise<void>;
};

export type OptimisticSyncTable<T extends Record<string, StoreItemInternalParams>> = {
    [key in keyof T]: OptimisticAsyncStore<T[key]>;
};

export class OptimisticAsyncStore<T extends StoreItemInternalParams> {
    public readonly items = new Signal<T[]>([], deepEqual);

    private readonly pendingOptimisticCreatesById = new Map<string, PendingOptimisticCreate<T>>();

    private pendingOptimisticDeleteIds = new Set<string>();

    public constructor(private readonly remoteStorage: AsyncStorage<T>) {
        subscribeSignalAndCallWithCurrentValue(this.remoteStorage.items, (allIncomingItems) => {
            const incomingIds = new Set(allIncomingItems.map((item) => item.id));
            const incomingItems = allIncomingItems.filter(
                (item) => !this.pendingOptimisticDeleteIds.has(item.id)
            );

            this.pendingOptimisticDeleteIds = new Set(
                [...this.pendingOptimisticDeleteIds].filter((id) => incomingIds.has(id))
            );

            const currentById = new Map(this.items.getValue().map((item) => [item.id, item]));

            const nextState = incomingItems.map((incomingItem) => {
                this.pendingOptimisticCreatesById.delete(incomingItem.id);

                const currentItem = currentById.get(incomingItem.id);

                if (!currentItem) {
                    return incomingItem;
                }

                return pickNewerRow(incomingItem, currentItem);
            });

            for (const pendingOptimisticCreate of this.pendingOptimisticCreatesById.values()) {
                nextState.push(pendingOptimisticCreate.item);
            }

            this.items.dispatch(nextState);
        });
    }

    public readonly createItem = (
        newItem: StoreItemItemOwnParams<T>
    ): {
        id: StoreItemInternalParams['id'];
    } => {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        const internalParams: StoreItemInternalParams = {
            id,
            created_at: now,
            modified_at: now,
            update_index: 0,
            _deleted: false,
        };
        const localRow: T = {
            ...internalParams,
            ...newItem,
        } as T;

        const writePromise = this.remoteStorage.put(localRow);

        this.pendingOptimisticCreatesById.set(id, {
            item: localRow,
            writePromise,
        });

        this.items.dispatch([...this.items.getValue(), localRow]);

        return { id };
    };

    public readonly updateItem = async (
        id: string,
        updates: Partial<EditableFields>
    ): Promise<void> => {
        const currentItem = this.items.getValue().find((item) => item.id === id);

        if (!currentItem) {
            throw new Error(`ItemsSyncStore.updateItem(${id}) error: note not found`);
        }

        const modified_at = new Date().toISOString();
        const update_index = currentItem.update_index + 1;

        let nextItem: T | undefined;

        this.items.dispatch(
            this.items.getValue().map((item) => {
                if (item.id !== id) {
                    return item;
                }

                nextItem = {
                    ...item,
                    ...updates,
                    modified_at,
                    update_index,
                };

                return nextItem;
            })
        );

        if (!nextItem) {
            throw new Error(`ItemsSyncStore.updateItem(${id}) error: note not found`);
        }

        const updatedLocalRow: T = {
            ...nextItem,
            _deleted: false,
        };

        await this.remoteStorage.put(updatedLocalRow);
    };

    public readonly deleteItem = async (id: string): Promise<void> => {
        const pendingOptimisticCreate = this.pendingOptimisticCreatesById.get(id);
        const currentItem = this.items.getValue().find((item) => item.id === id);

        this.pendingOptimisticCreatesById.delete(id);
        this.pendingOptimisticDeleteIds.add(id);
        this.items.dispatch(this.items.getValue().filter((item) => item.id !== id));

        if (pendingOptimisticCreate) {
            await pendingOptimisticCreate.writePromise.catch(noop);
        }

        if (!currentItem) {
            return;
        }

        const deletedRow: T = {
            ...currentItem,
            modified_at: new Date().toISOString(),
            update_index: currentItem.update_index + 1,
            _deleted: true,
        };

        await this.remoteStorage.put(deletedRow);
    };
}
