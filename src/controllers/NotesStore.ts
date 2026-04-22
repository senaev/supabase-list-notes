import { Subscription } from 'rxjs';

import { NotesListTable } from '../tables/NotesListTable';

import { NoteRecord } from './NotesList';

type Listener = () => void;

export class NotesStore {
    private items: NoteRecord[] = [];
    private listeners = new Set<Listener>();
    private subscription: Subscription | null = null;
    private observePromise: Promise<void> | null = null;

    public constructor(private readonly params: {
        notesListTable: NotesListTable;
        showError: (message: string) => void;
    }) {}

    public connect(): void {
        if (this.subscription || this.observePromise) {
            return;
        }

        this.observePromise = this.params.notesListTable
            .observeAll((items) => {
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

    public getItems(): NoteRecord[] {
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
