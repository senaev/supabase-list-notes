import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';

import { NotesListTableLocal } from '../tables/NotesListTableLocal';

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
        showError: (message: string) => void;
    }) {
        this.params.notesListTableLocal
            .observeAll((items) => {
                this.recordsSignal.next(items);
            })
            .catch((error) => {
                this.params.showError(error.message);
            });
    }

    public async createNewNote(): Promise<NoteRecord> {
        const newNote = await this.params.notesListTableLocal.create({
            id: crypto.randomUUID(),
            title: '',
        });

        this.recordsSignal.next([
            // TODO: remove workaround after fixing items persistence
            ...this.recordsSignal.value()!,
            newNote,
        ]);

        return newNote;
    }

    public changeTitle(id: string, title: string): Promise<void> {
        const nextRecords = this.recordsSignal.value()!.map((item) => {
            if (item.id !== id) {
                return item;
            }

            return {
                ...item,
                title,
            };
        });

        this.recordsSignal.next(nextRecords);

        return this.params.notesListTableLocal.update(id, { title });
    }

    public async delete(id: string): Promise<void> {
        const { recordsSignal: items } = this;

        if (!items) {
            this.params.showError('Notes are not loaded yet');

            return;
        }

        try {
            this.recordsSignal.next(this.recordsSignal.value()!.filter((item) => item.id !== id));

            await this.params.notesListTableLocal.delete(id);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);

            this.params.showError(`Failed to delete note: ${message}`);
        }
    }
}
