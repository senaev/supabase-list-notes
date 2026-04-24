import { SupabaseClient } from '@supabase/supabase-js';
import { RxSupabaseReplicationState } from 'rxdb/plugins/replication-supabase';
import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';
import { subscribeSignalAndCallWithCurrentValue } from 'senaev-utils/src/utils/Signal/subscribeSignalAndCallWithCurrentValue/subscribeSignalAndCallWithCurrentValue';

import { LocalNoteRow } from '../localDb/LocalDbFacade';
import { startReplication } from '../localDb/replication';
import { NotesListTableLocal } from '../tables/NotesListTableLocal';

import { SupabaseClientSignal } from './SupabaseController';

export type NoteRecord = {
    id: string;
    title: string;
    created_at: string;
    modified_at: string;
};

export class NotesList {
    public readonly recordsSignal = new Signal<NoteRecord[] | undefined>(undefined, deepEqual);

    private replicationState: RxSupabaseReplicationState<LocalNoteRow> | undefined;

    public constructor(private readonly params: {
        notesListTableLocal: NotesListTableLocal;
        supabaseControllerClientSignal: SupabaseClientSignal;
        showError: (message: string) => void;
    }) {
        this.params.notesListTableLocal
            .observeAll((items) => {
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
        const newNote = await this.params.notesListTableLocal.create({
            id: crypto.randomUUID(),
            title: '',
        });

        this.recordsSignal.dispatch([
            // TODO: remove workaround after fixing items persistence
            ...this.recordsSignal.getValue()!,
            newNote,
        ]);

        return newNote;
    }

    public changeTitle(id: string, title: string): Promise<void> {
        const nextRecords = this.recordsSignal.getValue()!.map((item) => {
            if (item.id !== id) {
                return item;
            }

            return {
                ...item,
                title,
            };
        });

        this.recordsSignal.dispatch(nextRecords);

        return this.params.notesListTableLocal.update(id, { title });
    }

    public async delete(id: string): Promise<void> {
        const { recordsSignal } = this;

        if (!recordsSignal) {
            this.params.showError('Notes are not loaded yet');

            return;
        }

        try {
            this.recordsSignal.dispatch(this.recordsSignal.getValue()!.filter((item) => item.id !== id));

            await this.params.notesListTableLocal.delete(id);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);

            this.params.showError(`Failed to delete note: ${message}`);
        }
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
            localDbFacade: this.params.notesListTableLocal.localDbFacade,
            onError: (error) => {
                // eslint-disable-next-line no-console
                console.error('notes replication error', error);
            },
            onActiveChange: (isActive) => {
                // eslint-disable-next-line no-console
                console.log('Replication active=', isActive);
            },
            onReceived: (record) => {
                // eslint-disable-next-line no-console
                console.log('Received record:', record);
            },
            onSent: (record) => {
                // eslint-disable-next-line no-console
                console.log('Sent record:', record);
            },
        });

        // eslint-disable-next-line no-console
        console.log(replicationState);
    };
}
