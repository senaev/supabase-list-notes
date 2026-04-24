import { SupabaseClient } from '@supabase/supabase-js';
import React, {
    PropsWithChildren,
    useContext,
    useEffect,
    useRef,
} from 'react';
import { Subscription } from 'rxjs';
import { noop } from 'senaev-utils/src/utils/Function/noop';

import { NoteItemsStore } from '../controllers/NoteItemsStore';
import { ensureReplicationReady } from '../localDb/replication';
import { NoteItemsTableLocal } from '../tables/NoteItemsTableLocal';

import { useLocalDbFacade } from './LocalDbFacadeContext';
import { useSupabaseControllerStatus } from './SupabaseControllerContext';

export type TablesContextType = {
    noteItemsTableLocal: NoteItemsTableLocal;
    noteItemsStore: NoteItemsStore;
};

export const TablesContext = React.createContext<TablesContextType | null>(null);
TablesContext.displayName = 'TablesContext';

export const TablesContextProvider = ({
    children,
    showError,
}: PropsWithChildren & {
    showError: (message: string) => void;
}) => {
    const tablesRef = useRef<TablesContextType | null>(null);

    const { clientSignal: clientReadyLatch } = useSupabaseControllerStatus();
    const supabaseClient: SupabaseClient | undefined = clientReadyLatch.value();

    const localDbFacade = useLocalDbFacade();

    if (!tablesRef.current) {
        const noteItemsTableLocal = new NoteItemsTableLocal(localDbFacade);

        tablesRef.current = {
            noteItemsTableLocal,
            noteItemsStore: new NoteItemsStore({
                noteItemsTable: noteItemsTableLocal,
                showError,
            }),
        };
    }

    const tables = tablesRef.current;

    useEffect(() => {
        tables.noteItemsStore.connect();

        return () => {
            tables.noteItemsStore.dispose();
        };
    }, [tables]);

    useEffect(() => {
        if (!supabaseClient) {
            return noop;
        }

        let cancelled = false;
        const subscriptions: Subscription[] = [];
        let latestError: string | undefined;
        const activeByName = {
            notes: false,
            noteItems: false,
        };

        const publish = () => {
            if (cancelled) {
                return;
            }

            if (latestError) {
                // TODO: handle errors more gracefully

                return;
            }

            const isSyncing = Object.values(activeByName).some(Boolean);
        };

        ensureReplicationReady(supabaseClient, localDbFacade)
            .then(({ notes, noteItems }) => {
                if (cancelled) {
                    return;
                }

                subscriptions.push(
                    notes.active$.subscribe((active) => {
                        activeByName.notes = active;
                        publish();
                    }),
                    noteItems.active$.subscribe((active) => {
                        activeByName.noteItems = active;
                        publish();
                    }),
                    notes.error$.subscribe((error) => {
                        latestError = error.message;
                        publish();
                    }),
                    noteItems.error$.subscribe((error) => {
                        latestError = error.message;
                        publish();
                    })
                );

                publish();
            })
            .catch((error) => {

                // TODO: handle errors more gracefully
            });

        return () => {
            cancelled = true;
            subscriptions.forEach((subscription) => {
                subscription.unsubscribe();
            });
        };
    }, [supabaseClient]);

    return <TablesContext.Provider value={tables}>
        {children}
    </TablesContext.Provider>;
};

export const useTablesContext = (): TablesContextType => {
    const context = useContext(TablesContext);

    if (!context) {
        throw new Error('useTablesContext must be used within a TablesProvider');
    }

    return context;
};
