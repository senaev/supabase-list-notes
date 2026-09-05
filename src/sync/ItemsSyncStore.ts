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
    readonly subscribeUpdates: (callback: (incomingItems: T[]) => void) => void;
    readonly onSubscribeError: (callback: (error: Error) => void) => void;
    readonly create: (item: T) => Promise<void>;
    readonly update: (item: T) => Promise<void>;
    readonly onAsyncStoreError: (message: string) => void;
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

    public constructor(private readonly remoteStorage: AsyncStore<T>) {
        this.remoteStorage.subscribeUpdates((allIncomingItems) => {
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

        this.remoteStorage.onSubscribeError((error: Error) => {
            this.remoteStorage.onAsyncStoreError(error.message);
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

        const writePromise = this.remoteStorage.create(localRow);

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

        await this.remoteStorage.update(updatedLocalRow);
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

        await this.remoteStorage.update(deletedRow);
    };
}
