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

export class ItemsSyncStore {
    public readonly recordsSignal = new Signal<Item[]>([], deepEqual);

    // Derived from recordsSignal (see getTypesByPopularity) so every
    // consumer - the top nav pills, the per-item type picker - reads the
    // same already-sorted list and recomputes it exactly once whenever the
    // records change, instead of each component re-sorting on its own with
    // useMemo. Never torn down: this store lives for the whole app session,
    // same as recordsSignal itself.
    public readonly typesByPopularitySignal = combineSignalsIntoNewOne(
        [this.recordsSignal],
        getTypesByPopularity,
        deepEqual
    ).signal;

    private replicationState: RxSupabaseReplicationState<LocalItemRow> | undefined;

    public constructor(
        private readonly params: {
            localDbFacade: LocalDbFacade;
            supabaseControllerClientSignal: SupabaseClientSignal;
            showError: (message: string) => void;
        }
    ) {
        this.params.localDbFacade.notes_temp
            .observeAll((records) => {
                const items = records.map(toItem);

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

    public async createNewNote({ type }: { type: string }): Promise<NoteRecord> {
        const newNote = await this.addItem({
            id: crypto.randomUUID(),
            title: '',
            type,
        });

        return newNote;
    }

    public readonly updateItem = async (
        id: string,
        updates: Partial<EditableFields>
    ): Promise<void> => {
        await this.updateNote(id, updates);
    };

    public readonly delete = async (id: string): Promise<void> => {
        await this.params.localDbFacade.notes_temp.remove(id);
    };

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

        await this.params.localDbFacade.notes_temp.put(localRow);

        return toItem(localRow);
    };

    private async updateNote(id: string, updates: Partial<EditableFields>): Promise<void> {
        const localRow = await this.params.localDbFacade.notes_temp.get(id);

        if (!localRow) {
            throw new Error(`NotesListTable.update(${id}) error: note not found`);
        }

        const now = new Date().toISOString();
        const updatedLocalRow: LocalItemRow = {
            ...localRow,
            ...updates,
            modified_at: now,
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
