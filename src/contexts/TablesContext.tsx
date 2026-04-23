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

import { ConnectionStatus } from '../components/ConnectionStatusIndicator/ConnectionStatusIndicator';
import { NoteItemsStore } from '../controllers/NoteItemsStore';
import { ensureReplicationReady } from '../localDb/replication';
import { NoteItemsTableLocal } from '../tables/NoteItemsTableLocal';

import { useLocalDbFacade } from './LocalDbFacadeContext';
import { useSupabaseControllerStatus } from './SupabaseControllerContext';

export type TablesContextType = {
    noteItemsTableLocal: NoteItemsTableLocal;
    noteItemsStore: NoteItemsStore;
    replicationStatus: ConnectionStatus;
};

export const TablesContext = React.createContext<TablesContextType | null>(null);
TablesContext.displayName = 'TablesContext';

export const TablesContextProvider = ({
    children,
    showError,
}: PropsWithChildren & {
    showError: (message: string) => void;
}) => {
    const [
        replicationStatus,
        setReplicationStatus,
    ] = useState<ConnectionStatus>('initializing');
    const tablesRef = useRef<TablesContextType | null>(null);

    const { clientReadyLatch } = useSupabaseControllerStatus();
    const supabaseClient: SupabaseClient | undefined = clientReadyLatch.getValue();

    const localDbFacade = useLocalDbFacade();

    if (!tablesRef.current) {
        const noteItemsTableLocal = new NoteItemsTableLocal(localDbFacade);

        tablesRef.current = {
            noteItemsTableLocal,
            noteItemsStore: new NoteItemsStore({
                noteItemsTable: noteItemsTableLocal,
                showError,
            }),
            replicationStatus,
        };
    }

    const tables = tablesRef.current;

    tables.replicationStatus = replicationStatus;

    useEffect(() => {
        tables.noteItemsStore.connect();

        return () => {
            tables.noteItemsStore.dispose();
        };
    }, [tables]);

    useEffect(() => {
        if (!supabaseClient) {
            setReplicationStatus('localOnly');

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
                setReplicationStatus('error');

                return;
            }

            const isSyncing = Object.values(activeByName).some(Boolean);

            setReplicationStatus(isSyncing ? 'syncing' : 'idle');
        };

        setReplicationStatus('initializing');

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

                // TODO: handle errors more gracefully
                setReplicationStatus('error');
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
