import React, {
    PropsWithChildren,
    useContext,
    useRef,
} from 'react';

import { NoteItemsStore } from '../controllers/NoteItemsStore';

import { useExistingLocalDbFacade } from './LocalDbFacadeContext';
import { useSupabaseControllerStatus } from './SupabaseControllerContext';

export type TablesContextType = {
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
    const { clientSignal } = useSupabaseControllerStatus();

    // eslint-disable-next-line react-hooks/refs
    if (!tablesRef.current) {
        tablesRef.current = {
            noteItemsStore: new NoteItemsStore({
                localDbFacade,
                supabaseControllerClientSignal: clientSignal,
                showError,
            }),
        };
    }

    // eslint-disable-next-line react-hooks/refs
    const tables = tablesRef.current;

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
