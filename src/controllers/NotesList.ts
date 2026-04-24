import { SupabaseClient } from '@supabase/supabase-js';
import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';
import { subscribeSignalAndCallWithCurrentValue } from 'senaev-utils/src/utils/Signal/subscribeSignalAndCallWithCurrentValue/subscribeSignalAndCallWithCurrentValue';

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
        if (client === undefined) {
            // TODO: remove side effects
            return;
        }

        const replicationState = startReplication({
            collectionName: 'notes_temp',
            supabase: client,
            localDbFacade: this.params.notesListTableLocal.localDbFacade,
        });

        // eslint-disable-next-line no-console
        console.log(replicationState);
    };
}
