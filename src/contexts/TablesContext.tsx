import React, {
    PropsWithChildren,
    useContext,
    useEffect,
    useRef,
} from 'react';

import { NoteItemsStore } from '../controllers/NoteItemsStore';
import { NoteItemsTableLocal } from '../tables/NoteItemsTableLocal';

import { useExistingLocalDbFacade } from './LocalDbFacadeContext';

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

    const localDbFacade = useExistingLocalDbFacade();

    // eslint-disable-next-line react-hooks/refs
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

    // eslint-disable-next-line react-hooks/refs
    const tables = tablesRef.current;

    useEffect(() => {
        tables.noteItemsStore.connect();

        return () => {
            tables.noteItemsStore.dispose();
        };
    }, [tables]);

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
