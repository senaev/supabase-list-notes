import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';

import { noop } from '../utils/noop';

import { pickNewerRow } from './pickNewerRow';
import { EditableFields } from './types';

export type OptimisticAsyncItemInternalParams = {
    id: string;
    created_at: string;
    modified_at: string;
    update_index: number;
    _deleted: boolean;
};

export type OptimisticAsyncItemOwnParams<T extends OptimisticAsyncItemInternalParams> = Omit<
    T,
    keyof OptimisticAsyncItemInternalParams
>;

type AsyncStore<T extends OptimisticAsyncItemInternalParams> = {
    readonly subscribe: (callback: (incomingItems: T[]) => void) => void;
    readonly subscribeError: (callback: (error: Error) => void) => void;
    readonly createItem: (item: T) => Promise<void>;
    readonly updateItem: (item: T) => Promise<void>;
};

type PendingOptimisticAsyncCreate<T extends OptimisticAsyncItemInternalParams> = {
    item: T;
    writePromise: Promise<void>;
};

export class OptimisticAsyncStore<T extends OptimisticAsyncItemInternalParams> {
    public readonly recordsSignal = new Signal<T[]>([], deepEqual);

    private readonly pendingOptimisticCreatesById = new Map<
        string,
        PendingOptimisticAsyncCreate<T>
    >();

    private pendingOptimisticDeleteIds = new Set<string>();

    public constructor(
        private readonly params: {
            remoteStorage: AsyncStore<T>;
            onAsyncStoreError: (message: string) => void;
        }
    ) {
        this.params.remoteStorage.subscribe((allIncomingItems) => {
            const incomingIds = new Set(allIncomingItems.map((item) => item.id));
            const incomingItems = allIncomingItems.filter(
                (item) => !this.pendingOptimisticDeleteIds.has(item.id)
            );

            this.pendingOptimisticDeleteIds = new Set(
                [...this.pendingOptimisticDeleteIds].filter((id) => incomingIds.has(id))
            );

            const currentById = new Map(
                this.recordsSignal.getValue().map((item) => [item.id, item] as const)
            );

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

            this.recordsSignal.dispatch(nextState);
        });

        this.params.remoteStorage.subscribeError((error: Error) => {
            this.params.onAsyncStoreError(error.message);
        });
    }

    public readonly createItem = (
        newItemParams: OptimisticAsyncItemOwnParams<T>
    ): {
        id: OptimisticAsyncItemInternalParams['id'];
    } => {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        const internalParams: OptimisticAsyncItemInternalParams = {
            id,
            created_at: now,
            modified_at: now,
            update_index: 0,
            _deleted: false,
        };
        const localRow: T = {
            ...internalParams,
            ...newItemParams,
        } as T;

        const writePromise = this.params.remoteStorage.createItem(localRow);

        this.pendingOptimisticCreatesById.set(id, {
            item: localRow,
            writePromise,
        });

        this.recordsSignal.dispatch([...this.recordsSignal.getValue(), localRow]);

        return { id };
    };

    public readonly updateItem = async (
        id: string,
        updates: Partial<EditableFields>
    ): Promise<void> => {
        const currentItem = this.recordsSignal.getValue().find((item) => item.id === id);

        if (!currentItem) {
            throw new Error(`ItemsSyncStore.updateItem(${id}) error: note not found`);
        }

        const modified_at = new Date().toISOString();
        const update_index = currentItem.update_index + 1;

        let nextItem: T | undefined;

        this.recordsSignal.dispatch(
            this.recordsSignal.getValue().map((item) => {
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

        await this.params.remoteStorage.updateItem(updatedLocalRow);
    };

    public readonly deleteItem = async (id: string): Promise<void> => {
        const pendingOptimisticCreate = this.pendingOptimisticCreatesById.get(id);
        const currentItem = this.recordsSignal.getValue().find((item) => item.id === id);

        this.pendingOptimisticCreatesById.delete(id);
        this.pendingOptimisticDeleteIds.add(id);
        this.recordsSignal.dispatch(this.recordsSignal.getValue().filter((item) => item.id !== id));

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

        await this.params.remoteStorage.updateItem(deletedRow);
    };
}
