import { SupabaseClient } from '@supabase/supabase-js';
import { RxSupabaseReplicationState } from 'rxdb/plugins/replication-supabase';
import { Subscription } from 'rxjs';
import { subscribeSignalAndCallWithCurrentValue } from 'senaev-utils/src/utils/Signal/subscribeSignalAndCallWithCurrentValue/subscribeSignalAndCallWithCurrentValue';

import { LocalDbFacade, LocalNoteItemRow } from '../localDb/LocalDbFacade';
import { startReplication } from '../localDb/replication';
import { NoteItemsTableLocal } from '../tables/NoteItemsTableLocal';
import { NoteItem } from '../types/NoteItem';

import { SupabaseClientSignal } from './SupabaseController';

type Listener = () => void;

export class NoteItemsStore {
    private items: NoteItem[] = [];
    private listeners = new Set<Listener>();
    private subscription: Subscription | null = null;
    private observePromise: Promise<void> | null = null;
    private replicationState: RxSupabaseReplicationState<LocalNoteItemRow> | undefined;

    public constructor(private readonly params: {
        localDbFacade: LocalDbFacade;
        noteItemsTable: NoteItemsTableLocal;
        supabaseControllerClientSignal: SupabaseClientSignal;
        showError: (message: string) => void;
    }) {
        subscribeSignalAndCallWithCurrentValue(
            this.params.supabaseControllerClientSignal,
            this.startReplicationWithClient
        );
    }

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
