import { SupabaseClient } from '@supabase/supabase-js';
import { RxSupabaseReplicationState } from 'rxdb/plugins/replication-supabase';
import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';
import { subscribeSignalAndCallWithCurrentValue } from 'senaev-utils/src/utils/Signal/subscribeSignalAndCallWithCurrentValue/subscribeSignalAndCallWithCurrentValue';

import { LocalDbFacade, LocalNoteItemRow } from '../localDb/LocalDbFacade';
import { startReplication } from '../localDb/replication';
import { NoteItem, NoteItemId } from '../types/NoteItem';
import { SplitCommaAndTrim } from '../utils/SplitCommaAndTrim';
import { getUpdatedAtTime } from '../utils/getUpdatedAtTime';

import { SupabaseClientSignal } from './SupabaseController';

const _TABLE_COLUMNS = 'id, note_id, is_child, title, position, created_at, updated_at, _modified, completed_at';

type TableColumns = SplitCommaAndTrim<typeof _TABLE_COLUMNS>;

export type NoteItemCreateParams = Pick<
    NoteItem,
    'id' | 'note_id' | 'title' | 'position' | 'completed_at' | 'is_child'
>;

type PendingOptimisticCreate = {
    item: NoteItem;
    writePromise: Promise<void>;
};

function toNoteItem(row: LocalNoteItemRow): Pick<NoteItem, TableColumns> {
    return {
        id: row.id,
        note_id: row.note_id,
        is_child: row.is_child,
        title: row.title,
        position: row.position,
        created_at: row.created_at,
        updated_at: row.updated_at,
        completed_at: row.completed_at,
        _modified: row._modified,
    };
}

export class NoteItemsStore {
    public recordsSignal = new Signal<NoteItem[]>([], deepEqual);

    private replicationState: RxSupabaseReplicationState<LocalNoteItemRow> | undefined;

    private readonly pendingOptimisticCreatesById = new Map<NoteItemId, PendingOptimisticCreate>();
    private pendingOptimisticDeleteIds = new Set<NoteItemId>();

    public constructor(private readonly params: {
        localDbFacade: LocalDbFacade;
        supabaseControllerClientSignal: SupabaseClientSignal;
        showError: (message: string) => void;
    }) {
        this.params.localDbFacade.note_items_temp.observeAll((incomingRecords) => {
            const allIncomingItems = incomingRecords.map(toNoteItem);
            const incomingIds = new Set(allIncomingItems.map((item) => item.id));
            const incomingItems = allIncomingItems
                .filter((item) => !this.pendingOptimisticDeleteIds.has(item.id));

            this.pendingOptimisticDeleteIds = this.pendingOptimisticDeleteIds.intersection(incomingIds);

            const currentById = new Map(this.recordsSignal.getValue().map((item) => [
                item.id,
                item,
            ]));

            const nextState = incomingItems.map((incomingItem) => {
                this.pendingOptimisticCreatesById.delete(incomingItem.id);

                const currentItem = currentById.get(incomingItem.id);

                if (
                    currentItem && getUpdatedAtTime(currentItem) > getUpdatedAtTime(incomingItem)
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

    public async createNoteItem({
        id,
        note_id,
        title,
        position,
        completed_at,
        is_child,
    }: NoteItemCreateParams): Promise<Pick<NoteItem, TableColumns>> {
        const nowString = new Date().toISOString();

        const localRow: LocalNoteItemRow = {
            id,
            note_id,
            title,
            position,
            completed_at,
            is_child,
            created_at: nowString,
            updated_at: nowString,
            _modified: nowString,
            _deleted: false,
        };

        const optimisticItem = toNoteItem(localRow);
        const writePromise = this.params.localDbFacade.note_items_temp.put(localRow);

        this.pendingOptimisticCreatesById.set(optimisticItem.id, {
            item: optimisticItem,
            writePromise,
        });

        this.recordsSignal.dispatch([
            ...this.recordsSignal.getValue(),
            optimisticItem,
        ]);

        await writePromise;

        return toNoteItem(localRow);
    }

    public async updateNoteItem(
        now: Date,
        nextState: LocalNoteItemRow
    ): Promise<void> {
        const nowString = now.toISOString();

        await this.params.localDbFacade.note_items_temp.put({
            ...nextState,
            updated_at: nowString,
            _modified: nowString,
        });
    }

    public async deleteNoteItem(itemId: string): Promise<void> {
        const pendingOptimisticCreate = this.pendingOptimisticCreatesById.get(itemId);

        this.removeOptimisticNoteItem(itemId);

        if (pendingOptimisticCreate) {
            await pendingOptimisticCreate.writePromise.catch(() => undefined);
        }

        await this.params.localDbFacade.note_items_temp.remove(itemId);
    }

    private removeOptimisticNoteItem(itemId: NoteItemId): void {
        this.pendingOptimisticCreatesById.delete(itemId);
        this.pendingOptimisticDeleteIds.add(itemId);

        this.recordsSignal.dispatch(this.recordsSignal.getValue().filter((item) => item.id !== itemId));
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
            collectionName: 'note_items_temp',
            supabase: client,
            localDbFacade: this.params.localDbFacade,
            onError: (error) => {
                // eslint-disable-next-line no-console
                console.error('Replication error: ', error);
            },
            onActiveChange: (_isActive) => {
            },
            onReceived: (_record) => {
            },
            onSent: (_record) => {
            },
        });
    };
}
