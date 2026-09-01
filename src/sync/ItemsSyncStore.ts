import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';

import { noop } from '../utils/noop';

import { LocalItemRow } from './localDb';
import { pickNewerRow } from './pickNewerRow';
import { EditableFields, Item } from './types';

type ItemSyncRemoteStorage<T extends { id: string }> = {
    readonly subscribe: (callback: (incomingItems: T[]) => void) => void;
    readonly subscribeError: (callback: (error: Error) => void) => void;
    readonly addItem: (item: T) => Promise<void>;
    readonly updateItem: (item: T) => Promise<void>;
};

type PendingOptimisticCreate = {
    item: LocalItemRow;
    writePromise: Promise<void>;
};

export class ItemsSyncStore {
    public readonly recordsSignal = new Signal<LocalItemRow[]>([], deepEqual);

    private readonly pendingOptimisticCreatesById = new Map<string, PendingOptimisticCreate>();

    private pendingOptimisticDeleteIds = new Set<string>();

    public constructor(
        private readonly params: {
            remoteStorage: ItemSyncRemoteStorage<LocalItemRow>;
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

    public async createNewNote({ type }: { type: string }): Promise<LocalItemRow> {
        const newNote = await this.addItem({
            id: crypto.randomUUID(),
            title: '',
            type,
        });

        return newNote;
    }

    public readonly addItem = async ({
        id,
        title,
        type,
    }: Pick<Item, 'id' | 'title' | 'type'>): Promise<LocalItemRow> => {
        const now = new Date().toISOString();
        const localRow: LocalItemRow = {
            id,
            title,
            type,
            created_at: now,
            checked_at: null,
            modified_at: now,
            update_index: 0,
            _deleted: false,
        };

        const writePromise = this.params.remoteStorage.addItem(localRow);

        this.pendingOptimisticCreatesById.set(id, {
            item: localRow,
            writePromise,
        });

        this.recordsSignal.dispatch([...this.recordsSignal.getValue(), localRow]);

        await writePromise;

        return localRow;
    };

    public readonly updateItem = (id: string, updates: Partial<EditableFields>): Promise<void> =>
        this.persistItem(id, updates);

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

        const deletedRow: LocalItemRow = {
            ...currentItem,
            modified_at: new Date().toISOString(),
            update_index: currentItem.update_index + 1,
            _deleted: true,
        };

        await this.params.remoteStorage.updateItem(deletedRow);
    };

    private removeOptimisticItem(id: string): void {
        this.pendingOptimisticCreatesById.delete(id);
        this.pendingOptimisticDeleteIds.add(id);

        this.recordsSignal.dispatch(this.recordsSignal.getValue().filter((item) => item.id !== id));
    }

    private changeItemLocally(
        id: string,
        updates: Partial<EditableFields> & { modified_at: string; update_index: number }
    ): Item | undefined {
        let nextItem: LocalItemRow | undefined;

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

    private async persistItem(id: string, updates: Partial<EditableFields>): Promise<void> {
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

        const updatedLocalRow: LocalItemRow = {
            ...nextItem,
            _deleted: false,
        };

        await this.params.remoteStorage.updateItem(updatedLocalRow);
    }
}
