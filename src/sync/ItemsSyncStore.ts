import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';

import { noop } from '../utils/noop';

import { pickNewerRow } from './pickNewerRow';
import { EditableFields } from './types';

export type SynchedItem = {
    id: string;
    created_at: string;
    modified_at: string;
    update_index: number;
    _deleted: boolean;
};

export type ItemOwnParams<T extends SynchedItem> = Omit<T, keyof SynchedItem>;

type ItemSyncRemoteStorage<T extends SynchedItem> = {
    readonly subscribe: (callback: (incomingItems: T[]) => void) => void;
    readonly subscribeError: (callback: (error: Error) => void) => void;
    readonly addItem: (item: T) => Promise<void>;
    readonly updateItem: (item: T) => Promise<void>;
};

type PendingOptimisticCreate<T extends SynchedItem> = {
    item: T;
    writePromise: Promise<void>;
};

export class ItemsSyncStore<T extends SynchedItem> {
    public readonly recordsSignal = new Signal<T[]>([], deepEqual);

    private readonly pendingOptimisticCreatesById = new Map<string, PendingOptimisticCreate<T>>();

    private pendingOptimisticDeleteIds = new Set<string>();

    public constructor(
        private readonly params: {
            remoteStorage: ItemSyncRemoteStorage<T>;
            showError: (message: string) => void;
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
            this.params.showError(error.message);
        });
    }

    public readonly addItem = (newItemParams: ItemOwnParams<T>): SynchedItem['id'] => {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        const internalParams: SynchedItem = {
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

        const writePromise = this.params.remoteStorage.addItem(localRow);

        this.pendingOptimisticCreatesById.set(id, {
            item: localRow,
            writePromise,
        });

        this.recordsSignal.dispatch([...this.recordsSignal.getValue(), localRow]);

        return id;
    };

    public readonly updateItem = (id: string, updates: Partial<EditableFields>): void => {
        const currentItem = this.recordsSignal.getValue().find((item) => item.id === id);

        if (!currentItem) {
            throw new Error(`ItemsSyncStore.updateItem(${id}) error: note not found`);
        }

        const modified_at = new Date().toISOString();
        const update_index = currentItem.update_index + 1;
        const nextItem = this.changeItemLocally(id, { ...updates, modified_at, update_index });

        if (!nextItem) {
            throw new Error(`ItemsSyncStore.updateItem(${id}) error: note not found`);
        }

        const updatedLocalRow: T = {
            ...nextItem,
            _deleted: false,
        };

        this.params.remoteStorage.updateItem(updatedLocalRow).catch((error) => {
            // TODO: do something with this error
            // eslint-disable-next-line no-console
            console.error(error);
        });
    };

    public readonly delete = async (id: string): Promise<void> => {
        const pendingOptimisticCreate = this.pendingOptimisticCreatesById.get(id);
        const currentItem = this.recordsSignal.getValue().find((item) => item.id === id);

        this.removeOptimisticItem(id);

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

        this.params.remoteStorage.updateItem(deletedRow).catch((error) => {
            // TODO: do something with this error
            // eslint-disable-next-line no-console
            console.error(error);
        });
    };

    private removeOptimisticItem(id: string): void {
        this.pendingOptimisticCreatesById.delete(id);
        this.pendingOptimisticDeleteIds.add(id);

        this.recordsSignal.dispatch(this.recordsSignal.getValue().filter((item) => item.id !== id));
    }

    private changeItemLocally(
        id: string,
        updates: Partial<EditableFields> & { modified_at: string; update_index: number }
    ): T | undefined {
        let nextItem: T | undefined;

        this.recordsSignal.dispatch(
            this.recordsSignal.getValue().map((item) => {
                if (item.id !== id) {
                    return item;
                }

                nextItem = {
                    ...item,
                    ...updates,
                };

                return nextItem;
            })
        );

        return nextItem;
    }
}
