import { SupabaseClient } from '@supabase/supabase-js';
import { RxSupabaseReplicationState } from 'rxdb/plugins/replication-supabase';
import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { combineSignalsIntoNewOne } from 'senaev-utils/src/utils/Signal/combineSignalsIntoNewOne/combineSignalsIntoNewOne';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';
import { subscribeSignalAndCallWithCurrentValue } from 'senaev-utils/src/utils/Signal/subscribeSignalAndCallWithCurrentValue/subscribeSignalAndCallWithCurrentValue';

import { SplitCommaAndTrim } from '../utils/SplitCommaAndTrim';
import { SupabaseClientSignal } from '../controllers/SupabaseController';
import { getTypesByPopularity } from '../utils/getTypesByPopularity';

import { LocalDbFacade, LocalItemRow } from './localDb';
import { EditableFields, Item } from './types';
import { startReplication } from './replication';

export type NoteRecord = {
    id: string;
    title: string;
    type: string;
    checked_at: string | null;
    created_at: string;
    modified_at: string;
};

const _TABLE_COLUMNS = 'id, title, type, checked_at, created_at, modified_at';

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
    };
}

function getModifiedAtTime(item: { modified_at: string }): number {
    return Date.parse(item.modified_at);
}

export class ItemsSyncStore {
    public readonly recordsSignal = new Signal<Item[]>([], deepEqual);

    public readonly typesByPopularitySignal = combineSignalsIntoNewOne(
        [this.recordsSignal],
        getTypesByPopularity,
        deepEqual
    ).signal;

    private replicationState: RxSupabaseReplicationState<LocalItemRow> | undefined;

    // Creates that have been applied to recordsSignal but whose write to
    // the local DB may not have committed/echoed back through observeAll
    // yet. Kept alive across observeAll runs so the optimistic item isn't
    // dropped from the signal before the DB confirms it.
    private readonly pendingOptimisticCreatesById = new Map<string, PendingOptimisticCreate>();

    // Ids removed from recordsSignal optimistically but not yet confirmed
    // gone from the DB - used to keep a slow/late observeAll echo for the
    // old (pre-delete) row from resurrecting it in the signal.
    private pendingOptimisticDeleteIds = new Set<string>();

    public constructor(
        private readonly params: {
            localDbFacade: LocalDbFacade;
            supabaseControllerClientSignal: SupabaseClientSignal;
            showError: (message: string) => void;
        }
    ) {
        this.params.localDbFacade.notes_temp
            .observeAll((incomingRecords) => {
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

                    if (
                        currentItem &&
                        getModifiedAtTime(currentItem) > getModifiedAtTime(incomingItem)
                    ) {
                        return currentItem;
                    }

                    return incomingItem;
                });

                for (const pendingOptimisticCreate of this.pendingOptimisticCreatesById.values()) {
                    nextState.push(pendingOptimisticCreate.item);
                }

                this.recordsSignal.dispatch(nextState);
            })
            .catch((error) => {
                this.params.showError(error.message);
            });

        subscribeSignalAndCallWithCurrentValue(
            this.params.supabaseControllerClientSignal,
            this.startReplicationWithClient
        );
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
            _deleted: false,
        };

        const optimisticItem = toItem(localRow);
        const writePromise = this.params.localDbFacade.notes_temp.put(localRow);

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

        this.removeOptimisticItem(id);

        if (pendingOptimisticCreate) {
            await pendingOptimisticCreate.writePromise.catch(() => undefined);
        }

        await this.params.localDbFacade.notes_temp.remove(id);
    };

    private removeOptimisticItem(id: string): void {
        this.pendingOptimisticCreatesById.delete(id);
        this.pendingOptimisticDeleteIds.add(id);

        this.recordsSignal.dispatch(this.recordsSignal.getValue().filter((item) => item.id !== id));
    }

    private changeItemLocally(
        id: string,
        updates: Partial<EditableFields> & { modified_at: string }
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
        const modified_at = new Date().toISOString();
        const nextItem = this.changeItemLocally(id, { ...updates, modified_at });

        if (!nextItem) {
            throw new Error(`ItemsSyncStore.updateItem(${id}) error: note not found`);
        }

        const updatedLocalRow: LocalItemRow = {
            ...nextItem,
            _deleted: false,
        };

        await this.params.localDbFacade.notes_temp.put(updatedLocalRow);
    }

    private readonly startReplicationWithClient = (client: SupabaseClient | undefined): void => {
        if (this.replicationState) {
            this.replicationState.remove();
        }

        if (client === undefined) {
            this.replicationState = undefined;

            return;
        }

        this.replicationState = startReplication({
            collectionName: 'items',
            supabase: client,
            localDbFacade: this.params.localDbFacade,
            onError: (_error) => {},
            onActiveChange: (_isActive) => {},
            onReceived: (_record) => {},
            onSent: (_record) => {},
        });
    };
}
