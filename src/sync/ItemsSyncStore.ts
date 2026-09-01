import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';

import { SplitCommaAndTrim } from '../utils/SplitCommaAndTrim';

import { LocalItemRow } from './localDb';
import { pickNewerRow } from './pickNewerRow';
import { EditableFields, Item } from './types';

type ItemSyncRemoteStorage<T extends { id: string }> = {
    readonly subscribe: (callback: (incomingItems: T[]) => void) => void;
    readonly subscribeError: (callback: (error: Error) => void) => void;
    readonly addItem: (item: T) => Promise<void>;
    readonly updateItem: (item: T) => Promise<void>;
};

export type NoteRecord = {
    id: string;
    title: string;
    type: string;
    checked_at: string | null;
    created_at: string;
    modified_at: string;
    update_index: number;
};

const _TABLE_COLUMNS = 'id, title, type, checked_at, created_at, modified_at, update_index';

type TableColumns = SplitCommaAndTrim<typeof _TABLE_COLUMNS>;

type PendingOptimisticCreate = {
    item: Item;
    writePromise: Promise<void>;
};

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

export class ItemsSyncStore {
    public readonly recordsSignal = new Signal<Item[]>([], deepEqual);

    private readonly pendingOptimisticCreatesById = new Map<string, PendingOptimisticCreate>();

    private pendingOptimisticDeleteIds = new Set<string>();

    public constructor(
        private readonly params: {
            remoteStorage: ItemSyncRemoteStorage<LocalItemRow>;
            showError: (message: string) => void;
        }
    ) {
        this.params.remoteStorage.subscribe((incomingRecords) => {
            const allIncomingItems = incomingRecords.map(toItem);
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

    public async createNewNote({ type }: { type: string }): Promise<NoteRecord> {
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
    }: Pick<Item, 'id' | 'title' | 'type'>): Promise<Pick<NoteRecord, TableColumns>> => {
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

        const optimisticItem = toItem(localRow);
        const writePromise = this.params.remoteStorage.addItem(localRow);

        this.pendingOptimisticCreatesById.set(id, {
            item: optimisticItem,
            writePromise,
        });

        this.recordsSignal.dispatch([...this.recordsSignal.getValue(), optimisticItem]);

        await writePromise;

        return optimisticItem;
    };

    public readonly updateItem = (id: string, updates: Partial<EditableFields>): Promise<void> =>
        this.persistItem(id, updates);

    public readonly delete = async (id: string): Promise<void> => {
        const pendingOptimisticCreate = this.pendingOptimisticCreatesById.get(id);
        const currentItem = this.recordsSignal.getValue().find((item) => item.id === id);

        this.removeOptimisticItem(id);

        if (pendingOptimisticCreate) {
            await pendingOptimisticCreate.writePromise.catch(() => undefined);
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
        let nextItem: Item | undefined;

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
