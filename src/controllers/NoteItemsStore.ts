import { SupabaseClient } from '@supabase/supabase-js';
import { RxSupabaseReplicationState } from 'rxdb/plugins/replication-supabase';
import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';
import { subscribeSignalAndCallWithCurrentValue } from 'senaev-utils/src/utils/Signal/subscribeSignalAndCallWithCurrentValue/subscribeSignalAndCallWithCurrentValue';

import { LocalDbFacade, LocalNoteItemRow } from '../localDb/LocalDbFacade';
import { startReplication } from '../localDb/replication';
import { NoteItem } from '../types/NoteItem';
import { SplitCommaAndTrim } from '../utils/SplitCommaAndTrim';

import { SupabaseClientSignal } from './SupabaseController';

const _TABLE_COLUMNS = 'id, note_id, is_child, title, position, created_at, updated_at, _modified, completed_at';

type TableColumns = SplitCommaAndTrim<typeof _TABLE_COLUMNS>;

function toNoteItem(row: LocalNoteItemRow): Pick<NoteItem, TableColumns> {
    return {
        id: row.id,
        note_id: row.note_id,
        is_child: row.is_child,
        title: row.title,
        position: row.position,
        created_at: row.created_at,
        updated_at: row.updated_at,
        _modified: row._modified,
        completed_at: row.completed_at,
    };
}

export class NoteItemsStore {
    public recordsSignal = new Signal<NoteItem[]>([], deepEqual);

    private replicationState: RxSupabaseReplicationState<LocalNoteItemRow> | undefined;

    public constructor(private readonly params: {
        localDbFacade: LocalDbFacade;
        supabaseControllerClientSignal: SupabaseClientSignal;
        showError: (message: string) => void;
    }) {
        this.params.localDbFacade.note_items_temp.observeAll((records) => {
            const items = records
                .sort((first, second) => first.position - second.position)
                .map(toNoteItem);

            this.recordsSignal.dispatch(items);
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
    }: Pick<
        NoteItem,
    'id' | 'note_id' | 'title' | 'position' | 'completed_at' | 'is_child'
    >): Promise<Pick<NoteItem, TableColumns>> {
        const now = new Date().toISOString();
        const localRow: LocalNoteItemRow = {
            id,
            note_id,
            title,
            position,
            completed_at,
            is_child,
            created_at: now,
            updated_at: now,
            _modified: now,
        };

        await this.params.localDbFacade.note_items_temp.put(localRow);

        return toNoteItem(localRow);
    }

    public async updateNoteItem(
        itemId: string,
        updates: Partial<
            Pick<NoteItem, 'title' | 'position' | 'completed_at' | 'is_child'>
        >
    ): Promise<Pick<NoteItem, 'updated_at' | '_modified'>> {
        const localRow = await this.params.localDbFacade.note_items_temp.get(itemId);

        if (!localRow) {
            throw new Error(`NoteItemsTable.update(${itemId}) error: note item not found`);
        }

        const now = new Date().toISOString();

        await this.params.localDbFacade.note_items_temp.put({
            ...localRow,
            ...updates,
            updated_at: now,
            _modified: now,
        });

        return {
            updated_at: now,
            _modified: now,
        };
    }

    public async setNoteItemCompleted(
        itemId: string,
        checked: boolean
    ): Promise<Pick<NoteItem, 'completed_at' | 'updated_at' | '_modified'>> {
        const localRow = await this.params.localDbFacade.note_items_temp.get(itemId);

        if (!localRow) {
            throw new Error(`NoteItemsTable.setCompleted(${itemId}) error: note item not found`);
        }

        const now = new Date().toISOString();
        const completed_at = checked ? now : null;

        await this.params.localDbFacade.note_items_temp.put({
            ...localRow,
            completed_at,
            updated_at: now,
            _modified: now,
        });

        return {
            completed_at,
            updated_at: now,
            _modified: now,
        };
    }

    public async deleteNoteItem(itemId: string): Promise<void> {
        await this.params.localDbFacade.note_items_temp.remove(itemId);
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
            onError: (_error) => {
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
