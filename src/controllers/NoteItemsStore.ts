import { Subscription } from 'rxjs';

import { NoteItemsTable } from '../tables/NoteItemsTable';
import { NoteItem } from '../types/NoteItem';

type Listener = () => void;

export class NoteItemsStore {
    private items: NoteItem[] = [];
    private listeners = new Set<Listener>();
    private subscription: Subscription | null = null;
    private observePromise: Promise<void> | null = null;

    public constructor(private readonly params: {
        noteItemsTable: NoteItemsTable;
        showError: (message: string) => void;
    }) {}

    public connect(): void {
        if (this.subscription || this.observePromise) {
            return;
        }

        this.observePromise = this.params.noteItemsTable
            .observeAllNotes((items) => {
                this.items = items;
                this.emitChange();
            })
            .then((subscription) => {
                this.subscription = subscription;
            })
            .catch((error) => {
                this.params.showError(error.message);
            })
            .finally(() => {
                this.observePromise = null;
            });
    }

    public dispose(): void {
        this.subscription?.unsubscribe();
        this.subscription = null;
        this.observePromise = null;
        this.listeners.clear();
    }

    public getItems(noteId: string): NoteItem[] {
        return this.items.filter((item) => item.note_id === noteId);
    }

    public getAllItems(): NoteItem[] {
        return this.items;
    }

    public subscribe(listener: Listener): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    private emitChange(): void {
        this.listeners.forEach((listener) => {
            listener();
        });
    }
}
