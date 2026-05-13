import { SupabaseClient } from '@supabase/supabase-js';
import { RxSupabaseReplicationState } from 'rxdb/plugins/replication-supabase';
import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';
import { subscribeSignalAndCallWithCurrentValue } from 'senaev-utils/src/utils/Signal/subscribeSignalAndCallWithCurrentValue/subscribeSignalAndCallWithCurrentValue';

import { LocalDbFacade, LocalNoteItemRow } from '../localDb/LocalDbFacade';
import { startReplication } from '../localDb/replication';
import { NoteItemsTableLocal, toNoteItem } from '../tables/NoteItemsTableLocal';
import { NoteItem } from '../types/NoteItem';

import { SupabaseClientSignal } from './SupabaseController';

export class NoteItemsStore {
    public recordsSignal = new Signal<NoteItem[]>([], deepEqual);

    private replicationState: RxSupabaseReplicationState<LocalNoteItemRow> | undefined;

    public constructor(private readonly params: {
        localDbFacade: LocalDbFacade;
        noteItemsTable: NoteItemsTableLocal;
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
