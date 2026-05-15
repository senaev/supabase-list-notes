import { SupabaseClient } from '@supabase/supabase-js';
import { RxSupabaseReplicationState } from 'rxdb/plugins/replication-supabase';
import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';
import { subscribeSignalAndCallWithCurrentValue } from 'senaev-utils/src/utils/Signal/subscribeSignalAndCallWithCurrentValue/subscribeSignalAndCallWithCurrentValue';

import { LocalDbFacade, LocalNoteRow } from '../localDb/LocalDbFacade';
import { startReplication } from '../localDb/replication';
import { SplitCommaAndTrim } from '../utils/SplitCommaAndTrim';

import { SupabaseClientSignal } from './SupabaseController';

export type NoteRecord = {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    _modified: string;
};

const _TABLE_COLUMNS = 'id, title, created_at, updated_at, _modified';

type TableColumns = SplitCommaAndTrim<typeof _TABLE_COLUMNS>;

function toNoteRecord(row: LocalNoteRow): Pick<NoteRecord, TableColumns> {
    return {
        id: row.id,
        title: row.title,
        created_at: row.created_at,
        updated_at: row.updated_at,
        _modified: row._modified,
    };
}

export class NotesListStore {
    public readonly recordsSignal = new Signal<NoteRecord[] | undefined>(undefined, deepEqual);

    private replicationState: RxSupabaseReplicationState<LocalNoteRow> | undefined;

    public constructor(private readonly params: {
        localDbFacade: LocalDbFacade;
        supabaseControllerClientSignal: SupabaseClientSignal;
        showError: (message: string) => void;
    }) {
        this.params.localDbFacade.notes_temp
            .observeAll((records) => {
                const items = records.map(toNoteRecord);

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

    public async createNewNote(): Promise<NoteRecord> {
        const newNote = await this.createNote({
            id: crypto.randomUUID(),
            title: '',
        });

        return newNote;
    }

    public async changeTitle(id: string, title: string): Promise<void> {
        await this.updateNote(id, { title });
    }

    public async delete(id: string): Promise<void> {
        await this.params.localDbFacade.notes_temp.remove(id);
    }

    public async createNote({
        id,
    title,
    }: {
        id: string;
        title: string;
    }): Promise<Pick<NoteRecord, TableColumns>> {
        const now = new Date().toISOString();
        const localRow: LocalNoteRow = {
            id,
            title,
            created_at: now,
            updated_at: now,
            _modified: now,
            _deleted: false,
        };

        await this.params.localDbFacade.notes_temp.put(localRow);

        return toNoteRecord(localRow);
    }

    private async updateNote(
        id: string,
        updates: {
            title?: string;
        }
    ): Promise<void> {
        const localRow = await this.params.localDbFacade.notes_temp.get(id);

        if (!localRow) {
            throw new Error(`NotesListTable.update(${id}) error: note not found`);
        }

        const now = new Date().toISOString();
        const updatedLocalRow: LocalNoteRow = {
            ...localRow,
            ...updates,
            updated_at: now,
            _modified: now,
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
            collectionName: 'notes_temp',
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
