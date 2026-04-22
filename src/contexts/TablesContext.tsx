import { SupabaseClient } from '@supabase/supabase-js';
import React, {
    PropsWithChildren,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import { Subscription } from 'rxjs';
import { noop } from 'senaev-utils/src/utils/Function/noop';

import { ReplicationStatus } from '../components/ReplicationStatusIndicator/ReplicationStatusIndicator';
import { NoteItemsStore } from '../controllers/NoteItemsStore';
import { NotesStore } from '../controllers/NotesStore';
import { LocalDbFacade } from '../localDb/LocalDbFacade';
import { ensureReplicationReady } from '../localDb/replication';
import { NoteItemsTable } from '../tables/NoteItemsTable';
import { NotesListTable } from '../tables/NotesListTable';

export type TablesContextType = {
    notesListTable: NotesListTable;
    noteItemsTable: NoteItemsTable;
    notesStore: NotesStore;
    noteItemsStore: NoteItemsStore;
    replicationStatus: ReplicationStatus;
};

export const TablesContext = React.createContext<TablesContextType | null>(null);
TablesContext.displayName = 'TablesContext';

export const TablesContextProvider = ({
    children,
    localDbFacade,
    supabaseClient,
    showError,
}: PropsWithChildren & {
    localDbFacade: LocalDbFacade;
    supabaseClient?: SupabaseClient;
    showError: (message: string) => void;
}) => {
    const [
        replicationStatus,
        setReplicationStatus,
    ] = useState<ReplicationStatus>({
        state: 'initializing',
    });
    const tablesRef = useRef<TablesContextType | null>(null);

    if (!tablesRef.current) {
        const notesListTable = new NotesListTable(localDbFacade, supabaseClient);
        const noteItemsTable = new NoteItemsTable(localDbFacade, supabaseClient);

        tablesRef.current = {
            notesListTable,
            noteItemsTable,
            notesStore: new NotesStore({
                notesListTable,
                showError,
            }),
            noteItemsStore: new NoteItemsStore({
                noteItemsTable,
                showError,
            }),
            replicationStatus,
        };
    }

    const tables = tablesRef.current;

    tables.replicationStatus = replicationStatus;

    useEffect(() => {
        tables.notesStore.connect();
        tables.noteItemsStore.connect();

        return () => {
            tables.notesStore.dispose();
            tables.noteItemsStore.dispose();
        };
    }, [tables]);

    useEffect(() => {
        if (!supabaseClient) {
            setReplicationStatus({
                state: 'local-only',
            });

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
                setReplicationStatus({
                    state: 'error',
                    message: latestError,
                });

                return;
            }

            const isSyncing = Object.values(activeByName).some(Boolean);

            setReplicationStatus({
                state: isSyncing ? 'syncing' : 'idle',
            });
        };

        setReplicationStatus({ state: 'initializing' });

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
                if (cancelled) {
                    return;
                }

                setReplicationStatus({
                    state: 'error',
                    message: error instanceof Error ? error.message : String(error),
                });
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
